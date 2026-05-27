'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getUserTransactions, getServices, purchaseService, Service } from '@/lib/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Wallet, LogOut, ShoppingBag, Clock, Home, Star, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function Dashboard() {
  const { user, userData, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'services' | 'history'>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [liveBalance, setLiveBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  // Order Dialog Modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    if (!user) { router.push('/auth'); return; }
  }, [user]);

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
    const [svcs, txs] = await Promise.all([
      getServices(),
      getUserTransactions(user.uid),
    ]);
    setServices(svcs);
    setTransactions(txs);
  };

  useEffect(() => {
    if (user) {
      loadData().finally(() => setLoading(false));
    }
  }, [user]);

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

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex' }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="navbar-logo" style={{ fontSize: '1.4rem', marginBottom: '24px', padding: '0 8px' }}>Mr Sailnt</div>

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
        <div className={`sidebar-item ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>
          <ShoppingBag size={18} /> الخدمات
        </div>
        <div className={`sidebar-item ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
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
      <div style={{ marginRight: '260px', flex: 1, padding: '40px 32px', minHeight: '100vh' }}>
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
            <h2 className="section-title" style={{ marginBottom: '28px' }}>الخدمات المتاحة</h2>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
            ) : services.filter(s => s.isAvailable).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔧</div>
                <p>لا توجد خدمات متاحة حالياً</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {services.filter(s => s.isAvailable).map(service => (
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

