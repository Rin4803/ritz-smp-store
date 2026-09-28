import { useMemo, useState } from "react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getRankPresentation } from "@/lib/rankPresentation";
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, ChevronRight, Clock3, Copy, Crown,
  CreditCard, Gamepad2, History, Landmark, Loader2, LogIn, Menu, RefreshCcw,
  Search, ShieldCheck, ShoppingBag, Users, Wallet, Wifi, WifiOff, X, Zap
} from "lucide-react";

const paymentAccounts = [
  { label: "ธนาคารออมสิน", value: "020391511886", detail: "ชื่อบัญชี: ภานุสรณ์ วงศ์สุวรรณ" },
  { label: "PromptPay / TrueMoney", value: "0930286252", detail: "พร้อมเพย์และวอเลทสำหรับการสนับสนุน RitzSMP" },
];

type Rank = {
  id: number;
  name: string;
  displayName: string;
  price: string;
  duration: string;
  color: string;
  badge: string;
  description: string;
  features: string;
};

function parseFeatures(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatPrice(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—";
}

function safeColorClass(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "gold";
}

function statusLabel(status: string | undefined) {
  if (status === "สำเร็จ") return "ส่งยศเรียบร้อย";
  if (status === "รอตรวจสอบ") return "รอดำเนินการ";
  return status ?? "กำลังตรวจสอบ";
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const ranksQuery = trpc.store.ranks.useQuery();
  const serverStatusQuery = trpc.servers.status.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const ordersQuery = trpc.store.myOrders.useQuery(undefined, { enabled: isAuthenticated });
  const walletQuery = trpc.store.wallet.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);
  const [detailsRank, setDetailsRank] = useState<Rank | null>(null);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState<"all" | "starter" | "royal" | "legendary">("all");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupPaymentMethod, setTopupPaymentMethod] = useState<"ธนาคารออมสิน" | "PromptPay" | "TrueMoney Wallet">("PromptPay");
  const [slipData, setSlipData] = useState("");
  const [slipName, setSlipName] = useState("");
  const [slipType, setSlipType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/png");
  const [topupResult, setTopupResult] = useState<number | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{
    id: number;
    rankName: string;
    amount: string;
    minecraftIGN: string;
    status: string;
    rconExecuted: boolean;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const ranks = (ranksQuery.data ?? []) as Rank[];
  const orders = ordersQuery.data ?? [];
  const walletBalance = Number(walletQuery.data?.balance ?? 0);

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
      setPurchaseResult({
        id: result.order.id,
        rankName: result.order.rankName,
        amount: result.order.amount,
        minecraftIGN: result.order.minecraftIGN,
        status: result.order.status,
        rconExecuted: result.rconExecuted === true,
      });
      setSelectedRank(null);
      setIgn("");
      utils.store.myOrders.invalidate();
      utils.store.wallet.invalidate();
    },
  });

  const filteredRanks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ranks.filter(rank => {
      const presentation = getRankPresentation(rank.price);
      const featureText = parseFeatures(rank.features).join(" ").toLowerCase();
      const haystack = (rank.displayName + " " + rank.description + " " + rank.badge + " " + featureText).toLowerCase();
      const queryMatch = !query || haystack.includes(query);
      const filterMatch =
        priceFilter === "all" ||
        (priceFilter === "starter" && presentation.tier === "starter") ||
        (priceFilter === "royal" && presentation.tier === "royal") ||
        (priceFilter === "legendary" && presentation.tier === "legendary");
      return queryMatch && filterMatch;
    });
  }, [ranks, searchQuery, priceFilter]);

  const highestPricedRank = useMemo(
    () => [...ranks].filter(rank => Number(rank.price) > 0).sort((a, b) => Number(b.price) - Number(a.price))[0] ?? null,
    [ranks],
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2200);
  };

  const openPurchase = (rank: Rank) => {
    setPurchaseResult(null);
    setDetailsRank(null);
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    setSelectedRank(rank);
  };

  const handleSlip = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast("รองรับเฉพาะ JPG, PNG และ WEBP");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast("ไฟล์สลิปต้องมีขนาดไม่เกิน 6 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSlipData(String(reader.result ?? ""));
      setSlipName(file.name);
      setSlipType(file.type as "image/jpeg" | "image/png" | "image/webp");
    };
    reader.readAsDataURL(file);
  };

  const submitTopup = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !slipData) return;
    createTopup.mutate({
      amount,
      paymentMethod: topupPaymentMethod,
      slipData,
      slipName,
      slipType,
    });
  };

  const submitPurchase = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRank || !ign.trim()) return;
    purchaseRank.mutate({ rankId: selectedRank.id, minecraftIGN: ign.trim() });
  };

  const copyAccount = async (value: string) => {
    const ok = await copyText(value);
    showToast(ok ? "คัดลอกหมายเลขแล้ว" : value);
  };

  return (
    <div className="store-shell">
      <div className="noise" aria-hidden="true" />
      <div className="site-glow site-glow-a" aria-hidden="true" />
      <div className="site-glow site-glow-b" aria-hidden="true" />

      <header className="topbar">
        <div className="container topbar-inner">
          <button type="button" className="menu-toggle" aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"} onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark"><Crown size={20} strokeWidth={1.8} /></span>
            <span>
              <span className="brand-name">RITZ<span className="gold-text">SMP</span></span>
              <span className="brand-sub">OFFICIAL STORE</span>
            </span>
          </Link>

          <nav className="nav desktop-nav" aria-label="เมนูหลัก">
            <a href="#ranks">ยศทั้งหมด</a>
            <a href="#how-to-buy">วิธีซื้อ</a>
            <a href="#payment">ชำระเงิน</a>
            <Link href="/account">บัญชี / ออเดอร์</Link>
            {user?.role === "admin" && <Link href="/admin" className="gold-text">Admin</Link>}
          </nav>

          <div className="topbar-actions">
            {authLoading ? (
              <span className="user-chip"><Loader2 size={14} className="animate-spin" /> กำลังตรวจสอบ</span>
            ) : isAuthenticated ? (
              <>
                <button type="button" className="wallet-pill" onClick={() => { setTopupResult(null); setIsTopupOpen(true); }}>
                  <Wallet size={14} /><span>Wallet</span><strong>{formatPrice(walletBalance)} ฿</strong>
                </button>
                <Link href="/account" className="user-chip"><ShieldCheck size={13} /> {user?.name ?? "ผู้เล่น"}</Link>
              </>
            ) : (
              <button type="button" className="ghost-btn compact-btn" onClick={() => startLogin()}><LogIn size={14} /> เข้าสู่ระบบ</button>
            )}
          </div>
        </div>

        {menuOpen && (
          <nav className="mobile-menu" aria-label="เมนูมือถือ">
            <a href="#ranks" onClick={() => setMenuOpen(false)}>ยศทั้งหมด</a>
            <a href="#how-to-buy" onClick={() => setMenuOpen(false)}>วิธีซื้อ</a>
            <a href="#payment" onClick={() => setMenuOpen(false)}>ชำระเงิน</a>
            <Link href="/account" onClick={() => setMenuOpen(false)}>บัญชี / ออเดอร์</Link>
            {user?.role === "admin" && <Link href="/admin" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>}
            {isAuthenticated ? (
              <button type="button" className="mobile-wallet-btn" onClick={() => { setMenuOpen(false); setIsTopupOpen(true); }}>
                <Wallet size={15} /> เติม Wallet • {formatPrice(walletBalance)} ฿
              </button>
            ) : (
              <button type="button" className="mobile-wallet-btn" onClick={() => { setMenuOpen(false); startLogin(); }}>
                <LogIn size={15} /> เข้าสู่ระบบ
              </button>
            )}
          </nav>
        )}
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><span className="live-dot" /> RITZSMP / OFFICIAL STORE</div>
              <h1>ยศของคุณ<br /><span>สิทธิ์ในเกมของคุณ</span></h1>
              <p className="hero-lead">ร้านยศอย่างเป็นทางการของ RitzSMP เลือกแพ็กเกจ เติม Wallet และส่งคำขอซื้อยศด้วยชื่อในเกมจากหน้าเว็บเดียว</p>

              <div className="hero-actions">
                <a href="#ranks" className="primary-btn"><ShoppingBag size={16} /> ดูยศทั้งหมด <ArrowRight size={15} /></a>
                <a href="#how-to-buy" className="ghost-btn"><Gamepad2 size={16} /> วิธีซื้อ</a>
              </div>

              <div className="hero-status-card">
                <div className={"status-marker " + (serverStatusQuery.data?.online ? "online" : "offline")} />
                <div className="status-copy">
                  <strong>
                    {serverStatusQuery.isLoading ? "กำลังตรวจสอบเซิร์ฟเวอร์" : serverStatusQuery.data?.online ? "RitzSMP Online" : "ยังตรวจสถานะไม่ได้"}
                  </strong>
                  <span>
                    {serverStatusQuery.data ? String(serverStatusQuery.data.players) + "/" + String(serverStatusQuery.data.maxPlayers || "—") + " คน" : "ลองใหม่อีกครั้ง"}
                    {serverStatusQuery.data?.version ? " · " + serverStatusQuery.data.version : ""}
                  </span>
                </div>
                <button type="button" className="icon-btn" onClick={() => serverStatusQuery.refetch()} disabled={serverStatusQuery.isFetching} aria-label="รีเฟรชสถานะเซิร์ฟเวอร์">
                  <RefreshCcw size={14} className={serverStatusQuery.isFetching ? "spin" : ""} />
                </button>
              </div>

              <div className="hero-metrics">
                <div><span>LOGIN</span><strong>ผ่านบัญชี</strong></div>
                <div><span>PAY</span><strong>Wallet</strong></div>
                <div><span>DELIVERY</span><strong>RCON</strong></div>
              </div>
            </div>

            <div className="hero-panel">
              <div className="royal-card">
                <div className="royal-top"><span>RITZ ROYAL</span><Crown size={18} /></div>
                <div className="royal-seal"><Crown size={50} strokeWidth={1.25} /></div>
                <div className="royal-label">OFFICIAL RANK STORE</div>
                <div className="royal-title">เลือกยศที่เข้ากับสไตล์การเล่น</div>
                <div className="royal-price">
                  {highestPricedRank ? formatPrice(highestPricedRank.price) + " ฿" : "—"}
                  <span>ระดับราคาสูงสุดที่เปิดขาย</span>
                </div>
                <div className="royal-divider" />
                <div className="royal-foot"><span>ดูข้อมูลก่อนซื้อ</span><ChevronRight size={15} /></div>
              </div>
              <div className="hero-side-note"><Zap size={14} /><span>กรอก IGN ตอน Checkout แล้วตรวจสอบให้ถูกต้องก่อนยืนยัน</span></div>
            </div>
          </div>
        </section>

        <section className="ticker" aria-label="จุดเด่น">
          <div className="ticker-inner">
            <span>RITZSMP</span><i /><span>RANK STORE</span><i /><span>WALLET</span><i /><span>RCON DELIVERY</span><i /><span>JAVA + BEDROCK</span>
          </div>
        </section>

        <section className="section" id="ranks">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">01 / RANK CATALOG</div>
                <h2 className="section-title">ยศทั้งหมด</h2>
                <p className="section-description">รายการยศและสิทธิประโยชน์โหลดจากข้อมูลร้านค้าโดยตรง ไม่ต้องกรอกข้อมูลซ้ำในหน้าเว็บ</p>
              </div>
              <div className="catalog-count"><strong>{filteredRanks.length}</strong><span>แพ็กเกจ</span></div>
            </div>

            <div className="catalog-tools">
              <div className="search-box">
                <Search size={15} />
                <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ค้นหายศหรือสิทธิพิเศษ..." aria-label="ค้นหายศ" />
                {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="ล้างการค้นหา"><X size={14} /></button>}
              </div>
              <div className="filter-row">
                {([
                  ["all", "ทั้งหมด"],
                  ["starter", "เริ่มต้น"],
                  ["royal", "Royal"],
                  ["legendary", "Legendary"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" className={"filter-btn " + (priceFilter === value ? "active" : "")} onClick={() => setPriceFilter(value)}>{label}</button>
                ))}
              </div>
            </div>

            {ranksQuery.isLoading ? (
              <div className="loading"><Loader2 size={20} className="animate-spin" /> กำลังโหลดรายการยศ...</div>
            ) : ranksQuery.isError ? (
              <div className="empty-box"><AlertCircle size={20} className="gold-text" /><strong>ไม่สามารถโหลดรายการยศได้</strong><button type="button" className="ghost-btn compact-btn" onClick={() => ranksQuery.refetch()}>ลองใหม่</button></div>
            ) : filteredRanks.length === 0 ? (
              <div className="empty-box"><Search size={20} className="gold-text" /><strong>ไม่พบยศที่ตรงกับการค้นหา</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div>
            ) : (
              <div className="rank-grid">
                {filteredRanks.map(rank => {
                  const features = parseFeatures(rank.features);
                  const presentation = getRankPresentation(rank.price);
                  const isFeatured = highestPricedRank?.id === rank.id;
                  return (
                    <article key={rank.id} className={"rank-card tier-" + presentation.tier + " color-" + safeColorClass(rank.color) + (isFeatured ? " featured" : "")}>
                      {isFeatured && <div className="rank-featured">HIGHEST TIER</div>}
                      <div className="rank-card-top">
                        <div><span className="rank-tier-label">{presentation.label}</span><span className="rank-level">LEVEL {presentation.level || "—"}</span></div>
                        <span className="rank-badge">{rank.badge || "RITZ RANK"}</span>
                      </div>
                      <div className="rank-emblem"><Crown size={22} /></div>
                      <div className="rank-name">{rank.displayName}</div>
                      <div className="rank-duration">{rank.duration}</div>
                      <p className="rank-description">{rank.description}</p>
                      <ul className="feature-list">
                        {features.slice(0, 7).map(feature => <li key={feature}><Check size={13} /><span>{feature}</span></li>)}
                      </ul>
                      {features.length > 7 && <div className="feature-more">+ อีก {features.length - 7} สิทธิ์</div>}
                      <div className="rank-card-bottom">
                        <div><span className="price-label">ราคา</span><strong>{Number(rank.price) > 0 ? formatPrice(rank.price) + " ฿" : "รอกำหนดราคา"}</strong></div>
                        <div className="rank-actions">
                          <button type="button" className="mini-btn" onClick={() => setDetailsRank(rank)}>ดูรายละเอียด</button>
                          <button type="button" className="primary-btn compact-btn" disabled={Number(rank.price) <= 0} onClick={() => openPurchase(rank)}>
                            {Number(rank.price) > 0 ? "ซื้อยศ" : "ยังไม่เปิดขาย"} <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="section dark-band" id="how-to-buy">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">02 / HOW TO BUY</div>
                <h2 className="section-title">ซื้อยังไง</h2>
                <p className="section-description">ระบบแยกการเติม Wallet กับการซื้อยศออกจากกัน เพื่อให้ยอดเงินและออเดอร์ตรวจสอบได้ง่าย</p>
              </div>
            </div>
            <div className="steps-grid">
              <article className="step-card"><span>01</span><Wallet size={19} /><h3>เติม Wallet</h3><p>โอนเงินตามช่องทางที่กำหนด แล้วส่งสลิปผ่านหน้าเว็บเพื่อรอตรวจสอบ</p></article>
              <article className="step-card"><span>02</span><ShoppingBag size={19} /><h3>เลือกยศ</h3><p>เปิดรายละเอียดแพ็กเกจ ตรวจสิทธิประโยชน์และราคาก่อนซื้อ</p></article>
              <article className="step-card"><span>03</span><Gamepad2 size={19} /><h3>กรอก IGN</h3><p>ใส่ชื่อในเกมที่ต้องการรับยศ แล้วตรวจสอบตัวสะกดก่อนยืนยัน</p></article>
              <article className="step-card"><span>04</span><CheckCircle2 size={19} /><h3>ติดตามผล</h3><p>เก็บเลขออเดอร์และเปิดหน้า Account เพื่อตรวจสอบสถานะได้ตลอด</p></article>
            </div>
            <div className="warning-line"><AlertCircle size={15} /><span>กรุณาตรวจสอบ Minecraft IGN ให้ถูกต้องก่อนชำระ เพราะระบบใช้ชื่อนี้ในการส่งคำสั่งมอบยศ</span></div>
          </div>
        </section>

        <section className="section" id="payment">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">03 / PAYMENT</div>
                <h2 className="section-title">ช่องทางเติม Wallet</h2>
                <p className="section-description">โอนตามช่องทางด้านล่าง จากนั้นกดเติม Wallet และแนบสลิปในหน้าเว็บ</p>
              </div>
              <div className="payment-lock"><ShieldCheck size={15} /> ตรวจสลิปก่อนเพิ่มยอด</div>
            </div>
            <div className="payment-grid">
              {paymentAccounts.map(account => (
                <article className="payment-card" key={account.label}>
                  <div className="payment-icon"><Landmark size={18} /></div>
                  <div className="payment-content"><span>{account.label}</span><strong>{account.value}</strong><small>{account.detail}</small></div>
                  <button type="button" className="icon-btn" onClick={() => void copyAccount(account.value)} aria-label={"คัดลอก " + account.label}><Copy size={14} /></button>
                </article>
              ))}
            </div>
            <div className="payment-actions">
              {isAuthenticated ? (
                <button type="button" className="primary-btn" onClick={() => setIsTopupOpen(true)}><Wallet size={16} /> เติม Wallet ตอนนี้</button>
              ) : (
                <button type="button" className="primary-btn" onClick={() => startLogin()}><LogIn size={16} /> เข้าสู่ระบบเพื่อเติม Wallet</button>
              )}
              <span>แนบสลิปตอนเติมเงินเท่านั้น การซื้อยศใช้ยอด Wallet</span>
            </div>
          </div>
        </section>

        {isAuthenticated && (
          <section className="section account-preview">
            <div className="container">
              <div className="account-preview-head">
                <div><div className="eyebrow">04 / YOUR STORE</div><h2 className="section-title">บัญชีของคุณ</h2></div>
                <Link href="/account" className="ghost-btn compact-btn">เปิดบัญชี <ArrowRight size={13} /></Link>
              </div>
              <div className="account-preview-grid">
                <div className="quick-balance"><span>ยอด Wallet</span><strong>{formatPrice(walletBalance)} ฿</strong><small>ยอดพร้อมใช้สำหรับซื้อยศ</small></div>
                <div className="quick-orders">
                  <div className="quick-orders-head"><span><History size={14} /> ออเดอร์ล่าสุด</span><strong>{orders.length}</strong></div>
                  {orders.slice(0, 3).map(order => (
                    <div className="quick-order-row" key={order.id}>
                      <div><strong>#{order.id}</strong><span>{order.rankName}</span></div>
                      <span className={"status " + (order.status === "สำเร็จ" ? "success" : order.status === "ยกเลิก" ? "cancelled" : "pending")}>{statusLabel(order.status)}</span>
                    </div>
                  ))}
                  {orders.length === 0 && <div className="quick-empty">ยังไม่มีออเดอร์</div>}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="section final-cta">
          <div className="container final-box">
            <div><div className="eyebrow">RITZSMP / READY</div><h2>เลือกยศ แล้วกลับเข้าเกม</h2><p>ออเดอร์ทุกใบมีเลขอ้างอิงและสถานะให้ตรวจสอบจากบัญชีของคุณ</p></div>
            <a href="#ranks" className="primary-btn">เลือกยศ <ArrowRight size={15} /></a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div><strong>RITZ<span className="gold-text">SMP</span></strong><span>Official Realm Store</span></div>
          <div className="footer-links"><a href="#ranks">ยศ</a><a href="#payment">ชำระเงิน</a><Link href="/account">บัญชี</Link><a href="https://discord.gg/ZrChjhseS" target="_blank" rel="noopener">Discord ↗</a></div>
        </div>
      </footer>

      {toastMessage && <div className="store-toast" role="status">{toastMessage}</div>}

      {topupResult !== null && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal compact-modal" role="dialog" aria-modal="true">
            <div className="success-icon"><CheckCircle2 size={25} /></div>
            <div className="eyebrow">TOPUP SUBMITTED</div>
            <h2 className="modal-title">ส่งคำขอเติม Wallet แล้ว</h2>
            <p className="subtle">เลขออเดอร์ <strong>#{topupResult}</strong> ถูกบันทึกไว้แล้ว หลังตรวจสอบสลิปยอดจะเข้ากระเป๋าของคุณ</p>
            <div className="modal-actions"><Link href="/account" className="primary-btn compact-btn" onClick={() => setTopupResult(null)}>ดูออเดอร์</Link><button type="button" className="ghost-btn compact-btn" onClick={() => setTopupResult(null)}>ปิด</button></div>
          </div>
        </div>
      )}

      {detailsRank && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDetailsRank(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rank-detail-title">
            <div className="modal-head">
              <div><div className="eyebrow">{getRankPresentation(detailsRank.price).label}</div><h2 className="modal-title" id="rank-detail-title">{detailsRank.displayName}</h2><p className="subtle">{detailsRank.description}</p></div>
              <button type="button" className="close-btn" onClick={() => setDetailsRank(null)} aria-label="ปิด"><X size={17} /></button>
            </div>
            <div className="detail-price">{formatPrice(detailsRank.price)} ฿ <span>{detailsRank.duration}</span></div>
            <div className="detail-list">{parseFeatures(detailsRank.features).map(feature => <div key={feature}><Check size={14} /><span>{feature}</span></div>)}</div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn compact-btn" onClick={() => setDetailsRank(null)}>กลับ</button>
              <button type="button" className="primary-btn compact-btn" disabled={Number(detailsRank.price) <= 0} onClick={() => openPurchase(detailsRank)}>ซื้อยศนี้ <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {isTopupOpen && isAuthenticated && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setIsTopupOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="topup-title">
            <div className="modal-head">
              <div><div className="eyebrow">WALLET TOP-UP</div><h2 className="modal-title" id="topup-title">เติมเงินเข้ากระเป๋า</h2><p className="subtle">ยอดคงเหลือปัจจุบัน <strong>{formatPrice(walletBalance)} ฿</strong></p></div>
              <button type="button" className="close-btn" onClick={() => setIsTopupOpen(false)} aria-label="ปิด"><X size={17} /></button>
            </div>
            <form className="form-grid" onSubmit={submitTopup}>
              <div className="checkout-steps"><span className="is-active"><b>1</b> โอน</span><span className="is-active"><b>2</b> แนบสลิป</span><span><b>3</b> รอตรวจสอบ</span></div>
              <label className="form-label">จำนวนเงิน<input className="form-control" type="number" min="1" step="1" value={topupAmount} onChange={event => setTopupAmount(event.target.value)} placeholder="เช่น 100" /></label>
              <label className="form-label">ช่องทาง<select className="form-control" value={topupPaymentMethod} onChange={event => setTopupPaymentMethod(event.target.value as typeof topupPaymentMethod)}><option value="PromptPay">PromptPay</option><option value="TrueMoney Wallet">TrueMoney Wallet</option><option value="ธนาคารออมสิน">ธนาคารออมสิน</option></select></label>
              <div className="payment-mini">
                {paymentAccounts.map(account => <button type="button" key={account.value} onClick={() => void copyAccount(account.value)} className="payment-mini-row"><span>{account.label}</span><strong>{account.value}</strong><Copy size={13} /></button>)}
              </div>
              <label className="file-drop"><CreditCard size={22} className="gold-text" /><span>{slipName ? "เลือกแล้ว: " + slipName : "เลือกไฟล์สลิป JPG / PNG / WEBP"}</span><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => handleSlip(event.target.files?.[0])} /></label>
              {createTopup.error && <div className="form-error"><AlertCircle size={14} /> {createTopup.error.message}</div>}
              <div className="form-help"><ShieldCheck size={13} /> หลังทีมงานตรวจสอบสลิป ยอดเงินจะเข้า Wallet ของบัญชีนี้</div>
              <div className="modal-actions"><button type="button" className="ghost-btn compact-btn" onClick={() => setIsTopupOpen(false)}>ยกเลิก</button><button type="submit" className="primary-btn compact-btn" disabled={createTopup.isPending || !topupAmount || !slipData}>{createTopup.isPending ? <Loader2 size={14} className="spin" /> : <Wallet size={14} />} ยืนยันเติม Wallet</button></div>
            </form>
          </div>
        </div>
      )}

      {selectedRank && isAuthenticated && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedRank(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
            <div className="modal-head">
              <div><div className="eyebrow">{getRankPresentation(selectedRank.price).label}</div><h2 className="modal-title" id="purchase-title">ซื้อ {selectedRank.displayName}</h2><p className="subtle">ระบบจะหัก Wallet ตามราคายศที่แสดงในรายการ</p></div>
              <button type="button" className="close-btn" onClick={() => setSelectedRank(null)} aria-label="ปิด"><X size={17} /></button>
            </div>
            <div className="purchase-summary"><div><span>ราคา</span><strong>{formatPrice(selectedRank.price)} ฿</strong></div><div><span>Wallet</span><strong className={walletBalance >= Number(selectedRank.price) ? "positive" : "negative"}>{formatPrice(walletBalance)} ฿</strong></div></div>
            <div className="checkout-steps"><span className="is-active"><b>1</b> เลือกยศ</span><span className="is-active"><b>2</b> กรอก IGN</span><span><b>3</b> ส่งคำสั่ง</span></div>
            <form className="form-grid" onSubmit={submitPurchase}>
              <label className="form-label">Minecraft IGN<input className="form-control" value={ign} onChange={event => setIgn(event.target.value)} placeholder="เช่น RitzPlayer" minLength={3} maxLength={64} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
              <div className="purchase-note"><Zap size={14} /><span>ตรวจสอบชื่อในเกมให้ถูกต้องก่อนยืนยัน ระบบจะส่งคำสั่งมอบยศผ่าน RCON</span></div>
              {walletBalance < Number(selectedRank.price) && <div className="form-error"><AlertCircle size={14} /> Wallet ไม่พอ ต้องการอีก {formatPrice(Number(selectedRank.price) - walletBalance)} ฿</div>}
              {purchaseRank.error && <div className="form-error"><AlertCircle size={14} /> {purchaseRank.error.message}</div>}
              <div className="modal-actions"><button type="button" className="ghost-btn compact-btn" onClick={() => setSelectedRank(null)}>ยกเลิก</button><button type="submit" className="primary-btn compact-btn" disabled={purchaseRank.isPending || !ign.trim() || walletBalance < Number(selectedRank.price)}>{purchaseRank.isPending ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />} ยืนยันซื้อ {formatPrice(selectedRank.price)} ฿</button></div>
            </form>
          </div>
        </div>
      )}

      {purchaseResult && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-result-title">
            <div className={"success-icon " + (purchaseResult.rconExecuted ? "done" : "pending-icon")}>{purchaseResult.rconExecuted ? <CheckCircle2 size={25} /> : <Clock3 size={25} />}</div>
            <div className="eyebrow">{purchaseResult.rconExecuted ? "PURCHASE COMPLETE" : "PURCHASE RECEIVED"}</div>
            <h2 className="modal-title" id="purchase-result-title">{purchaseResult.rconExecuted ? "ส่งยศเข้าเกมแล้ว" : "รับคำสั่งซื้อแล้ว"}</h2>
            <p className="subtle">ออเดอร์ <strong>#{purchaseResult.id}</strong> · {purchaseResult.rankName} · IGN <strong>{purchaseResult.minecraftIGN}</strong></p>
            <div className="result-status"><span>สถานะ</span><strong>{statusLabel(purchaseResult.status)}</strong></div>
            {!purchaseResult.rconExecuted && <div className="form-help"><AlertCircle size={13} /> ระบบส่งคำสั่งเข้าเซิร์ฟเวอร์ไม่สำเร็จในรอบนี้ จึงบันทึกออเดอร์ไว้ให้ทีมงานดำเนินการต่อ</div>}
            <div className="modal-actions"><Link href="/account" className="primary-btn compact-btn" onClick={() => setPurchaseResult(null)}>ดูออเดอร์</Link><button type="button" className="ghost-btn compact-btn" onClick={() => setPurchaseResult(null)}>ปิด</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
