import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Loader2, Server, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ServerDirectory() {
  const serversQuery = trpc.servers.list.useQuery();
  const servers = serversQuery.data ?? [];

  const chooseServer = (slug: string) => {
    window.localStorage.setItem("ritzsmp.activeServer", slug);
    window.location.assign(`/?server=${encodeURIComponent(slug)}`);
  };

  return (
    <div className="store-shell">
      <div className="noise" aria-hidden="true" />
      <main className="admin-shell" style={{ minHeight: "100vh" }}>
        <div className="container" style={{ maxWidth: 980 }}>
          <div className="admin-head">
            <div>
              <Link href="/" className="eyebrow" style={{ textDecoration: "none" }}>
                <ArrowLeft size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> กลับหน้าร้าน
              </Link>
              <h1 className="admin-title">เลือกเซิร์ฟเวอร์</h1>
              <p className="subtle" style={{ margin: "8px 0 0", fontSize: 13 }}>
                เลือกชุมชน Minecraft ที่ต้องการดูข้อมูลและเข้าสู่หน้าร้าน ระบบจะแยกการตั้งค่าของแต่ละเซิร์ฟเวอร์ออกจากกัน
              </p>
            </div>
            <Server size={30} className="gold-text" aria-hidden="true" />
          </div>

          {serversQuery.isLoading ? (
            <div className="loading" aria-live="polite"><Loader2 size={20} className="animate-spin" /> กำลังโหลดรายการเซิร์ฟเวอร์</div>
          ) : serversQuery.isError ? (
            <div className="empty-box" role="alert">ไม่สามารถโหลดรายการเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง</div>
          ) : servers.length === 0 ? (
            <div className="empty-box">
              <ShieldCheck size={24} className="gold-text" />
              <p>ยังไม่มีเซิร์ฟเวอร์ที่เปิดใช้งาน เจ้าของระบบสามารถเพิ่มได้จาก Owner Dashboard</p>
            </div>
          ) : (
            <div className="rank-grid" data-testid="server-directory">
              {servers.map(server => (
                <article key={server.id} className="rank-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="eyebrow">{server.slug}</div>
                  <h2 style={{ margin: 0 }}>{server.displayName}</h2>
                  <p className="subtle" style={{ margin: 0, wordBreak: "break-word" }}>
                    Minecraft: {server.minecraftHost}:{server.minecraftPort}
                  </p>
                  {server.discordGuildId && <p className="subtle" style={{ margin: 0 }}>Discord Guild: {server.discordGuildId}</p>}
                  <button type="button" className="primary-btn compact-btn" onClick={() => chooseServer(server.slug)}>
                    เข้าเซิร์ฟเวอร์นี้ <ExternalLink size={14} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
