'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getUserTransactions, getServices, purchaseService, Service, PaymentSettings } from '@/lib/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Wallet, LogOut, ShoppingBag, Clock, Home, Star, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function Dashboard() {
  const { user, userData, logout, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'services' | 'history' | 'deposit'>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [liveBalance, setLiveBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  // Mobile menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // Order Dialog Modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSender, setDepositSender] = useState('');
  const [depositReceipt, setDepositReceipt] = useState('');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'orange_cash' | 'instapay'>('orange_cash');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    orangeCashNumber: '01201426302',
    instaPayNumber: '01201426302'
  });
  const [showSpecialServices, setShowSpecialServices] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth'); return; }
  }, [user, authLoading]);

  // Real-time balance listener
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setLiveBalance(snap.data().balance || 0);
    });
    return unsub;
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    const { getPaymentSettings } = await import('@/lib/firestore');
    const [svcs, txs, settings] = await Promise.all([
      getServices(),
      getUserTransactions(user.uid),
      getPaymentSettings()
    ]);
    setServices(svcs);
    setTransactions(txs);
    setPaymentSettings(settings);
  };

  useEffect(() => {
    if (user) {
      loadData().finally(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('category');
      if (cat && ['vodafone', 'orange', 'etisalat', 'we'].includes(cat)) {
        setActiveCategory(cat);
      }
    }
  }, []);

  const triggerBuyFlow = (service: Service) => {
    if (liveBalance < service.price) {
      toast.error('رصيدك غير كافٍ لشراء هذه الخدمة');
      return;
    }
    setSelectedService(service);
    setTargetNumber('');
    setWhatsappNumber('');
    setShowOrderModal(true);
  };

  const handleBuy = async () => {
    if (!user || !selectedService) return;
    if (!targetNumber.trim()) return toast.error('يرجى كتابة الرقم المطلوب');
    if (!whatsappNumber.trim()) return toast.error('يرجى كتابة رقم الواتساب');

    setBuying(selectedService.id);
    setShowOrderModal(false);
    try {
      await purchaseService(
        user.uid,
        user.email || '',
        userData?.displayName || 'مستخدم',
        selectedService,
        liveBalance,
        targetNumber,
        whatsappNumber
      );
      toast.success(`تم إرسال طلب "${selectedService.name}" بنجاح! 🎉`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setBuying(null);
    }
  };

  const handleCopyNumber = () => {
    const num = depositMethod === 'orange_cash' ? paymentSettings.orangeCashNumber : paymentSettings.instaPayNumber;
    navigator.clipboard.writeText(num);
    toast.success('تم نسخ رقم/عنوان التحويل بنجاح 📋');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً، الحد الأقصى هو 2 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setDepositReceipt(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!depositAmount || !depositSender || !depositReceipt) {
      return toast.error('من فضلك أكمل جميع بيانات الشحن وارفع صورة التحويل');
    }
    if (Number(depositAmount) <= 0) {
      return toast.error('يجب أن يكون المبلغ أكبر من صفر');
    }
    setSubmittingDeposit(true);
    try {
      const { createDepositRequest } = await import('@/lib/firestore');
      await createDepositRequest(
        user.uid,
        user.email || '',
        userData?.displayName || 'مستخدم',
        Number(depositAmount),
        depositSender,
        depositReceipt,
        depositMethod
      );
      toast.success('تم إرسال طلب الشحن بنجاح! قيد المراجعة حالياً ⏳');
      setDepositAmount('');
      setDepositSender('');
      setDepositReceipt('');
      setTab('history');
    } catch {
      toast.error('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return <span style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>قيد المراجعة</span>;
      case 'in_progress':
        return <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>جاري العمل</span>;
      case 'completed':
        return <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>تم التسليم</span>;
      default:
        return null;
    }
  };

  const [resending, setResending] = useState(false);
  const { resendVerification } = useAuth();

  const handleResendEmail = async () => {
    setResending(true);
    try {
      await resendVerification();
      toast.success('تم إعادة إرسال رابط التحقق إلى بريدك الإلكتروني ✉️');
    } catch {
      toast.error('فشل إرسال الرابط، حاول مجدداً لاحقاً');
    } finally {
      setResending(false);
    }
  };

  const handleRefreshVerification = async () => {
    if (user) {
      await user.reload();
      if (user.emailVerified) {
        toast.success('تم التحقق من بريدك الإلكتروني بنجاح! 🎉');
        window.location.reload();
      } else {
        toast.error('لم يتم تفعيل الحساب بعد، يرجى الضغط على الرابط المرسل إلى بريدك');
      }
    }
  };

  if (!user) return null;

  if (!user.emailVerified) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(226,201,126,0.05) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        
        <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="navbar-logo" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Mr Sailnt</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>تأكيد البريد الإلكتروني</p>

          <div className="glass-card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '3rem' }}>✉️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>يرجى تفعيل حسابك أولاً</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              لقد أرسلنا رابط تحقق إلى بريدك الإلكتروني **{user.email}**. يرجى فتح البريد والضغط على الرابط لتفعيل حسابك.
            </p>

            <div className="divider" style={{ margin: '10px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn-gold" onClick={handleRefreshVerification} style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 600 }}>
                لقد قمت بالتفعيل (تحديث الصفحة)
              </button>

              <button className="btn-outline" onClick={handleResendEmail} disabled={resending} style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}>
                {resending ? 'جاري الإرسال...' : 'إعادة إرسال رابط التحقق'}
              </button>

              <button className="btn-outline" onClick={handleLogout} style={{ width: '100%', padding: '12px', fontSize: '0.9rem', color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }}>
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Mobile Top Navigation Bar */}
      <div className="mobile-header" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', zIndex: 110 }}>
        <div className="navbar-logo" style={{ fontSize: '1.2rem' }}>Mr Sailnt</div>
        <button 
          onClick={() => setMenuOpen(!menuOpen)} 
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <span style={{ fontSize: '1.8rem' }}>☰</span>
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Sidebar */}
        <div className={`sidebar ${menuOpen ? 'show' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div className="navbar-logo" style={{ fontSize: '1.4rem', padding: '0 8px' }}>Mr Sailnt</div>
            <button className="mobile-close" onClick={() => setMenuOpen(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>

          {/* Balance Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(196,168,85,0.15), rgba(226,201,126,0.05))', border: '1px solid rgba(226,201,126,0.25)', borderRadius: '14px', padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
            <Wallet size={24} color="var(--gold)" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>رصيدك الحالي</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold)' }}>{liveBalance.toFixed(2)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>جنيه مصري</div>
          </div>

          <Link href="/" className="sidebar-item" style={{ textDecoration: 'none' }}>
            <Home size={18} /> الرئيسية
          </Link>
          <div className={`sidebar-item ${tab === 'services' ? 'active' : ''}`} onClick={() => { setTab('services'); setActiveCategory(null); setMenuOpen(false); }}>
            <ShoppingBag size={18} /> الخدمات الخاصة
          </div>
          <div className={`sidebar-item ${tab === 'deposit' ? 'active' : ''}`} onClick={() => { setTab('deposit'); setMenuOpen(false); }}>
            <Wallet size={18} /> شحن الرصيد
          </div>
          <div className={`sidebar-item ${tab === 'history' ? 'active' : ''}`} onClick={() => { setTab('history'); setMenuOpen(false); }}>
            <Clock size={18} /> سجل المعاملات
          </div>
          {isAdmin && (
            <Link href="/admin" className="sidebar-item" style={{ textDecoration: 'none', color: 'var(--gold)' }}>
              <Star size={18} /> لوحة الأدمن
            </Link>
          )}

          <div style={{ flex: 1 }} />
          <div style={{ padding: '8px', borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', paddingRight: '8px' }}>{userData?.displayName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px', paddingRight: '8px', opacity: 0.7 }}>{user.email}</div>
            <button onClick={handleLogout} className="sidebar-item" style={{ width: '100%', border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', textAlign: 'right' }}>
              <LogOut size={18} /> تسجيل الخروج
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content-layout" style={{ marginRight: '260px', flex: 1, padding: '40px 32px', minHeight: '100vh', width: '100%' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
              أهلاً، {userData?.displayName || 'مستخدم'} 👋
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>مرحباً بك في لوحة التحكم</p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '36px' }}>
            <div className="stat-card">
              <div className="stat-value">{liveBalance.toFixed(0)}</div>
              <div className="stat-label">الرصيد (ج.م)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{transactions.filter((t: any) => t.type === 'purchase').length}</div>
              <div className="stat-label">خدمات مشتراة</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{services.filter(s => s.isAvailable).length}</div>
              <div className="stat-label">خدمات متاحة</div>
            </div>
          </div>

          {/* Services Tab */}
          {tab === 'services' && (
            <div>
              {activeCategory === null ? (
                <div>
                  <h2 className="section-title" style={{ marginBottom: '28px' }}>الخدمات الخاصة المتاحة</h2>

                  {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
                  ) : services.filter(s => s.isAvailable && (!s.category || s.category === 'none')).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔧</div>
                      <p>لا توجد خدمات خاصة متاحة حالياً</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                      {(() => {
                        const rootServices = services
                          .filter(s => s.isAvailable && (!s.category || s.category === 'none'))
                          .sort((a, b) => {
                            const isNetA = a.name.toLowerCase().includes('فودافون') || 
                                           a.name.toLowerCase().includes('اورنج') || 
                                           a.name.toLowerCase().includes('أورنج') || 
                                           a.name.toLowerCase().includes('اتصالات') || 
                                           a.name.toLowerCase().includes('we') || 
                                           a.name.toLowerCase().split(/\s+/).includes('وي');
                            const isNetB = b.name.toLowerCase().includes('فودافون') || 
                                           b.name.toLowerCase().includes('اورنج') || 
                                           b.name.toLowerCase().includes('أورنج') || 
                                           b.name.toLowerCase().includes('اتصالات') || 
                                           b.name.toLowerCase().includes('we') || 
                                           b.name.toLowerCase().split(/\s+/).includes('وي');
                            return (isNetB ? 1 : 0) - (isNetA ? 1 : 0);
                          });

                        return rootServices.map(service => {
                          const nameLower = service.name.toLowerCase();
                          const catCode = nameLower.includes('فودافون') ? 'vodafone' :
                                          (nameLower.includes('اورنج') || nameLower.includes('أورنج')) ? 'orange' :
                                          nameLower.includes('اتصالات') ? 'etisalat' :
                                          (nameLower.includes('we') || nameLower.split(/\s+/).includes('وي')) ? 'we' : null;
                          const isCategory = catCode !== null;
                          return (
                            <div key={service.id} className="glass-card" style={{ padding: '24px', border: isCategory ? '1px solid rgba(226,201,126,0.15)' : undefined }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isCategory ? '📁' : ''} {service.name}
                                </h3>
                                <span className="badge-available">متاح</span>
                              </div>
                              {service.description && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '16px' }}>{service.description}</p>
                              )}
                              <div className="divider" />
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                {!isCategory ? (
                                  <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '1.3rem' }}>
                                    {service.price} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>ج.م</span>
                                  </div>
                                ) : (
                                  <div />
                                )}
                                
                                {isCategory ? (
                                  <button
                                    className="btn-gold"
                                    style={{ padding: '8px 24px', fontSize: '0.9rem', fontWeight: 600 }}
                                    onClick={() => setActiveCategory(catCode)}
                                  >
                                    دخول
                                  </button>
                                ) : (
                                  <button
                                    className="btn-gold"
                                    style={{ padding: '8px 18px', fontSize: '0.9rem' }}
                                    disabled={buying === service.id || liveBalance < service.price}
                                    onClick={() => triggerBuyFlow(service)}
                                  >
                                    {buying === service.id ? '...' : liveBalance < service.price ? 'رصيد غير كافٍ' : 'اشتري'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                    <h2 className="section-title" style={{ margin: 0 }}>
                      {activeCategory === 'vodafone' ? 'خدمات فودافون' :
                       activeCategory === 'orange' ? 'خدمات اورنج' :
                       activeCategory === 'etisalat' ? 'خدمات اتصالات' :
                       activeCategory === 'we' ? 'خدمات We' : 'الخدمات الفرعية'}
                    </h2>
                    <button 
                      className="btn-outline" 
                      onClick={() => setActiveCategory(null)}
                      style={{ padding: '8px 20px', fontSize: '0.9rem' }}
                    >
                      ← العودة للشبكات
                    </button>
                  </div>

                  {services.filter(s => s.isAvailable && s.category === activeCategory).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔧</div>
                      <p>لا توجد خدمات متاحة حالياً في هذا القسم</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                      {services.filter(s => s.isAvailable && s.category === activeCategory).map(service => (
                        <div key={service.id} className="glass-card" style={{ padding: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{service.name}</h3>
                            <span className="badge-available">متاح</span>
                          </div>
                          {service.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '16px' }}>{service.description}</p>
                          )}
                          <div className="divider" />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                            <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '1.3rem' }}>
                              {service.price} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>ج.م</span>
                            </div>
                            <button
                              className="btn-gold"
                              style={{ padding: '8px 18px', fontSize: '0.9rem' }}
                              disabled={buying === service.id || liveBalance < service.price}
                              onClick={() => triggerBuyFlow(service)}
                            >
                              {buying === service.id ? '...' : liveBalance < service.price ? 'رصيد غير كافٍ' : 'اشتري'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Deposit Orange Cash Tab */}
          {tab === 'deposit' && (
            <div>
              <h2 className="section-title" style={{ marginBottom: '28px' }}>شحن رصيد المحفظة</h2>
              <div className="glass-card" style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
                
                {/* Method Selector */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <button 
                    type="button"
                    className={depositMethod === 'orange_cash' ? 'btn-gold' : 'btn-outline'} 
                    onClick={() => { setDepositMethod('orange_cash'); setDepositSender(''); }}
                    style={{ flex: 1, padding: '10px', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    أورنج كاش / فودافون
                  </button>
                  <button 
                    type="button"
                    className={depositMethod === 'instapay' ? 'btn-gold' : 'btn-outline'} 
                    onClick={() => { setDepositMethod('instapay'); setDepositSender(''); }}
                    style={{ flex: 1, padding: '10px', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    انستاباي InstaPay
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💸</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {depositMethod === 'orange_cash' ? 'تحويل فودافون / أورنج كاش' : 'تحويل عبر تطبيق انستاباي'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>يرجى اتباع الخطوات التالية لشحن حسابك</p>
                </div>

                <div style={{ background: 'rgba(226,201,126,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {depositMethod === 'orange_cash' ? 'رقم التحويل المعتمد' : 'رقم / عنوان انستاباي المعتمد'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold)', letterSpacing: '1px' }}>
                      {depositMethod === 'orange_cash' ? paymentSettings.orangeCashNumber : paymentSettings.instaPayNumber}
                    </span>
                    <button type="button" className="btn-gold" onClick={handleCopyNumber} style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
                      نسخ الرقم
                    </button>
                  </div>
                </div>

                <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>المبلغ الذي قمت بتحويله (ج.م) *</label>
                    <input className="input-gold" type="number" placeholder="مثال: 150" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} min="1" required />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                      {depositMethod === 'orange_cash' ? 'رقم المحفظة التي قمت بالتحويل منها *' : 'اسم حساب انستاباي أو رقم المحفظة المحول منها *'}
                    </label>
                    <input 
                      className="input-gold" 
                      type="text" 
                      placeholder={depositMethod === 'orange_cash' ? 'مثال: 01xxxxxxxxx' : 'مثال: username@instapay أو رقم هاتف'} 
                      value={depositSender} 
                      onChange={e => setDepositSender(e.target.value)} 
                      required 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>صورة إثبات التحويل (الرسالة أو الإسكرين شوت) *</label>
                    <input className="input-gold" type="file" accept="image/*" onChange={handleFileChange} required style={{ fontSize: '0.85rem', padding: '10px' }} />
                    {depositReceipt && (
                      <div style={{ marginTop: '12px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>معاينة الصورة المرفقة</div>
                        <img src={depositReceipt} alt="Receipt preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>

                  <button className="btn-gold" type="submit" disabled={submittingDeposit} style={{ marginTop: '12px', width: '100%', padding: '14px' }}>
                    {submittingDeposit ? 'جاري إرسال الطلب...' : 'إرسال طلب الشحن'}
                  </button>
                </form>
              </div>
            </div>
          )}



        {/* History Tab */}
        {tab === 'history' && (
          <div>
            <h2 className="section-title" style={{ marginBottom: '28px' }}>سجل المعاملات والطلبات</h2>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
                <p>لا توجد معاملات بعد</p>
              </div>
            ) : (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>النوع</th>
                      <th>التفاصيل</th>
                      <th>المبلغ</th>
                      <th>الحالة</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx: any) => (
                      <tr key={tx.id}>
                        <td>
                          {tx.type === 'credit'
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={16} color="#4ade80" /> شحن رصيد</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShoppingBag size={16} color="var(--gold)" /> شراء خدمة</span>
                          }
                        </td>
                        <td>
                          <div>{tx.note}</div>
                          {tx.targetNumber && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              رقم المستهدف: {tx.targetNumber} | واتساب: {tx.whatsappNumber}
                            </div>
                          )}
                        </td>
                        <td style={{ color: tx.type === 'credit' ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                          {tx.type === 'credit' ? '+' : ''}{tx.amount} ج.م
                        </td>
                        <td>
                          {tx.type === 'purchase' ? getStatusBadge(tx.status) : <span style={{ color: '#4ade80', fontSize: '0.8rem' }}>مكتمل</span>}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          {tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      {/* ===== PURCHASE INPUTS MODAL ===== */}
      {showOrderModal && selectedService && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>طلب خدمة: {selectedService.name}</h2>
              <button onClick={() => setShowOrderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <XCircle size={22} />
              </button>
            </div>
            
            <div style={{ background: 'rgba(226,201,126,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontWeight: 600 }}>
                <span>قيمة الخدمة:</span>
                <span style={{ color: 'var(--gold)' }}>{selectedService.price} ج.م</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  رقم الهاتف المراد سحب بياناته *
                </label>
                <input
                  className="input-gold"
                  type="text"
                  placeholder="مثال: 01xxxxxxxxx"
                  value={targetNumber}
                  onChange={e => setTargetNumber(e.target.value)}
                />
              </div>

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

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-gold" onClick={handleBuy} style={{ flex: 1 }}>
                  تأكيد الشراء والطلب
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

