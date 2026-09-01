import type { Metadata, Viewport } from "next";
import { Tajawal, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ChronoWidget from "@/components/ChronoWidget";

const tajawal = Tajawal({
  weight: ["400", "500", "700"],
  subsets: ["arabic"],
  variable: "--font-tajawal",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

// إدارة الميتاداتا وتهيئة PWA بالكامل بالطريقة القياسية لـ Next.js لضمان ثباتها أثناء الـ Hydration
export const metadata: Metadata = {
  title: "ديجي‌تاسك - إدارة المهام الفاخرة",
  description: "منصة فاخرة لإدارة المهام وتتبع الإنتاجية اليومية لفريق العمل",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ديجي‌تاسك",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${plusJakartaSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/digitask-icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // كشف وحفظ حالة المظهر المفضلة
              (function() {
                try {
                  var theme = localStorage.getItem('taskini-theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
                try {
                  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
                    localStorage.setItem('pwa-installed', 'true');
                    console.log('[PWA Script] Detected standalone mode on load');
                  }
                } catch (e) {}
              })();
              
              // تسجيل الـ Service Worker
              if ('serviceWorker' in navigator) {
                var registerSW = function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[PWA Script] ServiceWorker registered successfully');
                  }).catch(function(err) {
                    console.log('[PWA Script] ServiceWorker registration failed:', err);
                  });
                };
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  registerSW();
                } else {
                  window.addEventListener('load', registerSW);
                }
              }

              // حفظ حدث beforeinstallprompt مبكراً على مستوى الـ window لضمان عدم ضياعه
              window.deferredPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                console.log('[PWA Script] beforeinstallprompt event caught globally!');
                e.preventDefault();
                window.deferredPrompt = e;
                try {
                  localStorage.setItem('pwa-installed', 'false');
                } catch(err) {}
                // بث الحدث فوراً للمكونات التي تم تحميلها بالفعل
                window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
              });

              // الاستماع لاكتمال التثبيت
              window.addEventListener('appinstalled', function(e) {
                console.log('[PWA Script] appinstalled event caught globally!');
                window.deferredPrompt = null;
                try {
                  localStorage.setItem('pwa-installed', 'true');
                } catch(err) {}
                window.dispatchEvent(new CustomEvent('pwa-installed-status', { detail: true }));
              });
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col selection:bg-theme-accent selection:text-theme-panel">
        {children}
        <ChronoWidget />
      </body>
    </html>
  );
}
