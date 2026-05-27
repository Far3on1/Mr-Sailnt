'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('من فضلك أدخل جميع البيانات');
    if (mode === 'register' && !name) return toast.error('أدخل اسمك');
    if (password.length < 6) return toast.error('كلمة المرور 6 أحرف على الأقل');

    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        toast.success('أهلاً بك! 👋');
      } else {
        await registerWithEmail(email, password, name);
        toast.success('تم إنشاء الحساب بنجاح! 🎉');
      }
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found' ? 'الإيميل غير مسجل'
        : err.code === 'auth/wrong-password' ? 'كلمة المرور غلط'
        : err.code === 'auth/email-already-in-use' ? 'الإيميل مسجل من قبل'
        : err.code === 'auth/invalid-email' ? 'إيميل غير صحيح'
        : 'حدث خطأ، حاول مجدداً';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast.success('أهلاً بك! 👋');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Google Error:', err);
      toast.error(`خطأ: ${err.code || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Background Glow */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(226,201,126,0.05) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginBottom: '32px' }}>
          <div className="navbar-logo" style={{ fontSize: '2rem' }}>Mr Sailnt</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.9rem' }}>خدمات رقمية احترافية</p>
        </Link>

        <div className="glass-card" style={{ padding: '36px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '4px', marginBottom: '28px' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: mode === m ? 'var(--gold-dark)' : 'transparent',
                color: mode === m ? '#0a0a0f' : 'var(--text-secondary)',
                fontWeight: mode === m ? 700 : 400,
                transition: 'all 0.3s ease',
                fontFamily: 'var(--font-tajawal), sans-serif',
                fontSize: '1rem',
              }}>
                {m === 'login' ? 'تسجيل الدخول' : 'حساب جديد'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'register' && (
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input className="input-gold" type="text" placeholder="اسمك الكامل" value={name} onChange={e => setName(e.target.value)} style={{ paddingRight: '44px' }} />
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input className="input-gold" type="email" placeholder="الإيميل" value={email} onChange={e => setEmail(e.target.value)} style={{ paddingRight: '44px' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input className="input-gold" type={showPass ? 'text' : 'password'} placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: '44px', paddingLeft: '44px' }} />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button className="btn-gold" type="submit" disabled={loading} style={{ marginTop: '4px', fontSize: '1.05rem', padding: '14px' }}>
              {loading ? '...' : mode === 'login' ? 'دخول' : 'إنشاء حساب'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>أو</span>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
          </div>

          <button onClick={handleGoogle} disabled={loading} style={{
            width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            fontFamily: 'var(--font-tajawal), sans-serif', fontSize: '1rem', transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            تسجيل الدخول بـ Google
          </button>
        </div>
      </div>
    </div>
  );
}
