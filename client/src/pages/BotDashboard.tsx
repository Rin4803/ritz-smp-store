import React from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Bot, Activity, Terminal, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

export default function BotDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: botStatus, isLoading: statusLoading, refetch, isFetching } = trpc.system.botStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });

  if (!isAuthenticated && !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">จำกัดสิทธิ์เฉพาะแอดมิน</h1>
        <p className="text-slate-400 mb-6">คุณไม่มีสิทธิ์เข้าถึงหน้าจัดการบอท RitzSMP AI กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน</p>
        <Link href="/">
          <Button className="bg-pink-600 hover:bg-pink-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> กลับสู่หน้าแรก
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="border-slate-800 text-slate-300 hover:bg-slate-900">
                <ArrowLeft className="w-4 h-4 mr-2" /> กลับไปหน้าแอดมิน
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-pink-400 flex items-center gap-2">
                <Bot className="w-8 h-8" /> RitzSMP AI Bot Dashboard
              </h1>
              <p className="text-slate-400 text-sm">ตรวจสอบสถานะการทำงาน สถิติการโต้ตอบ และ Log แบบเรียลไทม์ของบอท</p>
            </div>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> รีเฟรช
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">สถานะบอท (Status)</CardTitle>
              <Activity className="w-4 h-4 text-pink-400" />
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="flex items-center space-x-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจสอบ...
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      botStatus?.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    }`}
                  />
                  <span className="text-2xl font-bold uppercase tracking-wider">
                    {botStatus?.status ?? "OFFLINE"}
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">
                {botStatus?.username ? `Logged in as @${botStatus.username}` : "บอทยังไม่ได้เชื่อมต่อหรือไม่ได้ใส่ Token"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">จำนวนการโต้ตอบทั้งหมด</CardTitle>
              <Bot className="w-4 h-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-purple-400">
                {botStatus?.totalInteractions ?? 0} <span className="text-xs text-slate-400 font-normal">ครั้ง</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">รองรับคำสั่ง /ask, /status, /store, /ranks, /topup, /embed</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">เวอร์ชันระบบ</CardTitle>
              <Terminal className="w-4 h-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-cyan-400">RitzSMP AI v2.5</div>
              <p className="text-xs text-slate-500 mt-2">รองรับคำสั่ง /ask, /ai-status และ /embed พร้อมปุ่มกดร้านค้า</p>
            </CardContent>
          </Card>
        </div>

        {/* Logs Section */}
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-pink-400" /> บันทึกการทำงานล่าสุด (Live Activity Logs)
            </CardTitle>
            <CardDescription className="text-slate-400">
              แสดงเหตุการณ์ การเชื่อมต่อ และข้อผิดพลาดล่าสุดของบอท Discord (อัปเดตอัตโนมัติทุก 5 วินาที)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="py-12 flex justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> กำลังโหลดข้อมูล...
              </div>
            ) : !botStatus?.logs || botStatus.logs.length === 0 ? (
              <div className="py-12 text-center text-slate-500">ยังไม่มีบันทึก Log ในระบบขณะนี้</div>
            ) : (
              <div className="space-y-3 font-mono text-xs bg-slate-950 p-4 rounded-lg border border-slate-800 max-h-96 overflow-y-auto">
                {botStatus.logs.map((log: { timestamp: string; level: string; message: string }, idx: number) => (
                  <div key={idx} className="flex items-start space-x-3 border-b border-slate-900 pb-2 last:border-0">
                    <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${
                        log.level === "SUCCESS"
                          ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                          : log.level === "ERROR"
                          ? "border-red-500 text-red-400 bg-red-500/10"
                          : "border-cyan-500 text-cyan-400 bg-cyan-500/10"
                      }`}
                    >
                      {log.level}
                    </Badge>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
