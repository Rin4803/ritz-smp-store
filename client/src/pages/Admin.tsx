import { useMemo, useState } from "react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Plus,
  Power,
  Server,
} from "lucide-react";

function formatDate(value: Date | string | number) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(status: string) {
  if (status === "สำเร็จ") return "success";
  if (status === "ยกเลิก") return "cancelled";
  return "pending";
}

export default function Admin() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const ordersQuery = trpc.admin.orders.useQuery(undefined, { enabled: isAdmin });
  const usersQuery = trpc.admin.users.useQuery(undefined, { enabled: isAdmin });
  const managedServersQuery = trpc.servers.adminList.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const updateOrder = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => utils.admin.orders.invalidate(),
  });
  const updateUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => utils.admin.users.invalidate(),
  });
  const [adminEmail, setAdminEmail] = useState("");
  const [adminCandidateId, setAdminCandidateId] = useState("");
  const grantAdminByEmail = trpc.admin.grantAdminByEmail.useMutation({
    onSuccess: () => {
      setAdminEmail("");
      setAdminCandidateId("");
      utils.admin.users.invalidate();
    },
  });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [serverForm, setServerForm] = useState({ slug: "", displayName: "", minecraftHost: "", minecraftPort: "25565", discordGuildId: "" });
  const createServer = trpc.servers.create.useMutation({
    onSuccess: () => {
      setServerForm({ slug: "", displayName: "", minecraftHost: "", minecraftPort: "25565", discordGuildId: "" });
      utils.servers.adminList.invalidate();
      utils.servers.list.invalidate();
    },
  });
  const updateServer = trpc.servers.update.useMutation({
    onSuccess: () => {
      utils.servers.adminList.invalidate();
      utils.servers.list.invalidate();
    },
  });
  const [runtimeServerId, setRuntimeServerId] = useState<number | null>(null);
  const runtimeQuery = trpc.servers.runtime.useQuery(
    { id: runtimeServerId ?? 0 },
    { enabled: runtimeServerId !== null },
  );
  const presenceStatusQuery = trpc.servers.presenceScheduleStatus.useQuery(undefined, { enabled: isAdmin, refetchInterval: 30_000 });
  const presenceSchedule = trpc.servers.presenceSchedule.useMutation({
    onSuccess: () => utils.servers.presenceScheduleStatus.invalidate(),
  });

  const submitServer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!serverForm.slug.trim() || !serverForm.displayName.trim() || !serverForm.minecraftHost.trim()) return;
    createServer.mutate({
      slug: serverForm.slug.trim().toLowerCase(),
      displayName: serverForm.displayName.trim(),
      minecraftHost: serverForm.minecraftHost.trim(),
      minecraftPort: Number(serverForm.minecraftPort),
      discordGuildId: serverForm.discordGuildId.trim() || null,
      enabled: true,
      config: { channelConfig: {} },
    });
  };

  const orders = ordersQuery.data ?? [];
  const managedUsers = usersQuery.data ?? [];
  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(order => order.status === "รอตรวจสอบ").length,
    successful: orders.filter(order => order.status === "สำเร็จ").length,
  }), [orders]);

  if (authLoading) return <div className="store-shell"><div className="loading"><Loader2 size={20} className="animate-spin" /></div></div>;
  if (!isAuthenticated) return <div className="store-shell"><div className="admin-shell"><div className="container empty-box"><LogIn size={22} className="gold-text" /><p>กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล</p><button className="primary-btn compact-btn" onClick={() => startLogin()}>เข้าสู่ระบบ</button></div></div></div>;
  if (!isAdmin) return <div className="store-shell"><div className="admin-shell"><div className="container empty-box"><ShieldAlert size={24} className="gold-text" /><p>บัญชีนี้ไม่มีสิทธิ์เข้าถึง Dashboard แอดมิน</p><Link className="ghost-btn compact-btn" href="/">กลับหน้าร้าน</Link></div></div></div>;

  return (
    <div className="store-shell">
      <div className="noise" aria-hidden="true" />
      <main className="admin-shell">
        <div className="container">
          <div className="admin-head">
            <div>
              <Link href="/" className="eyebrow" style={{ textDecoration: "none" }}>
                <ArrowLeft size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> กลับหน้าร้าน
              </Link>
              <h1 className="admin-title">Order Control Center</h1>
              <p className="subtle" style={{ margin: "8px 0 0", fontSize: 13 }}>จัดการออเดอร์ RitzSMP และสิทธิ์ผู้ดูแลจากพื้นที่เดียว</p>
            </div>
            <div className="user-chip" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Link href="/admin/bot" className="ghost-btn compact-btn" style={{ textDecoration: "none", fontSize: "12px", background: "rgba(236, 72, 153, 0.1)", color: "#ec4899", border: "1px solid rgba(236, 72, 153, 0.3)" }}>🤖 บอท Discord AI</Link>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={14} className="gold-text" /> {user.name ?? "Admin"}</span>
            </div>
          </div>

          <div className="admin-stats">
            <div className="stat-card"><span>ออเดอร์ทั้งหมด</span><strong>{stats.total}</strong></div>
            <div className="stat-card"><span>รอตรวจสอบ</span><strong>{stats.pending}</strong></div>
            <div className="stat-card"><span>สำเร็จแล้ว</span><strong>{stats.successful}</strong></div>
          </div>

          <section className="admin-panel" style={{ marginBottom: 24 }} aria-labelledby="managed-servers-title">
            <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 7 }}><Server size={14} /> MULTI-SERVER CONTROL</div>
                <h2 id="managed-servers-title" style={{ margin: "7px 0 0", fontSize: 20 }}>จัดการเซิร์ฟเวอร์ Minecraft</h2>
                <p className="subtle" style={{ margin: "7px 0 0", fontSize: 13 }}>เพิ่มชุมชนใหม่ได้จากที่เดียว ระบบจะเก็บเฉพาะชื่อ environment ของ secret ไม่เก็บ token หรือรหัสผ่านลงฐานข้อมูล</p>
              </div>
              <Server size={24} className="gold-text" aria-hidden="true" />
            </div>

            <form onSubmit={submitServer} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 16 }}>
              <input className="admin-note" value={serverForm.slug} placeholder="slug เช่น ritzsmp" aria-label="Slug เซิร์ฟเวอร์" onChange={event => setServerForm(current => ({ ...current, slug: event.target.value }))} />
              <input className="admin-note" value={serverForm.displayName} placeholder="ชื่อที่แสดง" aria-label="ชื่อที่แสดง" onChange={event => setServerForm(current => ({ ...current, displayName: event.target.value }))} />
              <input className="admin-note" value={serverForm.minecraftHost} placeholder="Minecraft host" aria-label="Minecraft host" onChange={event => setServerForm(current => ({ ...current, minecraftHost: event.target.value }))} />
              <input className="admin-note" type="number" min="1" max="65535" value={serverForm.minecraftPort} placeholder="Port" aria-label="Minecraft port" onChange={event => setServerForm(current => ({ ...current, minecraftPort: event.target.value }))} />
              <input className="admin-note" value={serverForm.discordGuildId} placeholder="Discord Guild ID (ถ้ามี)" aria-label="Discord Guild ID" onChange={event => setServerForm(current => ({ ...current, discordGuildId: event.target.value }))} />
              <button className="primary-btn compact-btn" type="submit" disabled={createServer.isPending} style={{ justifyContent: "center" }}>{createServer.isPending ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} /> เพิ่มเซิร์ฟเวอร์</>}</button>
            </form>
            {createServer.error && <p role="alert" style={{ color: "#fda4af", margin: "10px 0 0", fontSize: 13 }}>{createServer.error.message}</p>}

            {managedServersQuery.isLoading ? <div className="loading"><Loader2 size={18} className="animate-spin" /></div> : managedServersQuery.isError ? <p role="alert" style={{ color: "#fda4af", marginTop: 12 }}>โหลดรายการเซิร์ฟเวอร์ไม่สำเร็จ</p> : managedServersQuery.data?.length ? (
              <div className="admin-table-wrap" style={{ marginTop: 16 }}>
                <table className="admin-table">
                  <thead><tr><th>เซิร์ฟเวอร์</th><th>Minecraft</th><th>Discord</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                  <tbody>{managedServersQuery.data.map(server => <tr key={server.id}>
                    <td><strong>{server.displayName}</strong><br /><span className="subtle">{server.slug}</span></td>
                    <td>{server.minecraftHost}:{server.minecraftPort}</td>
                    <td>{server.discordGuildId ?? "ยังไม่ผูก"}</td>
                    <td><span className={`status ${server.enabled ? "success" : "cancelled"}`}>{server.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></td>
                    <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" className="ghost-btn compact-btn" disabled={updateServer.isPending} onClick={() => updateServer.mutate({ id: server.id, displayName: server.displayName, minecraftHost: server.minecraftHost, minecraftPort: server.minecraftPort, discordGuildId: server.discordGuildId, enabled: !server.enabled, config: { discordTokenEnv: server.config?.discordTokenEnv ?? null, rconHost: server.config?.rconHost ?? null, rconPort: server.config?.rconPort ?? null, rconPasswordEnv: server.config?.rconPasswordEnv ?? null, channelConfig: server.config?.channelConfig ?? {} } })}><Power size={13} /> {server.enabled ? "ปิดระบบ" : "เปิดระบบ"}</button><button type="button" className="ghost-btn compact-btn" onClick={() => setRuntimeServerId(server.id)}>ตรวจ runtime</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            ) : <div className="empty-box" style={{ marginTop: 16 }}>ยังไม่มีเซิร์ฟเวอร์ใน registry</div>}
            {runtimeServerId !== null && (
              <div className="empty-box" style={{ marginTop: 16 }} aria-live="polite">
                {runtimeQuery.isLoading ? "กำลังตรวจ runtime..." : runtimeQuery.isError ? runtimeQuery.error.message : runtimeQuery.data && (
                  <><strong>{runtimeQuery.data.displayName}</strong> พร้อมใช้งาน: Discord token {runtimeQuery.data.hasDiscordToken ? "พร้อม" : "ยังไม่ตั้งค่า"}, RCON password {runtimeQuery.data.hasRconPassword ? "พร้อม" : "ยังไม่ตั้งค่า"}<br /><span className="subtle">ช่องระบบที่ผูกไว้ {Object.keys(runtimeQuery.data.channels).length} รายการ · Guild {runtimeQuery.data.discordGuildId || "ยังไม่ผูก"}</span></>
                )}
              </div>
            )}
            {updateServer.error && <p role="alert" style={{ color: "#fda4af", margin: "10px 0 0", fontSize: 13 }}>{updateServer.error.message}</p>}
          </section>

          <section className="admin-panel" style={{ marginBottom: 24 }} aria-labelledby="presence-schedule-title">
            <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 7 }}><Power size={14} /> SERVER-REALTIME</div>
                <h2 id="presence-schedule-title" style={{ margin: "7px 0 0", fontSize: 20 }}>ตรวจสถานะและผู้เล่นอัตโนมัติ</h2>
                <p className="subtle" style={{ margin: "7px 0 0", fontSize: 13 }}>ใช้ Heartbeat แทน timer ในเว็บ เพื่อรองรับ Autoscale และอัปเดตสถานะ server-realtime/server-chat ทุก 1 นาที</p>
              </div>
              <Power size={24} className="gold-text" aria-hidden="true" />
            </div>
            <div className="empty-box" style={{ marginTop: 16 }} aria-live="polite">
              {presenceStatusQuery.isLoading ? "กำลังโหลดสถานะ schedule..." : presenceStatusQuery.isError ? "โหลดสถานะ schedule ไม่สำเร็จ" : presenceStatusQuery.data ? (
                <><strong>{presenceStatusQuery.data.configured ? "มี schedule อยู่ในระบบ" : "ยังไม่ได้เปิด schedule"}</strong><br /><span className="subtle">สถานะล่าสุด: {presenceStatusQuery.data.lastOnline ? "เซิร์ฟเวอร์ออนไลน์" : "ออฟไลน์หรือยังไม่มีข้อมูล"} · ผู้เล่นล่าสุด {presenceStatusQuery.data.playerListKnown ? `${presenceStatusQuery.data.lastPlayerCount} คน` : "ไม่ทราบจำนวน"}{presenceStatusQuery.data.lastCheckedAt ? ` · ตรวจเมื่อ ${formatDate(presenceStatusQuery.data.lastCheckedAt)}` : ""}</span></>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" className="primary-btn compact-btn" disabled={presenceSchedule.isPending || presenceStatusQuery.data?.configured} onClick={() => presenceSchedule.mutate({ action: "create" })}>{presenceSchedule.isPending ? <Loader2 size={13} className="animate-spin" /> : "เปิดการตรวจอัตโนมัติ"}</button>
              <button type="button" className="ghost-btn compact-btn" disabled={presenceSchedule.isPending || !presenceStatusQuery.data?.configured} onClick={() => presenceSchedule.mutate({ action: "pause" })}>หยุดชั่วคราว</button>
              <button type="button" className="ghost-btn compact-btn" disabled={presenceSchedule.isPending || !presenceStatusQuery.data?.configured} onClick={() => presenceSchedule.mutate({ action: "resume" })}>เปิดต่อ</button>
            </div>
            {presenceSchedule.error && <p role="alert" style={{ color: "#fda4af", margin: "10px 0 0", fontSize: 13 }}>{presenceSchedule.error.message}</p>}
          </section>

          {usersQuery.isSuccess && (
            <section className="admin-panel" style={{ marginBottom: 24 }} aria-labelledby="admin-management-title">
              <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                <div>
                  <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 7 }}><ShieldCheck size={14} /> OWNER CONTROL</div>
                  <h2 id="admin-management-title" style={{ margin: "7px 0 0", fontSize: 20 }}>จัดการผู้ดูแลเว็บไซต์</h2>
                  <p className="subtle" style={{ margin: "7px 0 0", fontSize: 13 }}>เฉพาะบัญชีผู้สร้างระบบเท่านั้นที่เห็นและใช้ส่วนนี้ได้ บัญชี Owner จะถูกล็อกไม่ให้ถอดสิทธิ์</p>
                </div>
                <UserCog size={24} className="gold-text" aria-hidden="true" />
              </div>
              <form
                onSubmit={event => {
                  event.preventDefault();
                  const selected = managedUsers.find(account => String(account.id) === adminCandidateId);
                  const email = adminEmail.trim() || selected?.email?.trim() || "";
                  if (email) grantAdminByEmail.mutate({ email });
                }}
                style={{ marginTop: 16, padding: 14, border: "1px solid rgba(251, 191, 36, 0.2)", borderRadius: 14, background: "rgba(251, 191, 36, 0.04)" }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "center" }}>
                  <input className="admin-note" type="email" value={adminEmail} placeholder="ใส่ Gmail ของผู้ดูแล" aria-label="Gmail ผู้ดูแล" onChange={event => setAdminEmail(event.target.value)} />
                  <select className="admin-note" value={adminCandidateId} aria-label="เลือกบัญชีผู้ดูแลจากรายชื่อ" onChange={event => setAdminCandidateId(event.target.value)}>
                    <option value="">หรือเลือกบัญชีที่เคยเข้าสู่ระบบ</option>
                    {managedUsers.filter(account => !account.isOwner && account.email).map(account => <option key={account.id} value={account.id}>{account.name ?? "ไม่ระบุชื่อ"} · {account.email}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="primary-btn compact-btn" type="submit" disabled={grantAdminByEmail.isPending || (!adminEmail.trim() && !adminCandidateId)}>{grantAdminByEmail.isPending ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} /> เพิ่ม Admin</>}</button>
                    <button className="ghost-btn compact-btn" type="button" onClick={() => { setAdminEmail(""); setAdminCandidateId(""); grantAdminByEmail.reset(); }}>ยกเลิก</button>
                  </div>
                </div>
                <p className="subtle" style={{ margin: "9px 0 0", fontSize: 12 }}>บัญชีต้องเคยเข้าสู่ระบบเว็บด้วย Gmail นี้แล้ว ระบบจะไม่สร้างบัญชีใหม่และจะไม่แตะสิทธิ์ Owner</p>
                {grantAdminByEmail.error && <p role="alert" style={{ color: "#fda4af", margin: "9px 0 0", fontSize: 13 }}>{grantAdminByEmail.error.message}</p>}
                {grantAdminByEmail.isSuccess && <p role="status" style={{ color: "#86efac", margin: "9px 0 0", fontSize: 13 }}>เพิ่มสิทธิ์ Admin สำเร็จแล้วค่ะ</p>}
              </form>
              <div className="admin-table-wrap" style={{ marginTop: 16 }}>
                <table className="admin-table">
                  <thead><tr><th>บัญชี</th><th>อีเมล</th><th>เข้าสู่ระบบล่าสุด</th><th>สิทธิ์</th><th>การจัดการ</th></tr></thead>
                  <tbody>
                    {managedUsers.map(account => (
                      <tr key={account.id}>
                        <td><strong>{account.name ?? "ไม่ระบุชื่อ"}</strong>{account.isOwner && <><br /><span className="subtle">บัญชีผู้สร้างระบบ</span></>}</td>
                        <td>{account.email ?? "ไม่ระบุอีเมล"}</td>
                        <td className="subtle">{account.lastSignedIn ? formatDate(account.lastSignedIn) : "ยังไม่เคยเข้าใช้"}</td>
                        <td><span className={`status ${account.isOwner ? "success" : account.role === "admin" ? "pending" : "cancelled"}`}>{account.isOwner ? "Owner" : account.role === "admin" ? "Admin" : "ผู้ใช้"}</span></td>
                        <td>
                          {account.isOwner ? <span className="subtle">ล็อกสิทธิ์ Owner</span> : (
                            <button
                              type="button"
                              className="ghost-btn compact-btn"
                              disabled={updateUserRole.isPending}
                              onClick={() => updateUserRole.mutate({ id: account.id, role: account.role === "admin" ? "user" : "admin" })}
                            >
                              {updateUserRole.isPending ? <Loader2 size={13} className="animate-spin" /> : account.role === "admin" ? "ปลด Admin" : "เพิ่มเป็น Admin"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {updateUserRole.error && <p role="alert" style={{ color: "#fda4af", margin: "12px 0 0", fontSize: 13 }}>{updateUserRole.error.message}</p>}
            </section>
          )}

          {ordersQuery.isLoading ? <div className="loading"><Loader2 size={20} className="animate-spin" /></div> : orders.length === 0 ? <div className="empty-box">ยังไม่มีออเดอร์เข้ามา</div> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>ออเดอร์</th><th>ผู้เล่น / ยศ</th><th>ยอดชำระ</th><th>สลิป</th><th>สถานะ</th><th>หมายเหตุ</th><th>บันทึก</th></tr></thead>
                <tbody>{orders.map(order => <tr key={order.id}>
                  <td><strong>#{order.id}</strong><br /><span className="subtle">{formatDate(order.createdAt)}</span></td>
                  <td><strong>{order.minecraftIGN}</strong><br /><span className="subtle">{order.rankName}</span></td>
                  <td>{order.amount} ฿<br /><span className="subtle">{order.paymentMethod}</span></td>
                  <td><button type="button" className="ghost-btn compact-btn" onClick={() => window.open(order.slipUrl, "_blank")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>ดูสลิป <ExternalLink size={12} /></button></td>
                  <td><select value={order.status} onChange={event => updateOrder.mutate({ id: order.id, status: event.target.value as "รอตรวจสอบ" | "สำเร็จ" | "ยกเลิก", adminNotes: notes[order.id] ?? order.adminNotes })} aria-label={`สถานะออเดอร์ ${order.id}`}><option>รอตรวจสอบ</option><option>สำเร็จ</option><option>ยกเลิก</option></select><div style={{ marginTop: 7 }}><span className={`status ${statusClass(order.status)}`}>{order.status}</span></div></td>
                  <td><input className="admin-note" value={notes[order.id] ?? order.adminNotes ?? ""} placeholder="ใส่หมายเหตุ" onChange={event => setNotes(current => ({ ...current, [order.id]: event.target.value }))} /></td>
                  <td><button className="ghost-btn compact-btn" disabled={updateOrder.isPending} onClick={() => updateOrder.mutate({ id: order.id, status: order.status, adminNotes: notes[order.id] ?? order.adminNotes })}>{updateOrder.isPending ? <Loader2 size={13} className="animate-spin" /> : "บันทึก"}</button></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
