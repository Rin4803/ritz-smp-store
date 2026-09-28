import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock3, Crown, ExternalLink, Loader2, LogIn, LogOut, ShieldAlert, UserCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { LocalAuthDialog } from "@/components/LocalAuthDialog";
import { useState } from "react";

function formatPrice(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—";
}

function formatDate(value: Date | string | number) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(status: string) {
  if (status === "สำเร็จ") return "success";
  if (status === "ยกเลิก") return "cancelled";
  return "pending";
}

export default function Account() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const ordersQuery = trpc.store.myOrders.useQuery(undefined, { enabled: isAuthenticated });
  const walletQuery = trpc.store.wallet.useQuery(undefined, { enabled: isAuthenticated });
  const orders = ordersQuery.data ?? [];
  const wallet = walletQuery.data ?? { balance: "0.00", transactions: [] };

  if (authLoading) {
    return <div className="store-shell"><div className="loading"><Loader2 size={20} className="animate-spin" /> กำลังตรวจสอบบัญชี...</div></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="store-shell">
        <div className="noise" aria-hidden="true" />
        <main className="account-shell">
          <div className="container account-narrow">
            <Link href="/" className="eyebrow account-back"><ArrowLeft size={13} /> กลับหน้าร้าน</Link>
            <div className="account-card account-login-card">
              <UserCircle size={42} className="gold-text" />
              <div>
                <div className="eyebrow">Player Account</div>
                <h1 className="account-title">เข้าสู่ระบบเพื่อดูบัญชีของคุณ</h1>
                <p className="subtle">ตรวจสอบประวัติการซื้อ สถานะออเดอร์ และข้อมูลการมอบยศได้จากหน้านี้</p>
              </div>
              <button className="primary-btn" onClick={() => setAuthDialogOpen(true)}><LogIn size={16} /> เข้าสู่ระบบ</button>
            </div>
          </div>
          <LocalAuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        </main>
      </div>
    );
  }

  return (
    <div className="store-shell">
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <div className="container topbar-inner">
          <Link className="brand" href="/" aria-label="RitzSMP Web Store">
            <span className="brand-mark"><Crown size={21} strokeWidth={1.8} /></span>
            <span><span className="brand-name">RITZ<span className="gold-text">SMP</span></span><span className="brand-sub">Realm Official Store</span></span>
          </Link>
          <Link className="ghost-btn compact-btn" href="/"><ArrowLeft size={14} /> กลับหน้าร้าน</Link>
        </div>
      </header>
      <main className="account-shell">
        <div className="container">
          <div className="account-head">
            <div>
              <div className="eyebrow">Player Account</div>
              <h1 className="account-title">บัญชีของฉัน</h1>
              <p className="subtle">จัดการข้อมูลบัญชีและติดตามคำสั่งซื้อ RitzSMP</p>
            </div>
            <button className="danger-btn compact-btn" onClick={() => void logout()}><LogOut size={14} /> ออกจากระบบ</button>
          </div>

          <section className="account-grid" aria-label="ข้อมูลบัญชี">
            <div className="account-card profile-card">
              <div className="profile-icon"><UserCircle size={28} /></div>
              <div>
                <div className="eyebrow">Signed in as</div>
                <h2>{user?.name ?? "ผู้เล่น RitzSMP"}</h2>
                <p className="subtle">{user?.email ?? "บัญชีที่เข้าสู่ระบบแล้ว"}</p>
              </div>
              <span className={`role-pill ${user?.role === "admin" ? "admin" : ""}`}>
                {user?.role === "admin" ? <><CheckCircle2 size={12} /> Admin</> : <><ShieldAlert size={12} /> Player</>}
              </span>
            </div>
            <div className="account-card balance-card" style={{ background: "rgba(20,20,28,0.8)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "12px", padding: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="eyebrow" style={{ color: "#d4af37" }}>Wallet Balance</div>
                {walletQuery.isLoading ? (
                  <h2 style={{ fontSize: "1.5rem", color: "#fff", margin: "0.2rem 0" }}><Loader2 size={18} className="animate-spin" /> กำลังโหลด...</h2>
                ) : walletQuery.isError ? (
                  <h2 style={{ fontSize: "1.2rem", color: "#f87171", margin: "0.2rem 0" }}>ไม่สามารถโหลดได้</h2>
                ) : (
                  <h2 style={{ fontSize: "1.8rem", color: "#fff", margin: "0.2rem 0" }}>{formatPrice(wallet.balance)} ฿</h2>
                )}
                <p className="subtle" style={{ margin: 0, fontSize: "0.85rem" }}>ยอดเงินคงเหลือสำหรับซื้อยศและบริการในเซิร์ฟเวอร์</p>
              </div>
              <div aria-hidden="true" />
            </div>
          </section>

          <section className="account-orders">
            <div className="section-head">
              <div><div className="eyebrow">Purchase History</div><h2 className="section-title">ประวัติการซื้อ</h2></div>
              <span className="order-count">{orders.length} รายการ</span>
            </div>
            {ordersQuery.isLoading ? (
              <div className="loading"><Loader2 size={20} className="animate-spin" /> กำลังโหลดประวัติออเดอร์...</div>
            ) : ordersQuery.isError ? (
              <div className="empty-box">ไม่สามารถโหลดประวัติออเดอร์ได้ กรุณาลองใหม่อีกครั้ง</div>
            ) : orders.length === 0 ? (
              <div className="empty-box">ยังไม่มีประวัติการซื้อ <Link href="/" className="gold-text">กลับไปเลือกยศที่หน้าร้าน</Link></div>
            ) : (
              <div className="order-list">
                {orders.map(order => (
                  <article className="account-order-row" key={order.id}>
                    <div className="account-order-main"><span className="order-id">ออเดอร์ #{order.id}</span><strong>{order.rankName}</strong><span>ชื่อในเกม: {order.minecraftIGN}</span></div>
                    <div className="account-order-meta"><strong>{formatPrice(order.amount)} ฿</strong><span>{order.paymentMethod}</span></div>
                    <div><span className={`status ${statusClass(order.status)}`}>{order.status === "รอตรวจสอบ" ? <Clock3 size={12} /> : <CheckCircle2 size={12} />}{order.status}</span><span className="order-date">{formatDate(order.createdAt)}</span></div>
                    <button type="button" className="order-slip" onClick={() => window.open(order.slipUrl, "_blank")} style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>ดูสลิป <ExternalLink size={12} /></button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="account-orders" style={{ marginTop: "2rem" }}>
            <div className="section-head">
              <div><div className="eyebrow">Wallet Ledger</div><h2 className="section-title">ประวัติธุรกรรมยอดเงิน</h2></div>
              <span className="order-count">{wallet.transactions.length} รายการ</span>
            </div>
            {walletQuery.isLoading ? (
              <div className="loading"><Loader2 size={20} className="animate-spin" /> กำลังโหลดประวัติธุรกรรม...</div>
            ) : walletQuery.isError ? (
              <div className="empty-box">ไม่สามารถโหลดประวัติธุรกรรมได้ กรุณาลองใหม่อีกครั้ง</div>
            ) : wallet.transactions.length === 0 ? (
              <div className="empty-box">ยังไม่มีประวัติธุรกรรมยอดเงิน</div>
            ) : (
              <div className="order-list">
                {wallet.transactions.map(tx => (
                  <article className="account-order-row" key={tx.id}>
                    <div className="account-order-main">
                      <span className="order-id">ธุรกรรม #{tx.id}</span>
                      <strong>{tx.type === "topup" ? "เติมเงินเข้ากระเป๋า" : tx.type === "purchase" ? "ซื้อยศ/สินค้า" : "ปรับยอดเงิน"}</strong>
                      <span className="subtle">{tx.description}</span>
                    </div>
                    <div className="account-order-meta">
                      <strong style={{ color: Number(tx.amount) >= 0 ? "#4ade80" : "#f87171" }}>
                        {Number(tx.amount) >= 0 ? "+" : ""}{formatPrice(tx.amount)} ฿
                      </strong>
                    </div>
                    <div>
                      <span className="order-date">{formatDate(tx.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
