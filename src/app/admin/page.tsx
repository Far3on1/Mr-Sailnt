'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getServices, addService, updateService, deleteService,
  getAllUsers, addBalanceToUser, Service, UserRecord,
  getAllTransactions, updateOrderStatus
} from '@/lib/firestore';

import {
  LayoutDashboard, Package, Users, Plus, Edit2, Trash2,
  ToggleLeft, ToggleRight, Wallet, Home, LogOut, Save, X, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

type Tab = 'overview' | 'services' | 'users' | 'orders' | 'deposits';

export default function AdminPage() {
  const { user, isAdmin, logout, loading: authLoading } = useAuth();

  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
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

  // Balance Modal
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/auth'); return; }
    if (!isAdmin) { router.push('/dashboard'); return; }
  }, [user, isAdmin, authLoading]);


  const loadData = async () => {
    setLoading(true);
    const { getDepositRequests } = await import('@/lib/firestore');
    const [svcs, usrs, txs, deps] = await Promise.all([
      getServices(), 
      getAllUsers(), 
      getAllTransactions(),
      getDepositRequests()
    ]);
    setServices(svcs);
    setUsers(usrs.filter(u => u.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL));
    setTransactions(txs);
    setDepositRequests(deps);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

  // ---- Service CRUD ----
  const openAddService = () => {
    setEditingService(null);
    setSvcName(''); setSvcDesc(''); setSvcPrice('');
    setShowServiceModal(true);
  };
  const openEditService = (s: Service) => {
    setEditingService(s);
    setSvcName(s.name); setSvcDesc(s.description); setSvcPrice(String(s.price));
    setShowServiceModal(true);
  };
  const saveService = async () => {
    if (!svcName || !svcPrice) return toast.error('أدخل اسم السعر');
    setSvcSaving(true);
    try {
      if (editingService) {
        await updateService(editingService.id, { name: svcName, description: svcDesc, price: Number(svcPrice) });
        toast.success('تم تعديل الخدمة ✅');
      } else {
        await addService({ name: svcName, description: svcDesc, price: Number(svcPrice), isAvailable: true });
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

  if (!isAdmin) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex' }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{ marginBottom: '8px', padding: '0 8px' }}>
          <div className="navbar-logo" style={{ fontSize: '1.3rem' }}>Mr Sailnt</div>
          <div className="badge-admin" style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.7rem' }}>لوحة الأدمن</div>
        </div>
        <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

        {([
          { id: 'overview', icon: <LayoutDashboard size={18} />, label: 'نظرة عامة' },
          { id: 'services', icon: <Package size={18} />, label: 'الخدمات' },
          { id: 'users', icon: <Users size={18} />, label: 'المستخدمون' },
          { id: 'orders', icon: <Wallet size={18} />, label: 'طلبات الخدمات' },
          { id: 'deposits', icon: <Wallet size={18} />, label: 'طلبات الشحن' },
        ] as const).map(item => (
          <div key={item.id} className={`sidebar-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            {item.icon} {item.label}
          </div>
        ))}

        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
        <Link href="/" className="sidebar-item" style={{ textDecoration: 'none' }}>
          <Home size={18} /> الرئيسية
        </Link>
        <div style={{ flex: 1 }} />
        <button onClick={async () => { await logout(); router.push('/'); }}
          className="sidebar-item" style={{ width: '100%', border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', textAlign: 'right', marginTop: '16px' }}>
          <LogOut size={18} /> خروج
        </button>
      </div>

      {/* Main */}
      <div style={{ marginRight: '260px', flex: 1, padding: '40px 32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>
          {tab === 'overview' ? 'نظرة عامة' : tab === 'services' ? 'إدارة الخدمات' : tab === 'users' ? 'إدارة المستخدمين' : tab === 'orders' ? 'إدارة طلبات الخدمات' : 'إدارة طلبات الشحن'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>
          {tab === 'overview' ? 'إحصائيات الموقع' : tab === 'services' ? 'أضف وعدّل وأوقف الخدمات' : tab === 'users' ? 'أضف رصيد للمستخدمين' : 'تابع طلبات العملاء وتواصل معهم'}
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

        {/* ===== USERS ===== */}
        {tab === 'users' && (
          <div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
            ) : (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>الإيميل</th>
                      <th>الرصيد</th>
                      <th>شحن رصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.uid}>
                        <td style={{ fontWeight: 600 }}>{u.displayName}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.email}</td>
                        <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{(u.balance || 0).toFixed(2)} ج.م</td>
                        <td>
                          <button onClick={() => openBalance(u)} className="btn-gold" style={{ padding: '7px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Wallet size={15} /> شحن
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>لا يوجد مستخدمون مسجلون بعد</div>
                )}
              </div>
            )}
          </div>
        )}

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
                          <div style={{ fontWeight: 600 }}>{tx.displayName || 'مستحدم'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{tx.userEmail}</div>
                        </td>
                        <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{tx.serviceName}</td>
                        <td style={{ fontWeight: 'bold' }}>{tx.targetNumber || '-'}</td>
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

        {/* ===== DEPOSITS TAB ===== */}
        {tab === 'deposits' && (
          <div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
            ) : (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>العميل</th>
                      <th>المبلغ</th>
                      <th>الرقم المحول منه</th>
                      <th>الإثبات (الوصل)</th>
                      <th>التاريخ</th>
                      <th>الحالة</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depositRequests.map(req => (
                      <tr key={req.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{req.displayName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{req.userEmail}</div>
                        </td>
                        <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{req.amount} ج.م</td>
                        <td style={{ fontWeight: 'bold' }}>{req.senderPhone}</td>
                        <td>
                          {req.receiptImage ? (
                            <button 
                              className="btn-outline" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={() => setActiveScreenshot(req.receiptImage)}
                            >
                              عرض الإسكرين 🖼️
                            </button>
                          ) : 'لا توجد صورة'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleString('ar-EG') : '-'}
                        </td>
                        <td>
                          {req.status === 'pending' && <span style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>قيد المراجعة</span>}
                          {req.status === 'approved' && <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>تم الشحن ✅</span>}
                          {req.status === 'rejected' && <span style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>مرفوض ❌</span>}
                        </td>
                        <td>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                onClick={() => handleApproveDeposit(req.id, req.userId, req.amount, req.userEmail)}
                                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e', fontWeight: 600 }}
                              >
                                قبول
                              </button>
                              <button 
                                onClick={() => handleRejectDeposit(req.id)}
                                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer', background: 'rgba(220,38,38,0.15)', border: '1px solid #dc2626', color: '#f87171' }}
                              >
                                رفض
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>مكتمل</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {depositRequests.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>لا توجد طلبات شحن بعد</div>
                )}
              </div>
            )}
          </div>
        )}
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
