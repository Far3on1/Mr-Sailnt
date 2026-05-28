'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getServices, Service } from '@/lib/firestore';
import { Menu, X, Star, Zap, Shield, ChevronLeft, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const { user, userData, isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getServices()
      .then(setServices)
      .catch(() => toast.error('فشل تحميل الخدمات'))
      .finally(() => setLoading(false));
  }, []);


  const isCategoryPlaceholder = (name: string) => {
    const nameLower = name.toLowerCase();
    return nameLower.startsWith('خدمات ') && (
      nameLower.includes('فودافون') ||
      nameLower.includes('اورنج') ||
      nameLower.includes('أورنج') ||
      nameLower.includes('اتصالات') ||
      nameLower.includes('we') ||
      nameLower.split(/\s+/).includes('وي') ||
      nameLower.includes('سجل')
    );
  };

  const availableServices = services
    .filter(s => !isCategoryPlaceholder(s.name))
    .sort((a, b) => {
      const getWeight = (name: string, category?: string) => {
        const nameLower = name.toLowerCase();
        const catLower = (category || '').toLowerCase();
        if (nameLower.includes('فودافون') || catLower.includes('vodafone') ||
            nameLower.includes('اورنج') || nameLower.includes('أورنج') || catLower.includes('orange') ||
            nameLower.includes('اتصالات') || catLower.includes('etisalat') ||
            nameLower.includes('we') || nameLower.split(/\s+/).includes('وي') || catLower.includes('we')) {
          return 2;
        }
        if (nameLower.includes('سجل') || catLower.includes('civil')) {
          return 1;
        }
        return 0;
      };
      return getWeight(b.name, b.category) - getWeight(a.name, a.category);
    });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      {/* Particles */}
      <div className="particles-bg">
        {mounted && Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="particle" style={{
            right: `${Math.random() * 100}%`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 8}s`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
          }} />
        ))}
      </div>


      {/* Background Glow */}
      <div style={{
        position: 'absolute', top: '20%', right: '20%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(226,201,126,0.06) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-logo">Mr Sailnt</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <>
              {/* balance removed */}
              {isAdmin && (
                <Link href="/admin" style={{ textDecoration: 'none' }}>
                  <div className="badge-admin" style={{ cursor: 'pointer' }}>أدمن</div>
                </Link>
              )}
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <button className="btn-outline" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>لوحتي</button>
              </Link>
            </>
          ) : (
            <Link href="/auth" style={{ textDecoration: 'none' }}>
              <button className="btn-gold" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>دخول / تسجيل</button>
            </Link>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '160px 24px 80px', maxWidth: '900px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="floating-badge" style={{ display: 'inline-block', background: 'rgba(226,201,126,0.08)', border: '1px solid rgba(226,201,126,0.2)', borderRadius: '50px', padding: '6px 20px', marginBottom: '24px', fontSize: '0.85rem', color: 'var(--gold)' }}>
          ✨ متجر سايلنت ✨
        </div>
        <h1 className="hero-title" style={{ marginBottom: '24px' }}>
          مرحباً بك في<br />
          <span className="text-glow" style={{ fontSize: '1.2em' }}>Mr Sailnt</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.8' }}>
          نقدم أفضل الخدمات الرقمية بجودة عالية وأسعار مناسبة. اختر خدمتك المفضلة وسدد مباشرة بكل سهولة.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#services" style={{ textDecoration: 'none' }}>
            <button className="btn-gold" style={{ fontSize: '1.1rem', padding: '14px 32px' }}>
              استعرض الخدمات
            </button>
          </a>
          {!user && (
            <Link href="/auth" style={{ textDecoration: 'none' }}>
              <button className="btn-outline" style={{ fontSize: '1.1rem', padding: '14px 32px' }}>
                إنشاء حساب مجاني
              </button>
            </Link>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          {[
            { icon: <Zap size={28} />, title: 'سرعة في التنفيذ', desc: 'خدماتنا تُنفَّذ في أسرع وقت ممكن' },
            { icon: <Shield size={28} />, title: 'أمان وموثوقية', desc: 'بياناتك محمية ومعاملاتك مضمونة' },
            { icon: <Star size={28} />, title: 'جودة عالية', desc: 'نضمن لك أعلى مستوى من الجودة' },
          ].map((f, i) => (
            <div key={i} className="glass-card" style={{ padding: '28px', textAlign: 'center', animationDelay: `${i * 0.1}s` }}>
              <div style={{ color: 'var(--gold)', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS & TELEGRAM BOT */}
      <section style={{ padding: '40px 24px 60px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', alignItems: 'stretch' }}>
          
          {/* How It Works List */}
          <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px', color: 'var(--text-primary)' }}>💡 كيف يعمل الموقع؟</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { step: '1', title: 'اختر خدمتك', desc: 'تصفح قائمة الخدمات واختر الخدمة المطلوبة.' },
                { step: '2', title: 'حول التكلفة', desc: 'قم بنسخ رقم التحويل (فودافون كاش أو انستاباي) وأرسل قيمة الخدمة.' },
                { step: '3', title: 'املأ البيانات وأرسل الطلب', desc: 'اكتب الرقم المطلوب وتفاصيل المحول منه وارفع إثبات التحويل.' }
              ].map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ background: 'var(--gold)', color: 'var(--bg-primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', flexShrink: 0 }}>
                    {item.step}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>{item.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Telegram Bot Promo */}
          <div className="glass-card" style={{ padding: '32px', border: '1px solid rgba(226,201,126,0.15)', background: 'linear-gradient(135deg, rgba(226,201,126,0.02) 0%, rgba(226,201,126,0.06) 100%)', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>🤖</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>هل تفضل استخدام تليجرام؟</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.7' }}>
              نوفر لك بوت تليجرام تفاعلي وسريع يقدم نفس الخدمات تماماً! يمكنك تقديم الطلبات وتتبعها، والتواصل مع الدعم الفني مباشرة من داخل تطبيق تليجرام.
            </p>
            <div style={{ marginTop: '8px' }}>
              <a href="https://t.me/MrSailnt_Bot" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <button className="btn-gold" style={{ padding: '12px 28px', fontSize: '0.95rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  💬 افتح بوت التليجرام: @MrSailnt_Bot
                </button>
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ padding: '40px 24px 100px', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 className="section-title" style={{ fontSize: '2.2rem' }}>الخدمات الخاصة</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '20px', fontSize: '1rem' }}>
            اختر من بين خدماتنا المتنوعة
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : availableServices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔧</div>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>لا توجد خدمات متاحة حالياً</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>قريباً سيتم إضافة خدمات جديدة</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {availableServices.map((service) => (
              <ServiceCard key={service.id} service={service} user={user} userData={userData} />
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', position: 'relative', zIndex: 1 }}>
        <div className="navbar-logo" style={{ marginBottom: '16px', fontSize: '1.6rem' }}>Mr Sailnt</div>
        
        {/* Contact Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <a href="https://wa.me/201201426302" target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', borderRadius: '50px', fontSize: '0.85rem' }}>
            💬 واتساب: 01201426302
          </a>
          <a href="https://t.me/Mr_Silent999" target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', borderRadius: '50px', fontSize: '0.85rem' }}>
            ✈️ تليجرام
          </a>
          <a href="https://t.me/MrSailnt_Bot" target="_blank" rel="noopener noreferrer" className="btn-gold" style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', borderRadius: '50px', fontSize: '0.85rem' }}>
            🤖 بوت تليجرام: @MrSailnt_Bot
          </a>
        </div>

        <p>© 2025 جميع الحقوق محفوظة لـ <span dir="ltr">Mr Sailnt</span></p>
      </footer>
    </div>
  );
}

// ---- Service Card Component ----
function ServiceCard({ service, user, userData }: { service: Service; user: any; userData: any }) {
  const isCategory = false;

  return (
    <div className="premium-card animate-fade-up" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {service.name}
        </h3>
        {service.isAvailable ? (
          <span className="badge-available">متاح</span>
        ) : (
          <span className="badge-unavailable">غير متاح</span>
        )}
      </div>
      {service.description && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.7', flex: 1 }}>{service.description}</p>
      )}
      <div className="divider" style={{ margin: '8px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>السعر</span>
          <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '1.4rem' }}>
            {service.price} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>ج.م</span>
          </div>
        </div>
        {user ? (
          <Link href={service.isAvailable ? "/dashboard" : "#"} style={{ textDecoration: 'none', pointerEvents: !service.isAvailable ? 'none' : 'auto' }}>
            <button className="btn-gold" style={{ padding: '10px 20px', fontSize: '0.9rem' }} disabled={!service.isAvailable}>
              اشتري الآن
            </button>
          </Link>
        ) : (
          <Link href="/auth" style={{ textDecoration: 'none' }}>
            <button className="btn-gold" style={{ padding: '10px 20px', fontSize: '0.9rem' }} disabled={!service.isAvailable}>
              سجّل للشراء
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}
