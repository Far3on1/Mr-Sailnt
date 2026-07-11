'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getServices, Service, purchaseService, getPaymentSettings, PaymentSettings } from '@/lib/firestore';
import { Wallet, Copy, Check, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function PurchaseContent() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('id');

  const [service, setService] = useState<Service | null>(null);
  const [loadingService, setLoadingService] = useState(true);
  const [buying, setBuying] = useState(false);

  // Form Fields
  const [targetNumber, setTargetNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [depositSender, setDepositSender] = useState('');
  const [depositReceipt, setDepositReceipt] = useState('');
  const [depositMethod, setDepositMethod] = useState<'orange_cash' | 'instapay'>('orange_cash');
  const [copied, setCopied] = useState(false);

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
    if (!serviceId) {
      toast.error('لم يتم تحديد خدمة صالحة');
      router.push('/');
      return;
    }

    setLoadingService(true);
    getServices()
      .then((services) => {
        const found = services.find(s => s.id === serviceId);
        if (found) {
          setService(found);
        } else {
          toast.error('الخدمة المطلوبة غير موجودة');
          router.push('/');
        }
      })
      .catch(() => {
        toast.error('فشل تحميل تفاصيل الخدمة');
        router.push('/');
      })
      .finally(() => setLoadingService(false));
  }, [serviceId, router]);

  // Protect page: Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && user === null) {
      toast.error('يرجى تسجيل الدخول أولاً لإتمام عملية الشراء');
      router.push(`/auth?redirect=/purchase?id=${serviceId}`);
    }
  }, [user, loading, router, serviceId]);

  const handleCopyNumber = () => {
    const num = depositMethod === 'orange_cash' ? paymentSettings.orangeCashNumber : paymentSettings.instaPayNumber;
    navigator.clipboard.writeText(num);
    setCopied(true);
    toast.success('تم نسخ الرقم/العنوان بنجاح 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 800;
      const maxH = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h = (maxW / w) * h; w = maxW; }
      if (h > maxH) { w = (maxH / h) * w; h = maxH; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.5);
      setDepositReceipt(compressed);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !service) return;
    if (!targetNumber.trim()) return toast.error('يرجى كتابة الرقم المطلوب');
    if (!whatsappNumber.trim()) return toast.error('يرجى كتابة رقم الواتساب');
    if (!depositSender.trim()) return toast.error('يرجى كتابة رقم/حساب المحول منه');
    if (!depositReceipt) return toast.error('يرجى إرفاق صورة إثبات التحويل');

    const isNationalIdService = service.name.includes('الرقم القومي') || service.name.includes('تموين') || service.category === 'civil';
    if (isNationalIdService && !/^\d{14}$/.test(targetNumber.trim())) {
      return toast.error('يجب أن يتكون الرقم القومي من 14 رقم بالضبط');
    }

    setBuying(true);
    try {
      await purchaseService(
        user.uid,
        user.email || '',
        userData?.displayName || 'مستخدم',
        service,
        targetNumber,
        whatsappNumber,
        depositSender,
        depositReceipt,
        depositMethod,
        userData?.tier || 'normal'
      );
      toast.success(`تم إرسال طلب "${service.name}" بنجاح! قيد المراجعة حالياً ⏳`);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إرسال الطلب');
      setBuying(false);
    }
  };

  if (loading || loadingService || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--gold)', marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>جاري تحميل تفاصيل الطلب والأمان...</p>
      </div>
    );
  }

  if (!service) return null;

  const userTier = userData?.tier || 'normal';
  let activePrice = service.price;
  let showDiscount = false;

  if (userTier === 'vip' && service.vipPrice) {
    activePrice = service.vipPrice;
    showDiscount = true;
  } else if (userTier === 'reseller' && service.resellerPrice) {
    activePrice = service.resellerPrice;
    showDiscount = true;
  }

  const isNationalId = service.name.includes('الرقم القومي') || service.name.includes('تموين') || service.category === 'civil';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px 16px', position: 'relative', overflow: 'hidden' }}>
      {/* Background Glow */}
      <div style={{
        position: 'absolute', top: '10%', right: '10%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(226,201,126,0.04) 0%, transparent 75%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        


        {/* Purchase Card */}
        <div className="premium-card" style={{ padding: '32px' }}>
          
          {/* Service Title */}
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>طلب خدمة جديدة</span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              {service.name}
            </h1>
            {service.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px', lineHeight: '1.6' }}>
                {service.description}
              </p>
            )}
          </div>

          {/* Pricing Info Box */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '16px 20px', 
            background: 'rgba(226,201,126,0.03)', 
            border: '1px solid var(--border)', 
            borderRadius: '12px', 
            marginBottom: '28px' 
          }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>سعر الخدمة الإجمالي:</div>
              {showDiscount && (
                <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600 }}>
                  ✨ سعر خاص بـ {userTier === 'vip' ? 'عضو VIP' : 'موزع'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gold)' }}>
              {activePrice} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)' }}>ج.م</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleBuy} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Target Field */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                {isNationalId ? 'الرقم القومي المراد الاستعلام عنه (14 رقم) *' : 'رقم الهاتف المراد سحب بياناته *'}
              </label>
              <input
                className="input-gold"
                type="text"
                required
                placeholder={isNationalId ? 'مثال: 2991201xxxxxxxx' : 'مثال: 01xxxxxxxxx'}
                value={targetNumber}
                onChange={e => setTargetNumber(e.target.value)}
                style={{ padding: '12px 16px' }}
              />
            </div>

            {/* WhatsApp Field */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                رقم الواتساب الخاص بك للتواصل *
              </label>
              <input
                className="input-gold"
                type="text"
                required
                placeholder="مثال: 01xxxxxxxxx"
                value={whatsappNumber}
                onChange={e => setWhatsappNumber(e.target.value)}
                style={{ padding: '12px 16px' }}
              />
            </div>

            {/* Payment Details Container */}
            <div style={{ 
              marginTop: '10px', 
              padding: '20px', 
              background: 'rgba(20,20,32,0.6)', 
              border: '1px solid var(--border)', 
              borderRadius: '16px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '16px' }}>
                <Wallet size={18} /> تفاصيل الدفع وتحويل المبلغ
              </div>

              {/* Payment Method Selector */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                  type="button"
                  className={depositMethod === 'orange_cash' ? 'btn-gold' : 'btn-outline'}
                  onClick={() => setDepositMethod('orange_cash')}
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '10px', cursor: 'pointer' }}
                >
                  أورنج / فودافون كاش
                </button>
                <button
                  type="button"
                  className={depositMethod === 'instapay' ? 'btn-gold' : 'btn-outline'}
                  onClick={() => setDepositMethod('instapay')}
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '10px', cursor: 'pointer' }}
                >
                  انستاباي InstaPay
                </button>
              </div>

              {/* Copy Address Box */}
              <div style={{ 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid var(--border)', 
                borderRadius: '10px', 
                padding: '14px', 
                marginBottom: '20px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>التحويل إلى حساب:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold)', marginTop: '4px', letterSpacing: '0.5px' }}>
                    {depositMethod === 'orange_cash' ? paymentSettings.orangeCashNumber : paymentSettings.instaPayNumber}
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn-gold" 
                  onClick={handleCopyNumber} 
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '0.8rem', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'تم النسخ' : 'نسخ الرقم'}
                </button>
              </div>

              {/* Sender Details */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  {depositMethod === 'orange_cash' ? 'رقم المحفظة التي قمت بالتحويل منها *' : 'اسم حساب انستاباي / رقم المحفظة المحول منها *'}
                </label>
                <input
                  className="input-gold"
                  type="text"
                  required
                  placeholder={depositMethod === 'orange_cash' ? 'مثال: 01xxxxxxxxx' : 'مثال: username@instapay'}
                  value={depositSender}
                  onChange={e => setDepositSender(e.target.value)}
                  style={{ padding: '10px 14px', fontSize: '0.9rem' }}
                />
              </div>

              {/* Receipt Image Upload */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                  صورة إثبات التحويل (لقطة الشاشة / رسالة التأكيد) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    id="receipt-file"
                    accept="image/*" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />
                  <label 
                    htmlFor="receipt-file"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px dashed var(--border)',
                      background: 'rgba(255,255,255,0.02)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--gold)';
                      e.currentTarget.style.color = 'var(--gold)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <Upload size={16} /> {depositReceipt ? 'تغيير الصورة المرفوعة' : 'رفع إثبات التحويل'}
                  </label>
                </div>

                {depositReceipt && (
                  <div style={{ 
                    marginTop: '12px', 
                    textAlign: 'center', 
                    border: '1px solid var(--border)', 
                    borderRadius: '12px', 
                    padding: '8px', 
                    background: 'rgba(0,0,0,0.4)',
                    position: 'relative'
                  }}>
                    <img 
                      src={depositReceipt} 
                      alt="Receipt preview" 
                      style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '8px', objectFit: 'contain' }} 
                    />
                    <button
                      type="button"
                      onClick={() => setDepositReceipt('')}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
              <button 
                type="submit" 
                className="btn-gold" 
                disabled={buying} 
                style={{ flex: 1, padding: '14px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
              >
                {buying ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> جاري إرسال الطلب...
                  </>
                ) : (
                  'تأكيد الشراء وإرسال الطلب 🚀'
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

export default function PurchasePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--gold)', marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>جاري تحميل الصفحة...</p>
      </div>
    }>
      <PurchaseContent />
    </Suspense>
  );
}
