package com.ritzsmp.auctionbridge;

import github.scarsz.discordsrv.DiscordSRV;
import github.scarsz.discordsrv.dependencies.jda.api.EmbedBuilder;
import github.scarsz.discordsrv.dependencies.jda.api.JDA;
import github.scarsz.discordsrv.dependencies.jda.api.entities.MessageEmbed;
import github.scarsz.discordsrv.dependencies.jda.api.entities.TextChannel;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.awt.Color;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Routes only the two transaction records emitted by AuctionHouse's TransactionLogger.
 * It deliberately does not inspect chat, commands, GUI text, or server console output.
 */
public final class RitzAuctionBridge extends JavaPlugin {
    private static final DateTimeFormatter TRANSACTION_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern LISTING = Pattern.compile(
            "^\\[([^]]+)] Player set up an auction: ([^|]+) \\| Item: ([^|]+) \\| Amount: (\\d+) \\| Price: ([^|]+) \\| BID: (true|false)$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SALE = Pattern.compile(
            "^\\[([^]]+)] Buyer: ([^|]+) \\| Seller: ([^|]+) \\| Item: ([^|]+) \\| Amount: (\\d+) \\| Price: ([^|]+) \\| BID: (true|false)$",
            Pattern.CASE_INSENSITIVE);

    private final AtomicBoolean pollRunning = new AtomicBoolean(false);
    private BukkitTask pollTask;
    private Path stateFile;
    private Cursor cursor;
    private long retryAfterMillis;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        try {
            Files.createDirectories(getDataFolder().toPath());
        } catch (IOException error) {
            getLogger().severe("ไม่สามารถสร้างโฟลเดอร์ข้อมูลของ bridge ได้: " + safeError(error));
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        stateFile = getDataFolder().toPath().resolve("cursor.yml");
        cursor = loadCursor();
        long interval = Math.max(20L, getConfig().getLong("poll-interval-ticks", 40L));
        pollTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::pollTransactionLog, 20L, interval);
        getLogger().info("RitzAuctionBridge เปิดใช้งาน: อ่านเฉพาะรายการลงขาย/ซื้อสำเร็จ และส่งไป order-in-game");
    }

    @Override
    public void onDisable() {
        if (pollTask != null) pollTask.cancel();
        if (cursor != null) saveCursor();
    }

    private void pollTransactionLog() {
        if (!pollRunning.compareAndSet(false, true)) return;
        try {
            if (System.currentTimeMillis() < retryAfterMillis) return;
            Path log = findNextLog();
            if (log == null) return;

            long start;
            if (cursor.fileName == null) {
                start = initialOffset(log);
                // Persist the initial position even when the file has no new complete lines.
                // Without this, start-at-end would be recalculated on every poll and skip all
                // future AuctionHouse events forever when the state file has no file name.
                cursor = new Cursor(log.getFileName().toString(), start);
                saveCursor();
            } else {
                start = offsetFor(log);
            }
            List<LogLine> lines = readCompleteLines(log, start);
            if (lines.isEmpty()) return;

            for (LogLine line : lines) {
                if (line.event != null) {
                    if (!sendToDiscord(line.event)) {
                        retryAfterMillis = System.currentTimeMillis() + retryDelayMillis();
                        return;
                    }
                }
                cursor = new Cursor(log.getFileName().toString(), line.endOffset);
                saveCursor();
            }
        } catch (Exception error) {
            retryAfterMillis = System.currentTimeMillis() + retryDelayMillis();
            getLogger().warning("อ่าน AuctionHouse transaction log ไม่สำเร็จ: " + safeError(error));
        } finally {
            pollRunning.set(false);
        }
    }

    private Path findNextLog() throws IOException {
        Path directory = resolveLogDirectory();
        if (!Files.isDirectory(directory)) return null;
        List<Path> files = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(directory, getConfig().getString("transaction-log-pattern", "*.log"))) {
            for (Path path : stream) if (Files.isRegularFile(path)) files.add(path);
        }
        files.sort(Comparator.comparing(path -> path.getFileName().toString()));
        if (files.isEmpty()) return null;
        if (cursor.fileName == null) return files.get(files.size() - 1);

        for (Path file : files) {
            String name = file.getFileName().toString();
            if (name.equals(cursor.fileName)) return file;
            if (name.compareTo(cursor.fileName) > 0) return file;
        }
        return files.get(files.size() - 1);
    }

    private Path resolveLogDirectory() {
        String configured = getConfig().getString("auctionhouse-log-directory", "../AuctionHouse/logs");
        return getDataFolder().toPath().resolve(configured).normalize();
    }

    private long initialOffset(Path log) throws IOException {
        return getConfig().getBoolean("start-at-end-when-state-is-missing", true) ? Files.size(log) : 0L;
    }

    private long offsetFor(Path log) throws IOException {
        if (!log.getFileName().toString().equals(cursor.fileName)) return 0L;
        long length = Files.size(log);
        return cursor.offset > length ? 0L : cursor.offset;
    }

    private List<LogLine> readCompleteLines(Path file, long start) throws IOException {
        List<LogLine> lines = new ArrayList<>();
        long fileLength = Files.size(file);
        if (start >= fileLength) return lines;
        try (RandomAccessFile reader = new RandomAccessFile(file.toFile(), "r")) {
            reader.seek(start);
            while (true) {
                long lineStart = reader.getFilePointer();
                String raw = reader.readLine();
                if (raw == null) break;
                long end = reader.getFilePointer();
                if (end == fileLength && !endsWithLineBreak(reader, fileLength)) break;
                String decoded = new String(raw.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8);
                lines.add(new LogLine(end, parseEvent(decoded)));
                if (end <= lineStart) break;
            }
        }
        return lines;
    }

    private boolean endsWithLineBreak(RandomAccessFile reader, long length) throws IOException {
        if (length == 0) return true;
        long current = reader.getFilePointer();
        reader.seek(length - 1);
        int last = reader.read();
        reader.seek(current);
        return last == '\n' || last == '\r';
    }

    private AuctionEvent parseEvent(String line) {
        Matcher listing = LISTING.matcher(line.trim());
        if (listing.matches() && getConfig().getBoolean("forward-listings", true)) {
            return new AuctionEvent(
                    EventKind.LISTED,
                    parseTime(listing.group(1)),
                    clean(listing.group(2)),
                    null,
                    clean(listing.group(3)),
                    Integer.parseInt(listing.group(4)),
                    clean(listing.group(5)),
                    Boolean.parseBoolean(listing.group(6)));
        }

        Matcher sale = SALE.matcher(line.trim());
        if (sale.matches() && getConfig().getBoolean("forward-sales", true)) {
            return new AuctionEvent(
                    EventKind.SOLD,
                    parseTime(sale.group(1)),
                    clean(sale.group(3)),
                    clean(sale.group(2)),
                    clean(sale.group(4)),
                    Integer.parseInt(sale.group(5)),
                    clean(sale.group(6)),
                    Boolean.parseBoolean(sale.group(7)));
        }
        return null;
    }

    private Instant parseTime(String value) {
        try {
            return LocalDateTime.parse(value.trim(), TRANSACTION_TIME).atZone(ZoneId.systemDefault()).toInstant();
        } catch (DateTimeParseException ignored) {
            return Instant.now();
        }
    }

    private String clean(String value) {
        return value
                .replace('\r', ' ')
                .replace('\n', ' ')
                .replaceAll("§[0-9A-FK-ORa-fk-or]", "")
                .trim();
    }

    private boolean sendToDiscord(AuctionEvent event) {
        String channelId = getConfig().getString("order-in-game-channel-id", "").trim();
        if (channelId.isEmpty()) {
            getLogger().warning("ยังไม่ได้ตั้งค่า order-in-game-channel-id; ข้ามการส่งและจะลองใหม่ภายหลัง");
            return false;
        }
        if (!DiscordSRV.isReady || DiscordSRV.getPlugin() == null || DiscordSRV.getPlugin().getJda() == null) {
            getLogger().warning("DiscordSRV ยังไม่พร้อม; จะลองส่ง AuctionHouse event ใหม่ภายหลัง");
            return false;
        }

        JDA jda = DiscordSRV.getPlugin().getJda();
        TextChannel channel = jda.getTextChannelById(channelId);
        if (channel == null) {
            getLogger().warning("ไม่พบ order-in-game channel ตาม ID ที่ตั้งไว้");
            return false;
        }

        EmbedBuilder embed = new EmbedBuilder()
                .setTitle(event.kind == EventKind.LISTED ? "📦 มีผู้เล่นลงขายสินค้าใน AuctionHouse" : "✅ มีการซื้อสินค้าใน AuctionHouse")
                .setDescription(event.kind == EventKind.LISTED
                        ? "มีรายการใหม่ถูกลงขายในตลาดกลางของเซิร์ฟเวอร์"
                        : "รายการในตลาดกลางถูกซื้อสำเร็จแล้ว")
                .setColor(event.kind == EventKind.LISTED ? new Color(139, 92, 246) : new Color(34, 197, 94))
                .addField("ผู้ลงขาย", limit(event.seller, 1024), true)
                .addField("ไอเทม", limit(event.item, 1024), true)
                .addField("จำนวน", Integer.toString(event.amount), true)
                .addField("ราคา", limit(event.price + " เงินในเกม", 1024), true)
                .addField("ประเภท", event.bid ? "ประมูล (BID)" : "ขายขาด", true)
                .setFooter("RitzSMP AuctionHouse • แจ้งเตือนจากธุรกรรมจริง")
                .setTimestamp(event.occurredAt);
        if (event.kind == EventKind.SOLD) {
            embed.addField("ผู้ซื้อ", limit(event.buyer == null ? "ไม่ระบุ" : event.buyer, 1024), true);
        }

        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        MessageEmbed message = embed.build();
        channel.sendMessageEmbeds(message).queue(ignored -> latch.countDown(), error -> {
            failure.set(error);
            latch.countDown();
        });
        try {
            if (!latch.await(8, TimeUnit.SECONDS)) {
                getLogger().warning("DiscordSRV ส่ง AuctionHouse event timeout");
                return false;
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return false;
        }
        if (failure.get() != null) {
            getLogger().warning("ส่ง AuctionHouse event ไม่สำเร็จ: " + safeError(failure.get()));
            return false;
        }
        return true;
    }

    private long retryDelayMillis() {
        return Math.max(1L, getConfig().getLong("retry-delay-seconds", 10L)) * 1000L;
    }

    private String limit(String value, int max) {
        String safe = value == null ? "" : value;
        return safe.length() <= max ? safe : safe.substring(0, max - 1) + "…";
    }

    private Cursor loadCursor() {
        if (!Files.isRegularFile(stateFile)) return new Cursor(null, 0L);
        YamlConfiguration state = YamlConfiguration.loadConfiguration(stateFile.toFile());
        return new Cursor(state.getString("file"), Math.max(0L, state.getLong("offset", 0L)));
    }

    private void saveCursor() {
        if (stateFile == null || cursor == null) return;
        YamlConfiguration state = new YamlConfiguration();
        state.set("file", cursor.fileName);
        state.set("offset", cursor.offset);
        try {
            state.save(stateFile.toFile());
        } catch (IOException error) {
            getLogger().warning("บันทึก cursor ของ AuctionHouse ไม่สำเร็จ: " + safeError(error));
        }
    }

    private String safeError(Throwable error) {
        String message = error.getMessage();
        if (message == null || message.isBlank()) return error.getClass().getSimpleName();
        return limit(message.replaceAll("(?i)(token|authorization|password|secret)=?[^\\s,;]+", "$1=[redacted]"), 220);
    }

    private record Cursor(String fileName, long offset) {}
    private record LogLine(long endOffset, AuctionEvent event) {}
    private record AuctionEvent(EventKind kind, Instant occurredAt, String seller, String buyer, String item,
                                int amount, String price, boolean bid) {}
    private enum EventKind { LISTED, SOLD }
}
