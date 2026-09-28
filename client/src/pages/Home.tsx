import { useState, useMemo } from "react";
import { startLogin } from "@/const";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getRankPresentation } from "@/lib/rankPresentation";
import confetti from "canvas-confetti";
import {
  Activity,
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
  Search,
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

function playCelebrationFanfare() {
  try {
    // Respect reduced motion / user preferences if desired
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    // Trigger confetti burst
    if (!prefersReducedMotion) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#d4af37", "#facc15", "#60a5fa", "#f43f5e", "#ffffff"]
      });
    }

    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.12);
      osc.stop(ctx.currentTime + index * 0.12 + 0.4);
    });
  } catch {
    // Ignore audio/confetti restrictions gracefully
  }
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
      setTopupDiscordSent(result.discordNotification?.sent === true);
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
      setPurchaseResult({
        id: result.order.id,
        rankName: selectedRank?.displayName ?? "ยศ",
        amount: selectedRank?.price ?? "0",
        rconExecuted: result.rconExecuted === true,
      });
      setSelectedRank(null);
      setIgn("");
      playCelebrationFanfare();
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
  const [topupDiscordSent, setTopupDiscordSent] = useState<boolean | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{ id: number; rankName: string; amount: string; rconExecuted: boolean } | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState<"all" | "budget" | "mid" | "prestige">("all");
  const [menuOpen, setMenuOpen] = useState(false);

  const ranks = ranksQuery.data ?? [];
  const rankNotice = useMemo(() => ranks.some(rank => Number(rank.price) <= 0), [ranks]);
  const featuredRankId = useMemo(() => {
    const purchasableRanks = ranks.filter(rank => Number(rank.price) > 0);
    return purchasableRanks.reduce<(typeof ranks)[number] | null>(
      (highest, rank) => !highest || Number(rank.price) > Number(highest.price) ? rank : highest,
      null,
    )?.id ?? null;
  }, [ranks]);
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
            <Link href="/account">ประวัติการซื้อ</Link>
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
            <Link href="/account" onClick={() => setMenuOpen(false)}>ประวัติการซื้อและยอดคงเหลือ</Link>
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
              <ol className="realm-journey" aria-label="ขั้นตอนการซื้อยศ">
                <li><span>01</span><div><strong>เติม Wallet</strong><small>แนบสลิปเพียงครั้งเดียว</small></div></li>
                <li><span>02</span><div><strong>เลือกยศ</strong><small>ดูสิทธิประโยชน์ก่อนตัดสินใจ</small></div></li>
                <li><span>03</span><div><strong>รับสถานะ</strong><small>ติดตามคำสั่งซื้อได้ในบัญชี</small></div></li>
              </ol>
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

        <section className="journey-band" aria-labelledby="journey-title">
          <div className="container journey-band-grid">
            <div>
              <div className="eyebrow">The RitzSMP Journey</div>
              <h2 id="journey-title">เลือกยศอย่างมั่นใจ<br /><span>รู้ทุกขั้นตอนก่อนเริ่ม</span></h2>
            </div>
            <div className="journey-checkpoints">
              <div className="checkpoint"><span className="checkpoint-index">1</span><div><strong>เติมเครดิต</strong><small>แจ้งยอดและแนบสลิปผ่านบัญชีของคุณ</small></div></div>
              <div className="checkpoint"><span className="checkpoint-index">2</span><div><strong>เลือกสิทธิ์</strong><small>เทียบราคา ระยะเวลา และสิทธิพิเศษของแต่ละยศ</small></div></div>
              <div className="checkpoint"><span className="checkpoint-index">3</span><div><strong>ติดตามผล</strong><small>ตรวจสอบสถานะคำสั่งซื้อได้จากประวัติของคุณ</small></div></div>
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

            <div className="catalog-toolbar">
              <div className="rank-search">
                <span className="rank-search-icon">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="ค้นหายศ, สิทธิพิเศษ หรือคำอธิบาย..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="rank-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="rank-search-clear"
                    aria-label="ล้างคำค้นหา"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="rank-filters" aria-label="ตัวกรองช่วงราคา">
                <button
                  type="button"
                  className={`ghost-btn compact-btn ${priceFilter === "all" ? "active-filter" : ""}`}
                  onClick={() => setPriceFilter("all")}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  className={`ghost-btn compact-btn ${priceFilter === "budget" ? "active-filter" : ""}`}
                  onClick={() => setPriceFilter("budget")}
                >
                  &le; 500 ฿
                </button>
                <button
                  type="button"
                  className={`ghost-btn compact-btn ${priceFilter === "mid" ? "active-filter" : ""}`}
                  onClick={() => setPriceFilter("mid")}
                >
                  501 - 1,500 ฿
                </button>
                <button
                  type="button"
                  className={`ghost-btn compact-btn ${priceFilter === "prestige" ? "active-filter" : ""}`}
                  onClick={() => setPriceFilter("prestige")}
                >
                  &gt; 1,500 ฿
                </button>
              </div>
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
            ) : (() => {
              const filteredRanks = ranks.filter(rank => {
                const query = searchQuery.toLowerCase().trim();
                const matchesQuery = !query || rank.displayName.toLowerCase().includes(query) || rank.description.toLowerCase().includes(query) || rank.badge.toLowerCase().includes(query) || rank.features.toLowerCase().includes(query);
                const priceNum = Number(rank.price);
                const matchesPrice =
                  priceFilter === "all" ? true :
                  priceFilter === "budget" ? priceNum <= 500 :
                  priceFilter === "mid" ? priceNum > 500 && priceNum <= 1500 :
                  priceFilter === "prestige" ? priceNum > 1500 : true;
                return matchesQuery && matchesPrice;
              });

              if (filteredRanks.length === 0) {
                return (
                  <div className="empty-box" style={{ padding: "48px 24px", textAlign: "center" }}>
                    <Search size={32} style={{ color: "#d4af37", marginBottom: 12, opacity: 0.8 }} />
                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px", color: "#f8fafc" }}>ไม่พบยศที่ตรงกับการค้นหา</h3>
                    <p className="subtle" style={{ margin: "0 0 16px" }}>ลองเปลี่ยนคำค้นหาหรือตัวกรองราคาใหม่อีกครั้ง</p>
                    <button
                      type="button"
                      className="ghost-btn compact-btn"
                      onClick={() => { setSearchQuery(""); setPriceFilter("all"); }}
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  </div>
                );
              }

              return (
                <>
                  <div className="catalog-result" aria-live="polite">
                    <span><Sparkles size={14} /> พบ <strong>{filteredRanks.length}</strong> ยศที่เลือกได้</span>
                    <span>เลือกระดับที่เหมาะกับการผจญภัยของคุณ</span>
                  </div>
                  <div className="rank-grid">
                  {filteredRanks.map(rank => {
                    const features = parseFeatures(rank.features);
                    const isFreeTemplate = Number(rank.price) <= 0;
                    const presentation = getRankPresentation(rank.price);
                    const isFeatured = rank.id === featuredRankId && !searchQuery && priceFilter === "all";
                    return (
                      <article key={rank.id} className={`rank-card ${rank.color} tier-${presentation.tier} ${isFeatured ? "featured" : ""}`}>
                        <div className="rank-card-topline">
                          <span className="rank-tier-label">{presentation.label}</span>
                          <span className="rank-level">LEVEL {presentation.level || "—"}</span>
                        </div>
                        <span className="rank-ribbon">{rank.badge || "Ritz Rank"}</span>
                        <div className="rank-icon"><Crown size={23} strokeWidth={1.7} /></div>
                        <div className="rank-tier-copy">{presentation.subtitle}</div>
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
                            {!isFreeTemplate ? "ปลดล็อกยศ" : "รอเปิดใช้งาน"} <ArrowRight size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  </div>
                </>
              );
            })()}

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
              <div className="checkout-steps" aria-label="ขั้นตอนเติมเงิน">
                <span className="checkout-step is-active"><b>1</b> โอนเงิน</span>
                <span className="checkout-step"><b>2</b> แนบสลิป</span>
                <span className="checkout-step"><b>3</b> รอตรวจสอบ</span>
              </div>
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
              <div className="checkout-steps" aria-label="ขั้นตอนซื้อยศ">
                <span className="checkout-step is-active"><b>1</b> ระบุชื่อในเกม</span>
                <span className="checkout-step is-active"><b>2</b> ยืนยันยอด</span>
                <span className="checkout-step"><b>3</b> ส่งคำขอยศ</span>
              </div>
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
              <strong>แจ้งเติมเงินออเดอร์ #{topupResult} สำเร็จแล้ว</strong>
            </div>
            <div className={topupDiscordSent ? "success-status-line" : "form-error"}>
              {topupDiscordSent ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {topupDiscordSent ? "แจ้งแอดมินใน Discord แล้ว" : "บันทึกคำขอแล้ว แต่แจ้งเตือน Discord ไม่สำเร็จ"}
              <span>•</span> ขั้นถัดไป: แอดมินตรวจสลิป
            </div>
            <p className="subtle" style={{ margin: "14px 0", lineHeight: 1.8, fontSize: 13 }}>
              {topupDiscordSent
                ? "ระบบได้ส่งสลิปและบันทึกคำขอเติมเงินของคุณไปยังแอดมินเรียบร้อยแล้ว เมื่อแอดมินตรวจสอบการโอนเงินเรียบร้อย ยอดเงินจะเข้าสู่กระเป๋าของคุณทันที"
                : "ระบบบันทึกคำขอเติมเงินแล้ว แต่ไม่สามารถแจ้งเตือน Discord อัตโนมัติได้ กรุณาแจ้งทีมงานพร้อมเลขออเดอร์นี้เพื่อให้ตรวจสอบจากหน้าแอดมิน เมื่อยืนยันการโอนเงินแล้ว ยอดเงินจะเข้าสู่กระเป๋าของคุณทันที"}
            </p>
            <div className="modal-actions">
              <button className="primary-btn compact-btn" onClick={() => setTopupResult(null)}>
                รับทราบและปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Glassmorphism Purchase Success Modal with Neon Glow and Ambient Effects */}
      {purchaseResult && (
        <div className="modal-backdrop animate-fade-in" role="presentation" style={{ backdropFilter: "blur(12px)", background: "rgba(10, 10, 15, 0.75)" }}>
          <div className="modal glass-modal" role="dialog" aria-modal="true" style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.85) 0%, rgba(15, 15, 25, 0.95) 100%)",
            border: "1px solid rgba(212, 175, 55, 0.35)",
            boxShadow: "0 0 40px rgba(212, 175, 55, 0.2), 0 20px 40px rgba(0, 0, 0, 0.6)",
            borderRadius: "16px",
            padding: "28px",
            position: "relative",
            overflow: "hidden"
          }}>
            {/* Ambient glow accent */}
            <div style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "150px",
              height: "150px",
              background: "radial-gradient(circle, rgba(212,175,55,0.25) 0%, transparent 70%)",
              borderRadius: "50%",
              pointerEvents: "none"
            }} />

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 16px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.05) 100%)",
                border: "2px solid rgba(212,175,55,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(212,175,55,0.4)",
                animation: "pulse 2s infinite"
              }}>
                <Crown size={32} className="gold-text" />
              </div>
              <div className="eyebrow" style={{ color: "#d4af37", letterSpacing: "2px", fontSize: "11px", marginBottom: "4px" }}>RITZSMP REALM REWARD</div>
              <h3 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: 0 }}>ซื้อยศ {purchaseResult.rankName} สำเร็จ!</h3>
              <p className="subtle" style={{ margin: "6px 0 0", fontSize: "12px" }}>เลขออเดอร์ธุรกรรม: #{purchaseResult.id}</p>
            </div>

            <div style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "between", marginBottom: "8px", fontSize: "13px" }}>
                <span style={{ color: "#94a3b8" }}>ยอดเงินหักจากกระเป๋า:</span>
                <strong style={{ color: "#f87171" }}>-{formatPrice(purchaseResult.amount)} ฿</strong>
              </div>
                <div style={{ display: "flex", justifyContent: "between", fontSize: "13px" }}>
                <span style={{ color: "#94a3b8" }}>สถานะการส่งยศเข้าเซิร์ฟเวอร์:</span>
                <strong style={{ color: purchaseResult.rconExecuted ? "#4ade80" : "#fbbf24", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {purchaseResult.rconExecuted ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                  {purchaseResult.rconExecuted ? "สำเร็จอัตโนมัติผ่าน RCON" : "รอดำเนินการตรวจสอบ/ส่งคำสั่งซ้ำ"}
                </strong>
              </div>
            </div>

            <p className="subtle" style={{ margin: "0 0 24px", lineHeight: "1.7", fontSize: "13px", textAlign: "center" }}>
              {purchaseResult.rconExecuted
                ? "ระบบได้ส่งคำสั่งอัปเกรดตัวละครของคุณในเกม RitzSMP เรียบร้อยแล้ว สามารถเข้าเกมและตรวจสอบยศใหม่ของคุณได้ทันที"
                : "ระบบบันทึกรายการซื้อแล้ว แต่ยังส่งคำสั่งอัปเกรดเข้าเกมไม่สำเร็จ ทีมงานจะตรวจสอบและดำเนินการให้จากหน้าแอดมิน"}
            </p>

            <div className="modal-actions" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="ghost-btn compact-btn"
                onClick={() => setPurchaseResult(null)}
                style={{ flex: 1 }}
              >
                ปิดหน้าต่าง
              </button>
              <button
                className="primary-btn compact-btn"
                onClick={() => { setPurchaseResult(null); }}
                style={{ flex: 1, background: "linear-gradient(135deg, #d4af37 0%, #aa820a 100%)", color: "#000", fontWeight: 700 }}
              >
                <Sparkles size={14} style={{ marginRight: 4 }} /> ไปสนุกในเกมกันเลย!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
