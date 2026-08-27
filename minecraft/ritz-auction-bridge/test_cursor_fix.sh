#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$ROOT/src/main/java/com/ritzsmp/auctionbridge/RitzAuctionBridge.java"
JAR="$ROOT/build/RitzAuctionBridge.jar"

# Regression guard: a missing state file must initialize and persist the current log position.
grep -Fq 'if (cursor.fileName == null)' "$SOURCE"
grep -Fq 'cursor = new Cursor(log.getFileName().toString(), start);' "$SOURCE"
grep -Fq 'saveCursor();' "$SOURCE"
grep -Fq 'compareTransactionLogNames' "$SOURCE"
grep -Fq 'if (cursor.offset != Files.size(file)) return file;' "$SOURCE"
grep -Fq 'shouldAdvancePastEmptyLog' "$SOURCE"
# Cancellation regression guards: listing messages must be persisted and removed only by matching fingerprint.
grep -Fq 'CANCELLATION' "$SOURCE"
grep -Fq 'forward-cancellations' "$ROOT/src/main/resources/config.yml"
grep -Fq 'listing-messages.yml' "$SOURCE"
grep -Fq 'deleteMessageById' "$SOURCE"
grep -Fq '10008' "$SOURCE"

test -s "$JAR"
jar tf "$JAR" | grep -Fq 'com/ritzsmp/auctionbridge/RitzAuctionBridge.class'

PAPER_JAR="$(find "$ROOT/build" -maxdepth 1 -type f -name 'paper-api-*.jar' -print -quit)"
ADVENTURE_JAR="$(find "$ROOT/build" -maxdepth 1 -type f -name 'adventure-api-*.jar' -print -quit)"
DISCORDSRV_JAR="${DISCORDSRV_JAR:-/tmp/DiscordSRV-1.30.5.jar}"
test -s "$PAPER_JAR"
test -s "$ADVENTURE_JAR"
test -s "$DISCORDSRV_JAR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$TMP_DIR/com/ritzsmp/auctionbridge"
cat > "$TMP_DIR/com/ritzsmp/auctionbridge/LogOrderRegression.java" <<'EOF'
package com.ritzsmp.auctionbridge;

public final class LogOrderRegression {
    public static void main(String[] args) {
        assertBefore("2026-08-26-9.log", "2026-08-26-10.log");
        assertBefore("2026-08-26-10.log", "2026-08-26-16.log");
        assertBefore("2026-08-26-16.log", "2026-08-27-1.log");
        if (RitzAuctionBridge.compareTransactionLogNames("2026-08-26-10.log", "2026-08-26-10.log") != 0) {
            throw new AssertionError("equal names must compare as equal");
        }
        if (!RitzAuctionBridge.shouldAdvancePastEmptyLog(
                "2026-08-26-9.log", "2026-08-26-10.log", 0L, 0L)) {
            throw new AssertionError("a newer empty log must advance the cursor");
        }
        if (RitzAuctionBridge.shouldAdvancePastEmptyLog(
                "2026-08-26-10.log", "2026-08-26-10.log", 0L, 0L)) {
            throw new AssertionError("the active empty log must remain available for future writes");
        }
        if (RitzAuctionBridge.shouldAdvancePastEmptyLog(
                "2026-08-26-9.log", "2026-08-26-10.log", 0L, 1L)) {
            throw new AssertionError("a partial non-empty log must not be skipped");
        }
    }

    private static void assertBefore(String left, String right) {
        if (RitzAuctionBridge.compareTransactionLogNames(left, right) >= 0) {
            throw new AssertionError(left + " must sort before " + right);
        }
    }
}
EOF

CLASSPATH="$JAR:$PAPER_JAR:$DISCORDSRV_JAR:$ADVENTURE_JAR"
javac --release 21 -encoding UTF-8 -cp "$CLASSPATH" -d "$TMP_DIR" "$TMP_DIR/com/ritzsmp/auctionbridge/LogOrderRegression.java"
java -cp "$TMP_DIR:$CLASSPATH" com.ritzsmp.auctionbridge.LogOrderRegression

printf 'RitzAuctionBridge cursor and log-order regression checks passed\n'
