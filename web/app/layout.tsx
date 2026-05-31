import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "주식 분석",
  description: "멀티에이전트 투자 리포트",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full" suppressHydrationWarning style={{ background: '#050508' }}>
        {/* Desktop ambient glow behind the "phone" */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(10,132,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
