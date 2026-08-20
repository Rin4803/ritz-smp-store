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
  const utils = trpc.useUtils();
  const updateOrder = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => utils.admin.orders.invalidate(),
  });
  const updateUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => utils.admin.users.invalidate(),
  });
  const [notes, setNotes] = useState<Record<number, string>>({});

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
