import { useMemo, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Crown,
  FileCheck2,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";

const paymentAccounts = [
  { label: "ธนาคารออมสิน", value: "020391511886", detail: "ชื่อบัญชี: กานต์ธนภรณ์ วงศ์สุวรรณ" },
  { label: "PromptPay / TrueMoney", value: "0930286252", detail: "พร้อมเพย์และวอเลทสำหรับการสนับสนุน RitzSMP" },
];

function parseFeatures(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatPrice(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—";
}

function formatDate(value: Date | string | number) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function statusBadgeClass(status: string) {
  if (status === "สำเร็จ") return "success";
  if (status === "ยกเลิก") return "cancelled";
  return "pending";
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const ranksQuery = trpc.store.ranks.useQuery();
  const ordersQuery = trpc.store.myOrders.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const createOrder = trpc.store.createOrder.useMutation({
    onSuccess: result => {
      setOrderResult(result.order.id);
      setSelectedRank(null);
      setIgn("");
      setSlipData("");
      setSlipName("");
      setPaymentMethod("PromptPay");
      utils.store.myOrders.invalidate();
    },
  });

  const [selectedRank, setSelectedRank] = useState<(typeof ranksQuery.data extends (infer T)[] | undefined ? T : never) | null>(null);
  const [ign, setIgn] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"ธนาคารออมสิน" | "PromptPay" | "TrueMoney Wallet">("PromptPay");
  const [slipData, setSlipData] = useState("");
  const [slipName, setSlipName] = useState("");
  const [slipType, setSlipType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/png");
  const [orderResult, setOrderResult] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const ranks = ranksQuery.data ?? [];
  const rankNotice = useMemo(() => ranks.some(rank => Number(rank.price) <= 0), [ranks]);

  const copyAccount = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToastMessage(`คัดลอก ${value} เรียบร้อยแล้ว`);
      window.setTimeout(() => setToastMessage(""), 2000);
    } catch {
      setToastMessage(value);
    }
  };

  const openOrder = (rank: (typeof ranks)[number]) => {
    setOrderResult(null);
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    setSelectedRank(rank);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setToastMessage("รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setToastMessage("ไฟล์สลิปต้องมีขนาดไม่เกิน 6 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSlipData(String(reader.result));
      setSlipName(file.name);
      setSlipType(file.type as "image/jpeg" | "image/png" | "image/webp");
    };
    reader.readAsDataURL(file);
  };

  const submitOrder = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRank || !slipData) return;
    createOrder.mutate({
      rankId: selectedRank.id,
      minecraftIGN: ign,
      paymentMethod,
      slipData,
      slipName,
      slipType,
    });
  };

  return (
    <div className="store-shell">
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" href="#top" aria-label="RitzSMP Web Store">
            <span className="brand-mark"><Crown size={21} strokeWidth={1.8} /></span>
            <span>
              <span className="brand-name">RITZ<span className="gold-text">SMP</span></span>
              <span className="brand-sub">Realm Official Store</span>
            </span>
          </a>
          <nav className="nav" aria-label="เมนูหลัก">
            <a href="#ranks">ยศทั้งหมด</a>
            <a href="#payment">ช่องทางชำระเงิน</a>
            <a href="#orders">ประวัติออเดอร์</a>
            {user?.role === "admin" && <a href="/admin" className="gold-text">Admin Dashboard</a>}
          </nav>
          {authLoading ? (
            <span className="user-chip"><Loader2 size={14} className="animate-spin" /> กำลังตรวจสอบ</span>
          ) : isAuthenticated ? (
            <span className="user-chip"><ShieldCheck size={14} className="gold-text" /> {user?.name ?? "ผู้เล่น"}</span>
          ) : (
            <button className="ghost-btn compact-btn" onClick={() => startLogin()}>
              <LogIn size={14} /> เข้าสู่ระบบ
            </button>
          )}
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <div className="eyebrow">RitzSMP / Official Realm Sanctuary</div>
              <h1>ยกระดับการเล่นเกมของคุณ<span>ในอาณาจักรที่เป็นของคุณ</span></h1>
              <p className="hero-lead">สนับสนุนเซิร์ฟเวอร์ RitzSMP พร้อมปลดล็อกยศและสถานะพิเศษที่คัดสรรมาเพื่อผู้เล่นระดับแถวหน้า โอนเงินผ่านระบบธนาคารหรือพร้อมเพย์ แล้วส่งสลิปให้ทีมงานตรวจสอบความถูกต้องทันที</p>
              <div className="hero-actions">
                <a className="primary-btn" href="#ranks">เลือกยศสนับสนุน <ArrowRight size={16} /></a>
                <a className="ghost-btn" href="#payment"><CreditCard size={16} /> ดูช่องทางโอนเงิน</a>
              </div>
              <div className="hero-note">
                <Sparkles size={14} className="gold-text" /> ออเดอร์ทั้งหมดจะได้รับการตรวจสอบสถานะโดยแอดมินก่อนมอบสิทธิ์อัตโนมัติ
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="float-badge one"><CheckCircle2 size={15} className="gold-text" /> ตรวจสอบสลิปปลอดภัย</div>
              <div className="hero-card">
                <div className="hero-card-inner">
                  <div className="crown"><Crown size={48} strokeWidth={1.25} /></div>
                  <div>
                    <div className="hero-card-label">Realm Prestige</div>
                    <div className="hero-card-title">Ritz Royal</div>
                    <div className="hero-card-price">Ultimate Tier</div>
                  </div>
                </div>
              </div>
              <div className="float-badge two"><ShieldCheck size={15} className="gold-text" /> สิทธิ์พิเศษในเกม</div>
            </div>
          </div>
        </section>

        <section className="section" id="ranks">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">Realm Ranks Catalog</div>
                <h2 className="section-title">ยศและสถานะผู้สนับสนุน</h2>
              </div>
              <p className="section-description">เลือกยศที่คุณต้องการเพื่อสนับสนุนการพัฒนาเซิร์ฟเวอร์ RitzSMP พร้อมรับสิทธิพิเศษภายในเกมทันทีเมื่อแอดมินตรวจสอบออเดอร์สำเร็จ</p>
            </div>

            {ranksQuery.isLoading ? (
              <div className="loading"><Loader2 className="animate-spin" size={24} /> กำลังโหลดรายการยศ...</div>
            ) : ranksQuery.isError ? (
              <div className="empty-box" style={{ borderColor: "rgba(181,77,82,.3)" }}>
                <AlertCircle size={24} style={{ color: "#ff9a94", marginBottom: 8 }} />
                <p>ไม่สามารถโหลดรายการยศได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</p>
                <button className="ghost-btn compact-btn" style={{ marginTop: 12 }} onClick={() => ranksQuery.refetch()}>
                  <RefreshCcw size={14} /> โหลดใหม่
                </button>
              </div>
            ) : (
              <div className="rank-grid">
                {ranks.map((rank, index) => {
                  const features = parseFeatures(rank.features);
                  const isFreeTemplate = Number(rank.price) <= 0;
                  return (
                    <article key={rank.id} className={`rank-card ${rank.color} ${index === 1 ? "featured" : ""}`}>
                      <span className="rank-ribbon">{rank.badge}</span>
                      <div className="rank-icon"><Crown size={23} strokeWidth={1.7} /></div>
                      <div className="rank-name">{rank.displayName}</div>
                      <p className="rank-description">{rank.description}</p>
                      <ul className="feature-list">
                        {features.map(feature => (
                          <li key={feature}><Check size={14} /> <span>{feature}</span></li>
                        ))}
                      </ul>
                      <div className="rank-bottom">
                        <div className="price">
                          {!isFreeTemplate ? `${formatPrice(rank.price)} ฿` : "รอกำหนดราคา"}
                          <small>{rank.duration}</small>
                        </div>
                        <button
                          className="primary-btn compact-btn"
                          onClick={() => openOrder(rank)}
                          disabled={isFreeTemplate}
                        >
                          {!isFreeTemplate ? "สั่งซื้อ" : "Template"} <ArrowRight size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {rankNotice && (
              <div className="hero-note" style={{ marginTop: 28 }}>
                <Sparkles size={14} className="gold-text" /> หมายเหตุ: ยศบางรายการอยู่ในสถานะ Template แอดมินสามารถกำหนดราคาจริงได้ทันที
              </div>
            )}
          </div>
        </section>

        <section className="section" id="payment">
          <div className="container">
            <div className="payment-strip">
              <div>
                <div className="payment-heading">
                  <span className="payment-heading-icon"><CreditCard size={18} /></span>
                  <span>ช่องทางการโอนเงิน RitzSMP</span>
                </div>
                <p className="payment-sub">โอนเงินผ่านบัญชีธนาคารหรือพร้อมเพย์ด้านล่าง จากนั้นบันทึกสลิปหลักฐานการโอนเพื่อแนบในขั้นตอนการสั่งซื้อ ระบบจะบันทึกและส่งแจ้งเตือนทีมงานทันที</p>
              </div>
              <div className="payment-options">
                {paymentAccounts.map(account => (
                  <button type="button" className="payment-chip" key={account.label} onClick={() => copyAccount(account.value)}>
                    <strong>{account.label}</strong>
                    <span>{account.value}</span>
                    <small>{account.detail}</small>
                    <span className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 10 }}>
                      <Copy size={11} /> คลิกเพื่อคัดลอก
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="orders">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">Player Orders History</div>
                <h2 className="section-title">ประวัติออเดอร์ของคุณ</h2>
              </div>
              {!isAuthenticated && (
                <button className="ghost-btn compact-btn" onClick={() => startLogin()}>
                  <LogIn size={14} /> เข้าสู่ระบบเพื่อดูประวัติ
                </button>
              )}
            </div>

            {!isAuthenticated ? (
              <div className="empty-box">
                <LogIn size={22} className="gold-text" style={{ marginBottom: 8 }} />
                <p>กรุณาเข้าสู่ระบบด้วยบัญชีของคุณเพื่อตรวจสอบสถานะออเดอร์และการจัดส่งยศ</p>
              </div>
            ) : ordersQuery.isLoading ? (
              <div className="loading"><Loader2 className="animate-spin" size={24} /> กำลังโหลดประวัติออเดอร์ของคุณ...</div>
            ) : ordersQuery.isError ? (
              <div className="empty-box" style={{ borderColor: "rgba(181,77,82,.3)" }}>
                <AlertCircle size={24} style={{ color: "#ff9a94", marginBottom: 8 }} />
                <p>ไม่สามารถดึงข้อมูลประวัติออเดอร์ได้ กรุณาลองใหม่อีกครั้ง</p>
                <button className="ghost-btn compact-btn" style={{ marginTop: 12 }} onClick={() => ordersQuery.refetch()}>
                  <RefreshCcw size={14} /> โหลดใหม่
                </button>
              </div>
            ) : ordersQuery.data?.length ? (
              <div className="order-list">
                {ordersQuery.data.map(order => (
                  <div className="order-row" key={order.id}>
                    <div>
                      <strong>#{order.id} · {order.rankName}</strong>
                      <span>IGN: {order.minecraftIGN}</span>
                    </div>
                    <div>
                      <strong>{formatPrice(order.amount)} ฿</strong>
                      <span>{order.paymentMethod}</span>
                    </div>
                    <div>
                      <span className={`status ${statusBadgeClass(order.status)}`}>{order.status}</span>
                    </div>
                    <div>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-box">
                <p>ยังไม่มีประวัติการสั่งซื้อ เลือกยศที่คุณต้องการสนับสนุนจากแคตตาล็อกด้านบนเพื่อเริ่มต้นได้เลย</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <strong>RITZ<span className="gold-text">SMP</span> · Official Realm Sanctuary</strong>
          <span>ระบบร้านค้าออนไลน์อย่างเป็นทางการ ตรวจสอบสลิปและมอบสิทธิ์โดยทีมงานแอดมิน RitzSMP</span>
        </div>
      </footer>

      {toastMessage && (
        <div className="modal-backdrop" style={{ background: "transparent", pointerEvents: "none" }}>
          <div className="user-chip" style={{ pointerEvents: "auto", position: "fixed", bottom: 28, zIndex: 100 }}>
            {toastMessage}
          </div>
        </div>
      )}

      {selectedRank && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="order-title">
            <div className="modal-head">
              <div>
                <div className="eyebrow">Secure Realm Checkout</div>
                <h2 className="modal-title" id="order-title">ยืนยันสั่งซื้อ {selectedRank.displayName}</h2>
                <p className="subtle" style={{ margin: "7px 0 0", fontSize: 12 }}>ยอดชำระ {formatPrice(selectedRank.price)} บาท · ระยะเวลา: {selectedRank.duration}</p>
              </div>
              <button className="close-btn" type="button" onClick={() => setSelectedRank(null)} aria-label="ปิด">
                <X size={17} />
              </button>
            </div>
            <form className="form-grid" onSubmit={submitOrder}>
              <label className="form-label">
                ชื่อในเกม (Minecraft IGN)
                <input
                  className="form-control"
                  value={ign}
                  onChange={event => setIgn(event.target.value)}
                  placeholder="เช่น RitzPlayer"
                  minLength={3}
                  maxLength={64}
                  required
                />
              </label>

              <label className="form-label">
                เลือกช่องทางที่โอนเงิน
                <select
                  className="form-control"
                  value={paymentMethod}
                  onChange={event => setPaymentMethod(event.target.value as typeof paymentMethod)}
                >
                  <option value="PromptPay">PromptPay / TrueMoney (0930286252)</option>
                  <option value="ธนาคารออมสิน">ธนาคารออมสิน (020391511886)</option>
                </select>
              </label>
              <div className="form-help">
                บัญชีออมสิน: 020391511886 · พร้อมเพย์/วอเลท: 0930286252
              </div>

              <label className="form-label">
                อัปโหลดสลิปหลักฐานการโอน
                <div className="file-drop">
                  <Upload size={22} className="gold-text" style={{ marginBottom: 6 }} />
                  <span>{slipName || "คลิกหรือลากไฟล์สลิปมาวางที่นี่"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={event => handleFile(event.target.files?.[0])}
                    required
                  />
                </div>
              </label>

              {createOrder.error && (
                <div className="form-error">
                  <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  {createOrder.error.message}
                </div>
              )}

              <div className="form-help">
                <FileCheck2 size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                รองรับไฟล์ JPG, PNG และ WEBP ขนาดไม่เกิน 6 MB สลิปของคุณจะถูกเก็บในระบบเพื่อตรวจสอบโดยทีมงานเท่านั้น
              </div>

              <div className="modal-actions">
                <button className="ghost-btn compact-btn" type="button" onClick={() => setSelectedRank(null)}>
                  ยกเลิก
                </button>
                <button className="primary-btn compact-btn" type="submit" disabled={createOrder.isPending || !slipData}>
                  {createOrder.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
                  ยืนยันการสั่งซื้อ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderResult && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="form-success" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={20} className="gold-text" />
              <strong>ส่งคำสั่งซื้อออเดอร์ #{orderResult} สำเร็จแล้ว</strong>
            </div>
            <p className="subtle" style={{ margin: "14px 0", lineHeight: 1.8, fontSize: 13 }}>
              ระบบได้บันทึกออเดอร์และส่งสลิปของคุณไปยังทีมงานแอดมิน RitzSMP เรียบร้อยแล้ว คุณสามารถตรวจสอบสถานะการตรวจสอบได้ที่หัวข้อประวัติออเดอร์
            </p>
            <div className="modal-actions">
              <button className="primary-btn compact-btn" onClick={() => setOrderResult(null)}>
                รับทราบและปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
