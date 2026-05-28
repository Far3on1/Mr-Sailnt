'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getServices, addService, updateService, deleteService,
  getAllUsers, addBalanceToUser, Service, UserRecord,
  getAllTransactions, updateOrderStatus,
  getPaymentSettings, updatePaymentSettings, PaymentSettings
} from '@/lib/firestore';

import {
  LayoutDashboard, Package, Users, Plus, Edit2, Trash2,
  ToggleLeft, ToggleRight, Wallet, Home, LogOut, Save, X, Star, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

type Tab = 'overview' | 'services' | 'users' | 'orders' | 'deposits' | 'settings';

export default function AdminPage() {
  const { user, isAdmin, logout, loading: authLoading } = useAuth();

  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Lightbox Modal for screenshot preview
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);

  // Service Modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcCategory, setSvcCategory] = useState('none');

  // Balance Modal
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);

  // Payment Settings State
  const [orangeCashNumber, setOrangeCashNumber] = useState('01201426302');
  const [instaPayNumber, setInstaPayNumber] = useState('01201426302');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/auth'); return; }
    if (!isAdmin) { router.push('/dashboard'); return; }
  }, [user, isAdmin, authLoading]);


  const loadData = async () => {
    setLoading(true);
    const { getDepositRequests } = await import('@/lib/firestore');
    const [svcs, usrs, txs, deps, settings] = await Promise.all([
      getServices(), 
      getAllUsers(), 
      getAllTransactions(),
      getDepositRequests(),
      getPaymentSettings()
    ]);
    setServices(svcs);
    setUsers(usrs.filter(u => u.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL));
    setTransactions(txs);
    setDepositRequests(deps);
    setOrangeCashNumber(settings.orangeCashNumber);
    setInstaPayNumber(settings.instaPayNumber);
    setTelegramBotToken(settings.telegramBotToken || '');
    setTelegramChatId(settings.telegramChatId || '');
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!orangeCashNumber.trim() || !instaPayNumber.trim()) {
      return toast.error('من فضلك أكمل جميع الحقول');
    }
    setSettingsSaving(true);
    try {
      await updatePaymentSettings({
        orangeCashNumber,
        instaPayNumber,
        telegramBotToken,
        telegramChatId
      });
      toast.success('تم حفظ الإعدادات بنجاح ✅');
    } catch {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

  // ---- Service CRUD ----
  const openAddService = () => {
    setEditingService(null);
    setSvcName(''); setSvcDesc(''); setSvcPrice('');
    setSvcCategory('none');
    setShowServiceModal(true);
  };
  const openEditService = (s: Service) => {
    setEditingService(s);
    setSvcName(s.name); setSvcDesc(s.description); setSvcPrice(String(s.price));
    setSvcCategory(s.category || 'none');
    setShowServiceModal(true);
  };
  const saveService = async () => {
    if (!svcName || !svcPrice) return toast.error('أدخل اسم السعر');
    setSvcSaving(true);
    try {
      if (editingService) {
        await updateService(editingService.id, { name: svcName, description: svcDesc, price: Number(svcPrice), category: svcCategory });
        toast.success('تم تعديل الخدمة ✅');
      } else {
        await addService({ name: svcName, description: svcDesc, price: Number(svcPrice), isAvailable: true, category: svcCategory });
        toast.success('تم إضافة الخدمة ✅');
      }
      setShowServiceModal(false);
      await loadData();
    } catch { toast.error('حدث خطأ'); }
    finally { setSvcSaving(false); }
  };
  const toggleService = async (s: Service) => {
    await updateService(s.id, { isAvailable: !s.isAvailable });
    toast.success(s.isAvailable ? 'تم إيقاف الخدمة' : 'تم تفعيل الخدمة');
    await loadData();
  };
  const handleDelete = async (s: Service) => {
    if (!confirm(`هل تريد حذف "${s.name}"؟`)) return;
    await deleteService(s.id);
    toast.success('تم الحذف');
    await loadData();
  };

  // ---- Balance ----
  const openBalance = (u: UserRecord) => {
    setSelectedUser(u);
    setBalanceAmount('');
    setBalanceNote('شحن رصيد من الأدمن');
    setShowBalanceModal(true);
  };
  const saveBalance = async () => {
    if (!selectedUser || !balanceAmount) return toast.error('أدخل المبلغ');
    if (Number(balanceAmount) <= 0) return toast.error('المبلغ يجب أن يكون أكبر من صفر');
    setBalanceSaving(true);
    try {
      await addBalanceToUser(selectedUser.uid, Number(balanceAmount), balanceNote);
      toast.success(`تم شحن ${balanceAmount} ج.م لـ ${selectedUser.displayName} ✅`);
      setShowBalanceModal(false);
      await loadData();
    } catch { toast.error('حدث خطأ'); }
    finally { setBalanceSaving(false); }
  };

  // ---- Deposit Approvals ----
  const handleApproveDeposit = async (reqId: string, userId: string, amount: number, email: string) => {
    try {
      const { approveDepositRequest } = await import('@/lib/firestore');
      await approveDepositRequest(reqId, userId, amount, email);
      toast.success('تم قبول طلب الشحن وإضافة الرصيد للعميل بنجاح ✅');
      await loadData();
    } catch {
      toast.error('حدث خطأ أثناء قبول الطلب');
    }
  };

  const handleRejectDeposit = async (reqId: string) => {
    if (!confirm('هل تريد رفض طلب شحن الرصيد هذا؟')) return;
    try {
      const { rejectDepositRequest } = await import('@/lib/firestore');
      await rejectDepositRequest(reqId);
      toast.error('تم رفض طلب الشحن ❌');
      await loadData();
    } catch {
      toast.error('حدث خطأ أثناء رفض الطلب');
    }
  };

  // ---- Order Status Update ----
  const handleUpdateStatus = async (txId: string, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      await updateOrderStatus(txId, status);
      toast.success('تم تحديث حالة الطلب بنجاح ✅');
      await loadData();
    } catch {
      toast.error('فشل تحديث الحالة');
    }
  };

  const totalBalance = users.reduce((s, u) => s + (u.balance || 0), 0);
  const purchaseTransactions = transactions.filter(t => t.type === 'purchase');

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

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (!isAdmin) return null;

  if (user && !user.emailVerified) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden', width: '100%' }}>
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(226,201,126,0.05) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        
        <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="navbar-logo" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Mr Sailnt</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>تأكيد البريد الإلكتروني للمشرف</p>

          <div className="glass-card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '3rem' }}>✉️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>يرجى تفعيل حساب المشرف أولاً</h2>
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
        <div className="navbar-logo" style={{ fontSize: '1.2rem' }}>Mr Sailnt (أدمن)</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
            <div>
              <div className="navbar-logo" style={{ fontSize: '1.3rem' }}>Mr Sailnt</div>
              <div className="badge-admin" style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.7rem' }}>لوحة الأدمن</div>
            </div>
            <button className="mobile-close" onClick={() => setMenuOpen(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

          {([
            { id: 'overview', icon: <LayoutDashboard size={18} />, label: 'نظرة عامة' },
            { id: 'services', icon: <Package size={18} />, label: 'الخدمات' },
            { id: 'orders', icon: <Wallet size={18} />, label: 'طلبات الخدمات' },
            { id: 'settings', icon: <Settings size={18} />, label: 'إعدادات الدفع' },
          ] as const).map(item => (
            <div key={item.id} className={`sidebar-item ${tab === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setMenuOpen(false); }}>
              {item.icon} {item.label}
            </div>
          ))}

          <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
          <Link href="/" className="sidebar-item" style={{ textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>
            <Home size={18} /> الرئيسية
          </Link>
          <div style={{ flex: 1 }} />
          <button onClick={async () => { await logout(); router.push('/'); }}
            className="sidebar-item" style={{ width: '100%', border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', textAlign: 'right', marginTop: '16px' }}>
            <LogOut size={18} /> خروج
          </button>
        </div>

        {/* Main */}
        <div className="main-content-layout" style={{ marginRight: '260px', flex: 1, padding: '40px 32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>
          {tab === 'overview' ? 'نظرة عامة' : tab === 'services' ? 'إدارة الخدمات' : tab === 'orders' ? 'إدارة طلبات الخدمات' : 'إعدادات الدفع'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>
          {tab === 'overview' ? 'إحصائيات الموقع' : tab === 'services' ? 'أضف وعدّل وأوقف الخدمات' : tab === 'orders' ? 'تابع طلبات الخدمات وتواصل مع العملاء والتحقق من تحويلاتهم' : 'تحديث أرقام وعناوين تحويل الأموال'}
        </p>

        {/* ===== OVERVIEW ===== */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            {[
              { label: 'إجمالي الخدمات', value: services.length, icon: <Package size={28} /> },
              { label: 'خدمات مفعّلة', value: services.filter(s => s.isAvailable).length, icon: <Star size={28} /> },
              { label: 'إجمالي المستخدمين', value: users.length, icon: <Users size={28} /> },
              { label: 'إجمالي الطلبات', value: purchaseTransactions.length, icon: <Wallet size={28} /> },
            ].map((stat, i) => (
              <div key={i} className="stat-card animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div style={{ color: 'var(--gold)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>{stat.icon}</div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ===== SERVICES ===== */}
        {tab === 'services' && (
          <div>
            <button className="btn-gold" onClick={openAddService} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Plus size={18} /> إضافة خدمة جديدة
            </button>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
            ) : (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>اسم الخدمة</th>
                      <th>القسم</th>
                      <th>الوصف</th>
                      <th>السعر</th>
                      <th>الحالة</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--gold)' }}>
                           {s.category === 'vodafone' ? 'خدمات فودافون' :
                            s.category === 'orange' ? 'خدمات اورنج' :
                            s.category === 'etisalat' ? 'خدمات اتصالات' :
                            s.category === 'we' ? 'خدمات We' :
                            s.category === 'civil' ? 'خدمات السجل المدني' : 'بدون'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: '200px' }}>{s.description || '-'}</td>
                        <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{s.price} ج.م</td>
                        <td>
                          <label className="toggle" title={s.isAvailable ? 'إيقاف' : 'تفعيل'}>
                            <input type="checkbox" checked={s.isAvailable} onChange={() => toggleService(s)} />
                            <span className="toggle-slider" />
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => openEditService(s)} style={{ background: 'rgba(226,201,126,0.1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--gold)' }}>
                              <Edit2 size={15} />
                            </button>
                            <button onClick={() => handleDelete(s)} className="btn-danger" style={{ padding: '6px 10px' }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {services.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>لا توجد خدمات بعد</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Users tab removed */}

        {/* ===== ORDERS ===== */}
        {tab === 'orders' && (
          <div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
            ) : (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>العميل</th>
                      <th>الخدمة المطلوبة</th>
                      <th>الرقم المطلوب</th>
                      <th>طريقة الدفع</th>
                      <th>الرقم المحول منه</th>
                      <th>الإثبات (الوصل)</th>
                      <th>التواصل والواتساب</th>
                      <th>التاريخ</th>
                      <th>الحالة الحالية</th>
                      <th>تحديث الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseTransactions.map(tx => (
                      <tr key={tx.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.displayName || 'مستخدم'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{tx.userEmail}</div>
                        </td>
                        <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{tx.serviceName}</td>
                        <td style={{ fontWeight: 'bold' }}>{tx.targetNumber || '-'}</td>
                        <td>
                          {tx.paymentMethod === 'instapay' ? (
                            <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>انستاباي</span>
                          ) : tx.paymentMethod === 'orange_cash' ? (
                            <span style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--gold)', border: '1px solid rgba(226,201,126,0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>كاش</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{tx.senderPhone || '-'}</td>
                        <td>
                          {tx.receiptImage ? (
                            <button 
                              className="btn-outline" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={() => setActiveScreenshot(tx.receiptImage)}
                            >
                              عرض الوصل 🖼️
                            </button>
                          ) : 'لا يوجد'}
                        </td>
                        <td>
                          {tx.whatsappNumber ? (
                            <a
                              href={`https://wa.me/${tx.whatsappNumber.startsWith('2') ? tx.whatsappNumber : '20' + tx.whatsappNumber}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-gold"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block' }}
                            >
                              واتساب: {tx.whatsappNumber}
                            </a>
                          ) : '-'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toLocaleString('ar-EG') : '-'}
                        </td>
                        <td>
                          {tx.status === 'pending' && <span style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>قيد المراجعة</span>}
                          {tx.status === 'in_progress' && <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>جاري العمل</span>}
                          {tx.status === 'completed' && <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>تم التسليم</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => handleUpdateStatus(tx.id, 'in_progress')}
                              style={{ padding: '5px 8px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer', background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#3b82f6' }}
                              disabled={tx.status === 'in_progress'}
                            >
                              ابدأ العمل
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(tx.id, 'completed')}
                              style={{ padding: '5px 8px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e' }}
                              disabled={tx.status === 'completed'}
                            >
                              تم التسليم
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {purchaseTransactions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>لا توجد طلبات خدمات بعد</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Deposits tab removed */}

        {/* ===== SETTINGS TAB ===== */}
        {tab === 'settings' && (
          <div className="glass-card animate-fade-up" style={{ padding: '32px', maxWidth: '600px' }}>
            <h2 className="section-title" style={{ marginBottom: '24px', fontSize: '1.25rem' }}>إعدادات طرق الدفع والشحن</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                  رقم تحويل أورنج كاش / فودافون كاش *
                </label>
                <input 
                  className="input-gold" 
                  type="text" 
                  value={orangeCashNumber} 
                  onChange={e => setOrangeCashNumber(e.target.value)} 
                  placeholder="مثال: 01201426302"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                  رقم أو عنوان انستاباي InstaPay *
                </label>
                <input 
                  className="input-gold" 
                  type="text" 
                  value={instaPayNumber} 
                  onChange={e => setInstaPayNumber(e.target.value)} 
                  placeholder="مثال: username@instapay أو رقم هاتف"
                  required
                />
              </div>

              <div className="divider" style={{ margin: '10px 0' }} />

              <div style={{ border: '1px dashed var(--border)', borderRadius: '12px', padding: '16px', background: 'rgba(226,201,126,0.02)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '14px' }}>🔔 إشعارات طلبات الخدمة الجديدة (تليجرام)</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                      رمز البوت Telegram Bot Token
                    </label>
                    <input 
                      className="input-gold" 
                      type="text" 
                      value={telegramBotToken} 
                      onChange={e => setTelegramBotToken(e.target.value)} 
                      placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsT..."
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                      معرف شات الأدمن Telegram Chat ID
                    </label>
                    <input 
                      className="input-gold" 
                      type="text" 
                      value={telegramChatId} 
                      onChange={e => setTelegramChatId(e.target.value)} 
                      placeholder="مثال: 987654321 أو معرف المجموعة"
                      style={{ fontSize: '0.85rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      نصيحة: يمكنك الحصول عليه بإرسال رسالة للبوت @userinfobot أو إضافته لمجموعة واستخدام معرف المجموعة.
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button 
                  className="btn-gold" 
                  onClick={handleSaveSettings} 
                  disabled={settingsSaving}
                  style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}
                >
                  <Save size={18} /> {settingsSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>


      {/* ===== SERVICE MODAL ===== */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</h2>
              <button onClick={() => setShowServiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={22} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>اسم الخدمة *</label>
                <input className="input-gold" placeholder="مثال: تصميم شعار" value={svcName} onChange={e => setSvcName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>وصف الخدمة</label>
                <textarea className="input-gold" placeholder="وصف مختصر للخدمة..." value={svcDesc} onChange={e => setSvcDesc(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>السعر (ج.م) *</label>
                <input className="input-gold" type="number" placeholder="0" value={svcPrice} onChange={e => setSvcPrice(e.target.value)} min="0" />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>القسم التابع له الخدمة</label>
                <select 
                  className="input-gold" 
                  value={svcCategory} 
                  onChange={e => setSvcCategory(e.target.value)}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px', width: '100%', fontFamily: 'var(--font-tajawal), sans-serif' }}
                >
                  <option value="none">بدون (خدمة مستقلة / رئيسية)</option>
                  <option value="vodafone">خدمات فودافون</option>
                  <option value="orange">خدمات اورنج</option>
                  <option value="etisalat">خدمات اتصالات</option>
                  <option value="we">خدمات We</option>
                  <option value="civil">خدمات السجل المدني</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-gold" onClick={saveService} disabled={svcSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Save size={17} /> {svcSaving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button className="btn-outline" onClick={() => setShowServiceModal(false)} style={{ flex: 1 }}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== BALANCE MODAL ===== */}
      {showBalanceModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowBalanceModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>شحن رصيد</h2>
              <button onClick={() => setShowBalanceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={22} /></button>
            </div>
            <div style={{ background: 'rgba(226,201,126,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>المستخدم</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '4px' }}>{selectedUser.displayName}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedUser.email}</div>
              <div style={{ marginTop: '8px', color: 'var(--gold)', fontWeight: 700 }}>الرصيد الحالي: {(selectedUser.balance || 0).toFixed(2)} ج.م</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>المبلغ (ج.م) *</label>
                <input className="input-gold" type="number" placeholder="0" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} min="1" />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>ملاحظة</label>
                <input className="input-gold" placeholder="سبب الشحن" value={balanceNote} onChange={e => setBalanceNote(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-gold" onClick={saveBalance} disabled={balanceSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Wallet size={17} /> {balanceSaving ? 'جاري الشحن...' : 'شحن الرصيد'}
                </button>
                <button className="btn-outline" onClick={() => setShowBalanceModal(false)} style={{ flex: 1 }}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SCREENSHOT LIGHTBOX MODAL ===== */}
      {activeScreenshot && (
        <div className="modal-overlay" onClick={() => setActiveScreenshot(null)} style={{ zIndex: 3000 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', textAlign: 'center', background: '#0c0c14' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>إثبات التحويل المرفق</h3>
              <button onClick={() => setActiveScreenshot(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.2rem' }}>×</button>
            </div>
            <img 
              src={activeScreenshot} 
              alt="Uploaded receipt attachment" 
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border)' }} 
            />
            <button className="btn-gold" onClick={() => setActiveScreenshot(null)} style={{ marginTop: '20px', width: '100%' }}>
              إغلاق المعاينة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
