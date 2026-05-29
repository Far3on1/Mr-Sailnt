'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getServices, Service, purchaseService, getPaymentSettings, PaymentSettings } from '@/lib/firestore';
import { Menu, X, Star, Zap, Shield, ChevronLeft, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const { user, userData, isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Order Modal States
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [depositSender, setDepositSender] = useState('');
  const [depositReceipt, setDepositReceipt] = useState('');
  const [depositMethod, setDepositMethod] = useState<'orange_cash' | 'instapay'>('orange_cash');
  const [buying, setBuying] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    orangeCashNumber: '01201426302',
    instaPayNumber: '01201426302'
  });

  useEffect(() => {
    getPaymentSettings()
      .then(setPaymentSettings)
      .catch(() => console.error('Failed to load payment settings'));
  }, []);

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
      return sCat === 'civil' || sName.includes('سجل') || sName.includes('الرقم القومي') || sName.includes('تموين');
    }
    return sCat === categoryKey;
  };

  const triggerBuyFlow = (service: Service) => {
    setSelectedService(service);
    setTargetNumber('');
    setWhatsappNumber('');
    setDepositSender('');
    setDepositReceipt('');
    setShowOrderModal(true);
  };

  const handleCopyNumber = () => {
    const num = depositMethod === 'orange_cash' ? paymentSettings.orangeCashNumber : paymentSettings.instaPayNumber;
    navigator.clipboard.writeText(num);
    toast.success('تم نسخ رقم/عنوان التحويل بنجاح 📋');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1200;
      const maxH = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h = (maxW / w) * h; w = maxW; }
      if (h > maxH) { w = (maxH / h) * w; h = maxH; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      setDepositReceipt(compressed);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleBuy = async () => {
    if (!user || !selectedService) return;
    if (!targetNumber.trim()) return toast.error('يرجى كتابة الرقم المطلوب');
    if (!whatsappNumber.trim()) return toast.error('يرجى كتابة رقم الواتساب');
    if (!depositSender.trim()) return toast.error('يرجى كتابة رقم/حساب المحول منه');
    if (!depositReceipt) return toast.error('يرجى إرفاق صورة إثبات التحويل');

    const isNationalIdService = selectedService.name.includes('الرقم القومي') || selectedService.name.includes('تموين') || selectedService.category === 'civil';
    if (isNationalIdService && !/^\d{14}$/.test(targetNumber.trim())) {
      return toast.error('يجب أن يتكون الرقم القومي من 14 رقم بالضبط');
    }

    setBuying(selectedService.id);
    setShowOrderModal(false);
    try {
      await purchaseService(
        user.uid,
        user.email || '',
        userData?.displayName || 'مستخدم',
        selectedService,
        targetNumber,
        whatsappNumber,
        depositSender,
        depositReceipt,
        depositMethod,
        userData?.tier || 'normal'
      );
      toast.success(`تم إرسال طلب "${selectedService.name}" بنجاح! قيد المراجعة حالياً ⏳`);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setBuying(null);
    }
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

      {/* ===== ORDER MODAL ===== */}
      {showOrderModal && selectedService && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal-box animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                طلب خدمة: <span style={{ color: 'var(--gold)' }}>{selectedService.name}</span>
              </h2>
              <button 
                onClick={() => setShowOrderModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
              <div style={{ color: 'var(--text-secondary)' }}>سعر الخدمة:</div>
              <div style={{ fontWeight: 800 }}>
                <span style={{ color: 'var(--gold)' }}>{
                  userData?.tier === 'vip' && selectedService.vipPrice ? selectedService.vipPrice :
                  userData?.tier === 'reseller' && selectedService.resellerPrice ? selectedService.resellerPrice :
                  selectedService.price
                } ج.م</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(() => {
                const isNationalId = selectedService.name.includes('الرقم القومي') || selectedService.name.includes('تموين') || selectedService.category === 'civil';
                return (
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                      {isNationalId ? 'الرقم القومي المراد الاستعلام عنه (14 رقم) *' : 'رقم الهاتف المراد سحب بياناته *'}
                    </label>
                    <input
                      className="input-gold"
                      type="text"
                      placeholder={isNationalId ? 'مثال: 2991201xxxxxxxx' : 'مثال: 01xxxxxxxxx'}
                      value={targetNumber}
                      onChange={e => setTargetNumber(e.target.value)}
                    />
                  </div>
                );
              })()}

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  رقم الواتساب الخاص بك للتواصل *
                </label>
                <input
                  className="input-gold"
                  type="text"
                  placeholder="مثال: 01xxxxxxxxx"
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                />
              </div>

              {/* Payment Details */}
              <div style={{ marginTop: '8px', padding: '16px', background: 'rgba(226,201,126,0.02)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '12px' }}>تفاصيل الدفع وتحويل المبلغ:</div>
                
                {/* Method selector inside modal */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button 
                    type="button" 
                    className={depositMethod === 'orange_cash' ? 'btn-gold' : 'btn-outline'} 
                    onClick={() => setDepositMethod('orange_cash')}
                    style={{ flex: 1, padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }}
                  >
                    أورنج / فودافون كاش
                  </button>
                  <button 
                    type="button" 
                    className={depositMethod === 'instapay' ? 'btn-gold' : 'btn-outline'} 
                    onClick={() => setDepositMethod('instapay')}
                    style={{ flex: 1, padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }}
                  >
                    انستاباي InstaPay
                  </button>
                </div>

                {/* Transfer destination details */}
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>التحويل إلى:</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)', marginTop: '2px' }}>
                      {depositMethod === 'orange_cash' ? paymentSettings.orangeCashNumber : paymentSettings.instaPayNumber}
                    </div>
                  </div>
                  <button type="button" className="btn-gold" onClick={handleCopyNumber} style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '6px' }}>
                    نسخ
                  </button>
                </div>

                {/* Sender Wallet/Account Input */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    {depositMethod === 'orange_cash' ? 'رقم المحفظة المحول منها *' : 'اسم حساب انستاباي / رقم المحفظة المحول منها *'}
                  </label>
                  <input
                    className="input-gold"
                    type="text"
                    placeholder={depositMethod === 'orange_cash' ? 'مثال: 01xxxxxxxxx' : 'مثال: username@instapay'}
                    value={depositSender}
                    onChange={e => setDepositSender(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Screenshot upload */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>صورة إثبات التحويل (الرسالة أو الإسكرين شوت) *</label>
                  <input className="input-gold" type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: '0.8rem', padding: '8px' }} />
                  {depositReceipt && (
                    <div style={{ marginTop: '8px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px', background: 'rgba(0,0,0,0.3)' }}>
                      <img src={depositReceipt} alt="Receipt preview" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '6px', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-gold" onClick={handleBuy} disabled={!!buying} style={{ flex: 1 }}>
                  {buying ? 'جاري الطلب...' : 'تأكيد الشراء والطلب'}
                </button>
                <button className="btn-outline" onClick={() => setShowOrderModal(false)} style={{ flex: 1 }}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
