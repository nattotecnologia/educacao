'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';
import { useBranding } from '@/contexts/BrandingContext';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const branding = useBranding();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const activeLogo = theme === 'dark' ? branding?.logo_light_url : branding?.logo_dark_url;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro no login.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Background Animated Blobs */}
      <div className={`${styles.bgBlob} ${styles.blob1}`}></div>
      <div className={`${styles.bgBlob} ${styles.blob2}`}></div>

      <div className={`glass-panel animate-in ${styles.loginCard}`}>
        <div className={styles.header}>
          {mounted && activeLogo && (
            <img src={activeLogo} alt="Logo" className={styles.loginLogo} />
          )}
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Acesse a plataforma Educacional de IA</p>
        </div>

        {errorMsg && (
          <div className={styles.errorAlert} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input 
              id="email" 
              type="email" 
              required 
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="password">Senha</label>
            <input 
              id="password" 
              type="password" 
              required 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
            />
          </div>

          <button 
            type="submit" 
            className={`custom-button ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar na Plataforma'}
          </button>
        </form>

        <div className={styles.footer}>
          Não tem uma conta? <Link href="/register">Cadastre sua empresa</Link>
          <br/><br/>
          Esqueceu sua senha? <a href="#">Recuperar acesso</a>
        </div>
      </div>
    </div>
  );
}
