'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getServices, Service } from '@/lib/firestore';
import { Menu, X, Star, Zap, Shield, ChevronLeft, Wallet, Home as HomeIcon, Clock, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const { user, userData, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Navigation
  const [buying, setBuying] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (err) {
      toast.error('فشل تسجيل الخروج');
    }
  };

  // Loaded on load

  useEffect(() => {
    setMounted(true);
    getServices()
      .then(setServices)
      .catch(() => toast.error('فشل تحميل الخدمات'))
      .finally(() => setLoading(false));
  }, []);

  const matchesCategory = (service: Service, categoryKey: string | null) => {
    if (!categoryKey) return true;
    const sCat = (service.category || '').toLowerCase();
    const sName = service.name.toLowerCase();
    if (categoryKey === 'vodafone') {
      return sCat === 'vodafone' || sName.includes('فودافون');
    }
    if (categoryKey === 'orange') {
      return sCat === 'orange' || sName.includes('orange') || sName.includes('اورنج') || sName.includes('أورنج');
    }
    if (categoryKey === 'etisalat') {
      return sCat === 'etisalat' || sName.includes('etisalat') || sName.includes('اتصالات');
    }
    if (categoryKey === 'we') {
      return sCat === 'we' || sName.includes('we') || sName.split(/\s+/).includes('وي') || sName.includes('المصرية للاتصالات');
    }
    if (categoryKey === 'civil') {
      return sCat === 'civil' || sName.includes('سجل مدني') || sName.includes('الرقم القومي') || sName.includes('تموين');
    }
    return sCat === categoryKey;
  };

  const triggerBuyFlow = (service: Service) => {
    router.push(`/purchase?id=${service.id}`);
  };


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
    .filter(s => matchesCategory(s, activeCategory))
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
      <nav className="navbar" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '14px 24px' }}>
        {/* Right side (RTL start) - Hamburger */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          {user && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
            >
              <span style={{ fontSize: '1.8rem' }}>☰</span>
            </button>
          )}
        </div>

        {/* Center - Logo */}
        <div style={{ textAlign: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div className="navbar-logo" style={{ margin: 0 }}>Mr Sailnt</div>
          </Link>
        </div>

        {/* Left side - Login/Signup */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {!user && (
            <Link href="/auth" style={{ textDecoration: 'none' }}>
              <button className="btn-gold" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>دخول / تسجيل</button>
            </Link>
          )}
        </div>
      </nav>

      {/* SIDEBAR OVERLAY */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* SIDEBAR */}
      <div className={`sidebar ${menuOpen ? 'show' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div className="navbar-logo" style={{ fontSize: '1.4rem', padding: '0 8px' }}>Mr Sailnt</div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>

        {/* Navigation links at the top */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Link href="/" className="sidebar-item active" style={{ textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>
            <HomeIcon size={18} /> الرئيسية
          </Link>

          <Link href="/dashboard" className="sidebar-item" style={{ textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>
            <Clock size={18} /> سجل المعاملات
          </Link>

          {isAdmin && (
            <Link href="/admin" className="sidebar-item" style={{ textDecoration: 'none', color: 'var(--gold)' }} onClick={() => setMenuOpen(false)}>
              <Star size={18} /> لوحة الأدمن
            </Link>
          )}
        </div>

        {/* Middle: Contact methods */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', padding: '24px 8px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', paddingRight: '8px', fontWeight: 600 }}>طرق التواصل والدعم:</div>
          <a href="https://wa.me/201201426302" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', paddingRight: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💬 واتساب: 01201426302
          </a>
          <a href="https://t.me/Mr_Silent999" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', paddingRight: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✈️ تليجرام الشخصي
          </a>
          <a href="https://t.me/MrSailnt_Bot" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--gold)', fontSize: '0.85rem', paddingRight: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            🤖 بوت الخدمات: @MrSailnt_Bot
          </a>
        </div>

        {/* Bottom: Account Info and Logout */}
        {user && (
          <div style={{ padding: '16px 8px 4px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userData?.displayName || 'مستخدم'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
            <button 
              onClick={handleLogout}
              style={{ 
                width: '100%', 
                background: 'none', 
                border: 'none', 
                color: '#f87171', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '0.85rem', 
                padding: '8px 0' 
              }}
            >
              <LogOut size={16} /> تسجيل الخروج
            </button>
          </div>
        )}
      </div>

      {/* HERO */}
      <section style={{ padding: '120px 20px 60px', maxWidth: '900px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
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
          <p style={{ color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '30px', fontSize: '1rem' }}>
            اختر من بين خدماتنا المتنوعة
          </p>
        </div>

        {/* Category Filter Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '40px', flexWrap: 'wrap', direction: 'rtl', justifyContent: 'center' }}>
          {[
            { id: null, label: 'الكل 🌐' },
            { id: 'vodafone', label: 'فودافون 🔴' },
            { id: 'orange', label: 'أورنج 🟠' },
            { id: 'etisalat', label: 'اتصالات 🟢' },
            { id: 'we', label: 'وي 🟣' },
            { id: 'civil', label: 'سجل مدني 🏛️' }
          ].map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id || 'all'}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '30px',
                  border: isActive ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? 'rgba(226, 201, 126, 0.15)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? 'var(--gold)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '0.9rem',
                  boxShadow: isActive ? '0 0 15px rgba(226, 201, 126, 0.1)' : 'none',
                }}
                className="category-filter-btn"
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : services.filter(s => !isCategoryPlaceholder(s.name)).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔧</div>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>لا توجد خدمات متاحة حالياً</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>قريباً سيتم إضافة خدمات جديدة</p>
          </div>
        ) : (
          availableServices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
              <p>لا توجد خدمات في هذا القسم حالياً</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
              {availableServices.map((service) => (
                <ServiceCard key={service.id} service={service} user={user} userData={userData} onBuyClick={triggerBuyFlow} />
              ))}
            </div>
          )
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

      {/* ===== ORDER MODAL REMOVED ===== */}
    </div>
  );
}

// ---- Service Card Component ----
function ServiceCard({ service, user, userData, onBuyClick }: { service: Service; user: any; userData: any; onBuyClick: (service: Service) => void }) {
  const userTier = userData?.tier || 'normal';
  let activePrice = service.price;
  let showDiscount = false;
  let originalPrice = service.price;

  if (userTier === 'vip' && service.vipPrice) {
    activePrice = service.vipPrice;
    showDiscount = true;
  } else if (userTier === 'reseller' && service.resellerPrice) {
    activePrice = service.resellerPrice;
    showDiscount = true;
  }

  return (
    <div className="premium-card animate-fade-up" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {service.name}
          </h3>
          {showDiscount && (
            <span style={{
              display: 'inline-block',
              marginTop: '6px',
              background: 'rgba(226,201,126,0.08)',
              border: '1px solid rgba(226,201,126,0.2)',
              color: 'var(--gold)',
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '50px',
              fontWeight: 600
            }}>
              ✨ سعر الـ {userTier === 'vip' ? 'VIP' : 'موزع'} الخاص بك
            </span>
          )}
        </div>
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
          {showDiscount && (
            <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '2px' }}>
              {originalPrice} ج.م
            </span>
          )}
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>السعر</span>
          <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '1.4rem' }}>
            {activePrice} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>ج.م</span>
          </div>
        </div>
        {user ? (
          <button className="btn-gold" onClick={() => onBuyClick(service)} style={{ padding: '10px 20px', fontSize: '0.9rem' }} disabled={!service.isAvailable}>
            اشتري الآن
          </button>
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
