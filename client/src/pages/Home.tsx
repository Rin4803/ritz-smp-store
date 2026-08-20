import { useState, useMemo } from "react";
import { startLogin } from "@/const";
import { Link } from "wouter";
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
  Menu,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  AlertCircle,
  RefreshCcw,
  Wallet,
} from "lucide-react";

const paymentAccounts = [
  { label: "ธนาคารออมสิน", value: "020391511886", detail: "ชื่อบัญชี: ภานุสรณ์ วงศ์สุวรรณ" },
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
  const walletQuery = trpc.store.wallet.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const createTopup = trpc.store.createTopup.useMutation({
    onSuccess: result => {
      setTopupResult(result.order.id);
      setIsTopupOpen(false);
      setTopupAmount("");
      setSlipData("");
      setSlipName("");
      utils.store.myOrders.invalidate();
      utils.store.wallet.invalidate();
    },
  });

  const purchaseRank = trpc.store.purchaseRank.useMutation({
    onSuccess: result => {
      setPurchaseResult({ id: result.order.id, rankName: selectedRank?.displayName ?? "ยศ", amount: selectedRank?.price ?? "0" });
      setSelectedRank(null);
      setIgn("");
      utils.store.myOrders.invalidate();
      utils.store.wallet.invalidate();
    },
  });

  const [selectedRank, setSelectedRank] = useState<(typeof ranksQuery.data extends (infer T)[] | undefined ? T : never) | null>(null);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupPaymentMethod, setTopupPaymentMethod] = useState<"ธนาคารออมสิน" | "PromptPay" | "TrueMoney Wallet">("PromptPay");
  const [ign, setIgn] = useState("");
  const [slipData, setSlipData] = useState("");
  const [slipName, setSlipName] = useState("");
  const [slipType, setSlipType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/png");
  const [topupResult, setTopupResult] = useState<number | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{ id: number; rankName: string; amount: string } | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const ranks = ranksQuery.data ?? [];
  const rankNotice = useMemo(() => ranks.some(rank => Number(rank.price) <= 0), [ranks]);
  const walletBalance = Number(walletQuery.data?.balance ?? 0);

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
    setPurchaseResult(null);
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

  const submitTopup = (event: React.FormEvent) => {
    event.preventDefault();
    const amountNum = Number(topupAmount);
    if (!amountNum || amountNum <= 0 || !slipData) return;
    createTopup.mutate({
      amount: amountNum,
      paymentMethod: topupPaymentMethod,
      slipData,
      slipName,
      slipType,
    });
  };

  const submitPurchase = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRank || !ign.trim()) return;
    purchaseRank.mutate({
      rankId: selectedRank.id,
      minecraftIGN: ign.trim(),
    });
  };

  return (
    <div className="store-shell">
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <div className="container topbar-inner">
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "ปิดเมนูหลัก" : "เปิดเมนูหลัก"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <a className="brand" href="#top" aria-label="RitzSMP Web Store" style={{ minWidth: 0, overflow: "hidden" }}>
            <span className="brand-mark flex-shrink-0"><Crown size={21} strokeWidth={1.8} /></span>
            <span style={{ minWidth: 0, overflow: "hidden" }}>
              <span className="brand-name" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>RITZ<span className="gold-text">SMP</span></span>
              <span className="brand-sub" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Realm Official Store</span>
            </span>
          </a>
          <nav className="nav desktop-nav" aria-label="เมนูหลัก">
            <a href="#ranks">ยศทั้งหมด</a>
            <a href="#payment">ช่องทางชำระเงิน</a>
            <Link href="/servers">เลือกเซิร์ฟเวอร์</Link>
            <Link href="/account">ประวัติการซื้อ</Link>
            {user?.role === "admin" && <Link href="/admin" className="gold-text">Admin Dashboard</Link>}
          </nav>
          {authLoading ? (
            <span className="user-chip"><Loader2 size={14} className="animate-spin" /> กำลังตรวจสอบ</span>
          ) : isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="ghost-btn compact-btn"
                style={{ borderColor: "rgba(212,175,55,0.4)", color: "#d4af37", display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => {
                  setTopupResult(null);
                  setSlipData("");
                  setSlipName("");
                  setTopupAmount("");
                  setIsTopupOpen(true);
                }}
              >
                <Wallet size={14} /> เติมเงิน ({formatPrice(walletBalance)} ฿)
              </button>
              <Link href="/account" className="user-chip"><ShieldCheck size={14} className="gold-text" /> {user?.name ?? "ผู้เล่น"} <span className="account-link-label">บัญชี</span></Link>
            </div>
          ) : (
            <button className="ghost-btn compact-btn" onClick={() => startLogin()}>
              <LogIn size={14} /> เข้าสู่ระบบ
            </button>
          )}
        </div>
        {menuOpen && (
          <nav id="mobile-menu" className="mobile-menu" aria-label="เมนูหลักบนมือถือ">
            {isAuthenticated && (
              <div className="wallet-summary" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="wallet-summary-label"><CreditCard size={15} /> ยอดเงินคงเหลือ</span>
                  <strong>{walletQuery.isLoading ? "กำลังโหลด…" : `${formatPrice(walletBalance)} ฿`}</strong>
                </div>
                <button
                  type="button"
                  className="primary-btn compact-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => {
                    setMenuOpen(false);
                    setTopupResult(null);
                    setSlipData("");
                    setSlipName("");
                    setTopupAmount("");
                    setIsTopupOpen(true);
                  }}
                >
                  <Wallet size={14} /> เติมเงินเข้ากระเป๋า
                </button>
              </div>
            )}
            <a href="#ranks" onClick={() => setMenuOpen(false)}>ยศทั้งหมด</a>
            <a href="#payment" onClick={() => setMenuOpen(false)}>ช่องทางชำระเงิน</a>
            <Link href="/servers" onClick={() => setMenuOpen(false)}>เลือกเซิร์ฟเวอร์</Link>
            <Link href="/account" onClick={() => setMenuOpen(false)}>ประวัติการซื้อและยอดคงเหลือ</Link>
            {user?.role === "admin" && <Link href="/admin" className="gold-text" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>}
            {!authLoading && (isAuthenticated ? (
              <Link href="/account" className="mobile-menu-login" onClick={() => setMenuOpen(false)}><ShieldCheck size={15} /> บัญชีของฉัน</Link>
            ) : (
              <button type="button" className="mobile-menu-login" onClick={() => { setMenuOpen(false); startLogin(); }}><LogIn size={15} /> เข้าสู่ระบบ</button>
            ))}
          </nav>
        )}
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <div className="eyebrow">RitzSMP / Official Realm Sanctuary</div>
              <h1>ยกระดับการเล่นเกมของคุณ<span>ในอาณาจักรที่เป็นของคุณ</span></h1>
              <p className="hero-lead">สนับสนุนเซิร์ฟเวอร์ RitzSMP พร้อมปลดล็อกยศและสถานะพิเศษ เติมเงินเข้ากระเป๋าด้วยสลิปโอนเงิน แล้วใช้ยอดเงินในกระเป๋าซื้อยศได้ทันทีโดยไม่ต้องแนบสลิปซ้ำ</p>
              <div className="hero-actions">
                <a className="primary-btn" href="#ranks">เลือกยศสนับสนุน <ArrowRight size={16} /></a>
                {isAuthenticated ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setTopupResult(null);
                      setSlipData("");
                      setSlipName("");
                      setTopupAmount("");
                      setIsTopupOpen(true);
                    }}
                  >
                    <Wallet size={16} /> เติมเงินเข้ากระเป๋า ({formatPrice(walletBalance)} ฿)
                  </button>
                ) : (
                  <button className="ghost-btn" onClick={() => startLogin()}><CreditCard size={16} /> เข้าสู่ระบบเพื่อเติมเงิน</button>
                )}
              </div>
              <div className="hero-note">
                <Sparkles size={14} className="gold-text" /> เติมเงินแนบสลิปครั้งเดียว ซื้อยศหักกระเป๋าออโต้ส่งเข้าเซิร์ฟเวอร์ทันที
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="float-badge one"><CheckCircle2 size={15} className="gold-text" /> ระบบ Wallet สะดวก</div>
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
              <p className="section-description">เลือกยศที่คุณต้องการเพื่อสนับสนุนการพัฒนาเซิร์ฟเวอร์ RitzSMP ระบบจะหักยอดเงินจากกระเป๋าของคุณอัตโนมัติทันที</p>
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
                          {!isFreeTemplate ? "ซื้อยศ" : "Template"} <ArrowRight size={14} />
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
                  <span>ช่องทางการโอนเงินเพื่อเติมเข้ากระเป๋า</span>
                </div>
                <p className="payment-sub">โอนเงินผ่านบัญชีธนาคารหรือพร้อมเพย์ด้านล่าง จากนั้นกดปุ่ม "เติมเงิน" ด้านบนเพื่อระบุยอดและแนบสลิป เมื่อแอดมินตรวจสอบแล้วยอดเงินจะเข้ากระเป๋าอัตโนมัติ</p>
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
                <p>ยังไม่มีประวัติการสั่งซื้อ เติมเงินเข้ากระเป๋าและเลือกซื้อยศที่คุณต้องการได้เลย</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <strong>RITZ<span className="gold-text">SMP</span> · Official Realm Sanctuary</strong>
          <span>ระบบร้านค้าออนไลน์อย่างเป็นทางการ เติมเงินและซื้อยศอัตโนมัติผ่าน RCON และ Wallet</span>
        </div>
      </footer>

      {toastMessage && (
        <div className="modal-backdrop" style={{ background: "transparent", pointerEvents: "none" }}>
          <div className="user-chip" style={{ pointerEvents: "auto", position: "fixed", bottom: 28, zIndex: 100 }}>
            {toastMessage}
          </div>
        </div>
      )}

      {/* Topup Modal */}
      {isTopupOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="topup-title">
            <div className="modal-head">
              <div>
                <div className="eyebrow">Wallet Top-up</div>
                <h2 className="modal-title" id="topup-title">เติมเงินเข้ากระเป๋า RitzSMP</h2>
                <p className="subtle" style={{ margin: "7px 0 0", fontSize: 12 }}>ยอดเงินคงเหลือปัจจุบัน: {formatPrice(walletBalance)} บาท</p>
              </div>
              <button className="close-btn" type="button" onClick={() => setIsTopupOpen(false)} aria-label="ปิด">
                <X size={17} />
              </button>
            </div>
            <form className="form-grid" onSubmit={submitTopup}>
              <label className="form-label">
                จำนวนเงินที่ต้องการเติม (บาท)
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100000"
                  className="form-control"
                  value={topupAmount}
                  onChange={event => setTopupAmount(event.target.value)}
                  placeholder="เช่น 100"
                  required
                />
              </label>

              <label className="form-label">
                เลือกช่องทางที่โอนเงิน
                <select
                  className="form-control"
                  value={topupPaymentMethod}
                  onChange={event => setTopupPaymentMethod(event.target.value as typeof topupPaymentMethod)}
                >
                  <option value="PromptPay">PromptPay / TrueMoney (0930286252)</option>
                  <option value="ธนาคารออมสิน">ธนาคารออมสิน (020391511886)</option>
                </select>
              </label>
              <div className="form-help">
                บัญชีออมสิน: 020391511886 · พร้อมเพย์/วอเลท: 0930286252
              </div>

              <label className="form-label">
                อัปโหลดสลิปหลักฐานการโอนเงิน
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

              {createTopup.error && (
                <div className="form-error">
                  <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  {createTopup.error.message}
                </div>
              )}

              <div className="form-help">
                <FileCheck2 size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                เมื่อแอดมินตรวจสอบสลิปเรียบร้อย ยอดเงินจะถูกเติมเข้ากระเป๋าของคุณทันที
              </div>

              <div className="modal-actions">
                <button className="ghost-btn compact-btn" type="button" onClick={() => setIsTopupOpen(false)}>
                  ยกเลิก
                </button>
                <button className="primary-btn compact-btn" type="submit" disabled={createTopup.isPending || !slipData || !topupAmount}>
                  {createTopup.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                  ยืนยันแจ้งเติมเงิน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rank Purchase Modal (Wallet Deduction without Slip) */}
      {selectedRank && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="order-title">
            <div className="modal-head">
              <div>
                <div className="eyebrow">Wallet Realm Purchase</div>
                <h2 className="modal-title" id="order-title">ซื้อยศ {selectedRank.displayName}</h2>
                <p className="subtle" style={{ margin: "7px 0 0", fontSize: 12 }}>
                  ราคา {formatPrice(selectedRank.price)} บาท · กระเป๋าของคุณ: <strong style={{ color: walletBalance >= Number(selectedRank.price) ? "#4ade80" : "#f87171" }}>{formatPrice(walletBalance)} ฿</strong>
                </p>
              </div>
              <button className="close-btn" type="button" onClick={() => setSelectedRank(null)} aria-label="ปิด">
                <X size={17} />
              </button>
            </div>
            <form className="form-grid" onSubmit={submitPurchase}>
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

              <div className="form-help" style={{ background: "rgba(212,175,55,0.08)", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(212,175,55,0.2)" }}>
                <Sparkles size={14} className="gold-text" style={{ verticalAlign: "-2px", marginRight: 5 }} />
                ระบบจะหักเงินจากกระเป๋าของคุณทันที <strong>{formatPrice(selectedRank.price)} ฿</strong> โดย<strong>ไม่ต้องแนบสลิป</strong> และส่งยศเข้าเซิร์ฟเวอร์เกมผ่าน RCON อัตโนมัติ
              </div>

              {walletBalance < Number(selectedRank.price) && (
                <div className="form-error" style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.4)", color: "#f87171" }}>
                  <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  ยอดเงินในกระเป๋าของคุณไม่พอ กรุณากดปุ่มเติมเงินด้านบนก่อนซื้อยศ
                </div>
              )}

              {purchaseRank.error && (
                <div className="form-error">
                  <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  {purchaseRank.error.message}
                </div>
              )}

              <div className="modal-actions">
                <button className="ghost-btn compact-btn" type="button" onClick={() => setSelectedRank(null)}>
                  ยกเลิก
                </button>
                <button
                  className="primary-btn compact-btn"
                  type="submit"
                  disabled={purchaseRank.isPending || !ign.trim() || walletBalance < Number(selectedRank.price)}
                >
                  {purchaseRank.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  ยืนยันซื้อยศ (หักกระเป๋า)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Topup Success Modal */}
      {topupResult && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="form-success" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={20} className="gold-text" />
              <strong>แจ้งเติมเงินออเดอร์ #${topupResult} สำเร็จแล้ว</strong>
            </div>
            <p className="subtle" style={{ margin: "14px 0", lineHeight: 1.8, fontSize: 13 }}>
              ระบบได้ส่งสลิปและบันทึกคำขอเติมเงินของคุณไปยังแอดมินเรียบร้อยแล้ว เมื่อแอดมินตรวจสอบการโอนเงินเรียบร้อย ยอดเงินจะเข้าสู่กระเป๋าของคุณทันที
            </p>
            <div className="modal-actions">
              <button className="primary-btn compact-btn" onClick={() => setTopupResult(null)}>
                รับทราบและปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Section */}
      <section className="section" style={{ background: "rgba(15,23,42,0.4)", borderTop: "1px solid rgba(212,175,55,0.15)", borderBottom: "1px solid rgba(212,175,55,0.15)", padding: "50px 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="eyebrow" style={{ justifyContent: "center" }}>RitzSMP Regulations</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: "8px 0 0" }}>📜 กฎระเบียบเซิร์ฟเวอร์ RitzSMP</h2>
            <p className="subtle" style={{ maxWidth: 600, margin: "8px auto 0" }}>เพื่อสังคมเกมที่สนุกและยุติธรรมสำหรับผู้เล่นทุกคน กรุณาศึกษาและปฏิบัติตามกฎระเบียบอย่างเคร่งครัด</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 24, borderLeft: "4px solid #f87171" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(248,113,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontWeight: 700 }}>1</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>ห้ามใช้โปรโกง (No Cheating)</h3>
              </div>
              <p className="subtle" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                ห้ามใช้ X-Ray, โปรบิน, KillAura หรือ Mod โกงทุกชนิด (วัดกันด้วยฝีมือล้วนๆ)
              </p>
            </div>

            <div className="card" style={{ padding: 24, borderLeft: "4px solid #fbbf24" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(251,191,36,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24", fontWeight: 700 }}>2</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>ห้ามทำเซิร์ฟค้าง (No Lag Machine)</h3>
              </div>
              <p className="subtle" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                ห้ามสร้างวงจรรูปแบบที่ตั้งใจทำให้เซิร์ฟเวอร์กระตุกหรือหลุด
              </p>
            </div>

            <div className="card" style={{ padding: 24, borderLeft: "4px solid #38bdf8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", fontWeight: 700 }}>3</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>ด่าในเกมได้ ห้ามลามชีวิตจริง (No Harassment)</h3>
              </div>
              <p className="subtle" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                ปล้น/ฆ่ากันในเกมได้เต็มที่ แต่ห้ามเหยียดหรือคุกคามกันนอกเกมในช่องแชท
              </p>
            </div>
          </div>

          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", padding: "18px 24px", textAlign: "center" }}>
            <span style={{ color: "#f87171", fontWeight: 700, fontSize: 16 }}>⚡ บทลงโทษ:</span>
            <span style={{ color: "#e2e8f0", fontSize: 15, marginLeft: 8 }}>ใช้โปร หรือทำเซิร์ฟค้าง = <strong>แบนถาวรทันที</strong></span>
          </div>
        </div>
      </section>

      {/* Purchase Success Modal */}
      {purchaseResult && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="form-success" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={20} className="gold-text" />
              <strong>ซื้อยศ {purchaseResult.rankName} สำเร็จแล้ว! (ออเดอร์ #{purchaseResult.id})</strong>
            </div>
            <p className="subtle" style={{ margin: "14px 0", lineHeight: 1.8, fontSize: 13 }}>
              ระบบได้หักยอดเงิน <strong>{formatPrice(purchaseResult.amount)} ฿</strong> จากกระเป๋าของคุณเรียบร้อย และดำเนินการส่งคำสั่งมอบยศเข้าเซิร์ฟเวอร์เกมผ่าน RCON อัตโนมัติแล้ว
            </p>
            <div className="modal-actions">
              <Link href="/account" className="primary-btn compact-btn" onClick={() => setPurchaseResult(null)}>
                ดูประวัติการซื้อและยอดเงิน
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
