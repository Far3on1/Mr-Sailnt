'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getUserTransactions, getServices, purchaseService, Service, PaymentSettings,
  getUserNotifications, markNotificationAsRead, UserNotification
} from '@/lib/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Wallet, LogOut, ShoppingBag, Clock, Home, Star, CheckCircle, XCircle, Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

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

export default function Dashboard() {
  const { user, userData, logout, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'services' | 'history' | 'deposit'>('history');
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
  
  // Transaction History Search & Filter State
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

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

  // Notifications State
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

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
    try {
      const { getPaymentSettings } = await import('@/lib/firestore');
      const [svcs, txs, settings, notifs] = await Promise.all([
        getServices().catch(err => { console.error('Error fetching services:', err); return []; }),
        getUserTransactions(user.uid).catch(err => { console.error('Error fetching user transactions:', err); return []; }),
        getPaymentSettings().catch(err => { console.error('Error fetching payment settings:', err); return { orangeCashNumber: '01201426302', instaPayNumber: '01201426302' }; }),
        getUserNotifications(user.uid).catch(err => { console.error('Error fetching user notifications:', err); return []; })
      ]);
      setServices(svcs);
      setTransactions(txs);
      setPaymentSettings(settings);
      setNotifications(notifs);
    } catch (e) {
      console.error('Error in loadData:', e);
    }
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
      if (cat && ['vodafone', 'orange', 'etisalat', 'we', 'civil'].includes(cat)) {
        setActiveCategory(cat);
      }
    }
  }, []);

  const triggerBuyFlow = (service: Service) => {
    setSelectedService(service);
    setTargetNumber('');
    setWhatsappNumber('');
    setDepositSender('');
    setDepositReceipt('');
    setShowOrderModal(true);
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

          <Link href="/" className="sidebar-item" style={{ textDecoration: 'none' }}>
            <Home size={18} /> الرئيسية
          </Link>

          <div className={`sidebar-item ${tab === 'history' ? 'active' : ''}`} onClick={() => { setTab('history'); setMenuOpen(false); }}>
            <Clock size={18} /> سجل المعاملات
          </div>
          {isAdmin && (
            <Link href="/admin" className="sidebar-item" style={{ textDecoration: 'none', color: 'var(--gold)' }}>
              <Star size={18} /> لوحة الأدمن
            </Link>
          )}

          <div style={{ flex: 1 }} />
          <div style={{ padding: '8px', borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', paddingRight: '8px' }}>روابط التواصل والدعم:</div>
            <a href="https://wa.me/201201426302" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', paddingRight: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              💬 واتساب: 01201426302
            </a>
            <a href="https://t.me/Mr_Silent999" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', paddingRight: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✈️ تليجرام الشخصي
            </a>
            <a href="https://t.me/MrSailnt_Bot" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--gold)', fontSize: '0.8rem', paddingRight: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              🤖 بوت الخدمات: @MrSailnt_Bot
            </a>
          </div>
          <div style={{ padding: '8px', borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', paddingRight: '8px' }}>{userData?.displayName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px', paddingRight: '8px', opacity: 0.7 }}>{user.email}</div>
            <button onClick={handleLogout} className="sidebar-item" style={{ width: '100%', border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', textAlign: 'right' }}>
              <LogOut size={18} /> تسجيل الخروج
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content-layout" style={{ marginRight: '260px', flex: 1, padding: '40px 32px', minHeight: '100vh', width: '100%' }}>
          <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                أهلاً، {userData?.displayName || 'مستخدم'} 👋
              </h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>مرحباً بك في لوحة التحكم</p>
            </div>
            
            <button
              onClick={() => setShowNotificationsModal(true)}
              style={{
                position: 'relative',
                background: 'rgba(226,201,126,0.08)',
                border: '1px solid rgba(226,201,126,0.2)',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="الإشعارات"
              className="btn-notification-bell"
            >
              <Bell size={20} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
          </div>

          {(() => {
            const pendingCount = transactions.filter((t: any) => t.type === 'purchase' && t.status === 'pending').length;
            if (pendingCount === 0) return null;
            return (
              <div className="glass-card animate-fade-up" style={{ padding: '16px 20px', border: '1px solid rgba(226,201,126,0.2)', background: 'rgba(226,201,126,0.03)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '1.3rem' }}>⏳</span>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  لديك <strong style={{ color: 'var(--gold)' }}>{pendingCount}</strong> طلبات قيد المراجعة حالياً. سيتم تنفيذها قريباً والتواصل معك عبر الواتساب.
                </div>
              </div>
            );
          })()}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '36px' }}>
            <div className="stat-card">
              <div className="stat-value">{transactions.filter((t: any) => t.type === 'purchase').length}</div>
              <div className="stat-label">خدمات مشتراة</div>
            </div>

          </div>

          {/* Deposit tab removed */}



        {/* History Tab */}
        {tab === 'history' && (
          <div>
            <h2 className="section-title" style={{ marginBottom: '28px' }}>سجل المعاملات والطلبات</h2>
            {(() => {
              const filtered = transactions.filter((tx: any) => {
                const matchesSearch = !historySearch || 
                  (tx.serviceName || '').toLowerCase().includes(historySearch.toLowerCase()) || 
                  (tx.targetNumber || '').includes(historySearch) ||
                  (tx.note || '').toLowerCase().includes(historySearch.toLowerCase());
                
                const matchesStatus = historyStatusFilter === 'all' || tx.status === historyStatusFilter;
                return matchesSearch && matchesStatus;
              });

              if (transactions.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
                    <p>لا توجد معاملات بعد</p>
                  </div>
                );
              }

              return (
                <div>
                  {/* Search and Filters */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <input 
                      className="input-gold" 
                      placeholder="🔍 ابحث باسم الخدمة أو الرقم المطلوب..." 
                      value={historySearch} 
                      onChange={e => setHistorySearch(e.target.value)} 
                      style={{ flex: 2, minWidth: '200px', padding: '10px 16px', fontSize: '0.9rem' }}
                    />
                    <select 
                      className="input-gold" 
                      value={historyStatusFilter} 
                      onChange={e => setHistoryStatusFilter(e.target.value as any)} 
                      style={{ flex: 1, minWidth: '150px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '10px', borderRadius: '10px', fontFamily: 'var(--font-tajawal), sans-serif' }}
                    >
                      <option value="all">كل الحالات</option>
                      <option value="pending">قيد المراجعة</option>
                      <option value="in_progress">جاري العمل</option>
                      <option value="completed">تم التسليم</option>
                    </select>
                  </div>

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
                        {filtered.map((tx: any) => (
                          <tr key={tx.id}>
                            <td>
                              {tx.type === 'credit'
                                ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={16} color="#4ade80" /> شحن رصيد</span>
                                : <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShoppingBag size={16} color="var(--gold)" /> شراء خدمة</span>
                              }
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {tx.orderNumber && (
                                  <span style={{ background: 'rgba(226,201,126,0.12)', color: 'var(--gold)', border: '1px solid rgba(226,201,126,0.3)', padding: '2px 8px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                                    #{tx.orderNumber}
                                  </span>
                                )}
                                <span>{tx.note}</span>
                              </div>
                              {tx.targetNumber && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                  رقم المستهدف: {tx.targetNumber} | واتساب: {tx.whatsappNumber}
                                </div>
                              )}
                              {tx.deliveryNote && (
                                <div style={{
                                  marginTop: '10px',
                                  background: 'rgba(34,197,94,0.08)',
                                  border: '1px solid rgba(34,197,94,0.25)',
                                  borderRadius: '10px',
                                  padding: '10px 14px',
                                  fontSize: '0.85rem',
                                  color: '#4ade80',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.8,
                                }}>
                                  <div style={{ fontWeight: 700, marginBottom: '6px', color: '#22c55e' }}>📦 بيانات التسليم:</div>
                                  {tx.deliveryNote}
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
                    {filtered.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>لا توجد نتائج تطابق بحثك</div>
                    )}
                  </div>
                </div>
              );
            })()}
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

      {/* ===== NOTIFICATIONS MODAL ===== */}
      {showNotificationsModal && (
        <div className="modal-overlay" onClick={() => setShowNotificationsModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={22} style={{ color: 'var(--gold)' }} /> مركز الإشعارات
              </h2>
              <button 
                onClick={() => setShowNotificationsModal(false)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={22} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📭</div>
                  <p style={{ fontSize: '0.9rem' }}>لا توجد إشعارات بعد</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    style={{
                      padding: '16px',
                      background: notif.read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(226, 201, 126, 0.05)',
                      border: '1px solid',
                      borderColor: notif.read ? 'var(--border)' : 'rgba(226, 201, 126, 0.2)',
                      borderRadius: '12px',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {!notif.read && (
                      <span style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        width: '8px',
                        height: '8px',
                        background: 'var(--gold)',
                        borderRadius: '50%'
                      }} />
                    )}
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: notif.read ? 'var(--text-primary)' : 'var(--gold)', marginBottom: '6px' }}>
                      {notif.title}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '8px' }}>
                      {notif.body}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                        {notif.createdAt?.seconds ? new Date(notif.createdAt.seconds * 1000).toLocaleString('ar-EG') : 'الآن'}
                      </span>
                      {!notif.read && (
                        <button
                          onClick={async () => {
                            if (!notif.id) return;
                            await markNotificationAsRead(notif.id);
                            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--gold)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: '2px 6px'
                          }}
                        >
                          تحديد كمقروء
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <button 
              className="btn-gold" 
              onClick={async () => {
                const unread = notifications.filter(n => !n.read);
                await Promise.all(unread.map(n => n.id ? markNotificationAsRead(n.id) : Promise.resolve()));
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                toast.success('تم تحديد الكل كمقروء ✅');
              }}
              disabled={notifications.filter(n => !n.read).length === 0}
              style={{ marginTop: '20px', width: '100%', padding: '12px' }}
            >
              تحديد الكل كمقروء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

