import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "800"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "Mr Sailnt Store",
  description: "احصل على أفضل الخدمات الرقمية بأسعار مناسبة مع Mr Sailnt",
  keywords: "خدمات رقمية, Mr Sailnt, خدمات احترافية",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${tajawal.variable} font-tajawal antialiased`}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1a1a2e',
                color: '#e2c97e',
                border: '1px solid #e2c97e33',
                borderRadius: '12px',
                fontFamily: 'var(--font-tajawal)',
                direction: 'rtl',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
