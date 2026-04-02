'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import styles from './register.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    institutionName: '',
    email: '',
    password: '',
  });

  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. SignUp no Supabase com Metadata adicional
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            institution_name: formData.institutionName,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      } else {
        setSuccess(true);
        setLoading(false);
        // Após 3 segundos redireciona, ou após confirmação
        setTimeout(() => router.push('/login'), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar cadastro.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <div className={`glass-panel animate-in ${styles.registerCard}`} style={{ textAlign: 'center' }}>
          <div className={styles.header}>
            <ShieldCheck size={64} color="var(--accent-success)" style={{ margin: '0 auto 1.5rem' }} />
            <h1 className={styles.title}>Verifique seu Email</h1>
            <p className={styles.subtitle}>
              Enviamos um link de confirmação para {formData.email}.<br/>
              Acesse sua caixa de entrada para ativar sua conta na EduDashboard.
            </p>
          </div>
          <Link href="/login" className="custom-button" style={{ marginTop: '1rem' }}>
            Ir para Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Background Blobs */}
      <div className={`${styles.bgBlob} ${styles.blob1}`}></div>
      <div className={`${styles.bgBlob} ${styles.blob2}`}></div>

      <div className={`glass-panel animate-in ${styles.registerCard}`}>
        <div className={styles.header}>
          <h1 className={styles.title}>Crie sua Conta SaaS</h1>
          <p className={styles.subtitle}>Comece agora o gerenciamento inteligente da sua escola.</p>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Seu Nome Completo</label>
            <input 
              type="text" 
              required 
              placeholder="Ex: Dr. Fulano de Tal"
              className={styles.input}
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Nome da Escola/Empresa</label>
            <input 
              type="text" 
              required 
              placeholder="Ex: Escola de Inglês Edu"
              className={styles.input}
              value={formData.institutionName}
              onChange={(e) => setFormData({...formData, institutionName: e.target.value})}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Corporativo</label>
            <input 
              type="email" 
              required 
              placeholder="atendimento@suaempresa.com"
              className={styles.input}
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Senha</label>
            <input 
              type="password" 
              required 
              placeholder="Mínimo 6 caracteres"
              className={styles.input}
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <div className={styles.infoBox}>
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>Ao se registrar, você se torna Administrador do plano institucional.</span>
          </div>

          <button 
            type="submit" 
            className={`custom-button ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Criar minha conta agora'}
          </button>
        </form>

        <div className={styles.footer}>
          Já possui conta? <Link href="/login">Fazer Login</Link>
        </div>
      </div>
    </div>
  );
}
