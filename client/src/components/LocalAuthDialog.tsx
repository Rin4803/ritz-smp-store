import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LogIn, UserPlus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LocalAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "login" | "register";
}

export function LocalAuthDialog({ open, onOpenChange, initialMode = "login" }: LocalAuthDialogProps) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setMessage("เข้าสู่ระบบสำเร็จ");
      await utils.auth.me.invalidate();
      window.setTimeout(() => onOpenChange(false), 450);
    },
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      setMessage("สมัครบัญชีสำเร็จ");
      await utils.auth.me.invalidate();
      window.setTimeout(() => onOpenChange(false), 450);
    },
  });

  if (!open) return null;
  const pending = login.isPending || register.isPending;
  const error = login.error?.message || register.error?.message;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (mode === "login") login.mutate({ email, password });
    else register.mutate({ name, email, password });
  };

  return (
    <div className="local-auth-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange(false); }}>
      <section className="local-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="local-auth-title">
        <button className="local-auth-close" type="button" onClick={() => onOpenChange(false)} aria-label="ปิดหน้าต่าง"><X size={18} /></button>
        <div className="local-auth-icon">{mode === "login" ? <LogIn size={23} /> : <UserPlus size={23} />}</div>
        <div className="eyebrow">RitzSMP Player Account</div>
        <h2 id="local-auth-title">{mode === "login" ? "เข้าสู่ระบบร้านค้า" : "สมัครบัญชีผู้เล่น"}</h2>
        <p className="subtle">ใช้บัญชีนี้ดู Wallet ประวัติออเดอร์ และซื้อยศของ RitzSMP</p>

        <div className="local-auth-tabs" role="tablist" aria-label="ประเภทการยืนยันตัวตน">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>เข้าสู่ระบบ</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setMessage(""); }}>สมัครบัญชี</button>
        </div>

        <form onSubmit={submit} className="local-auth-form">
          {mode === "register" && <label>ชื่อที่แสดง<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={64} required placeholder="เช่น RitzPlayer" autoComplete="name" /></label>}
          <label>อีเมล<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={320} required placeholder="player@example.com" autoComplete="email" /></label>
          <label>รหัสผ่าน<div className="local-auth-password"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} minLength={mode === "register" ? 8 : 1} maxLength={128} required placeholder={mode === "register" ? "อย่างน้อย 8 ตัวอักษร" : "กรอกรหัสผ่าน"} autoComplete={mode === "register" ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <div className="local-auth-feedback error"><AlertCircle size={16} /> {error}</div>}
          {message && <div className="local-auth-feedback success"><CheckCircle2 size={16} /> {message}</div>}
          <button className="primary-btn local-auth-submit" type="submit" disabled={pending}>{pending ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}{mode === "login" ? "เข้าสู่ระบบ" : "สมัครบัญชี"}</button>
        </form>
        <small className="subtle local-auth-footnote">รหัสผ่านจะถูกเก็บเป็น hash และไม่แสดงให้ทีมงานเห็น</small>
      </section>
    </div>
  );
}
