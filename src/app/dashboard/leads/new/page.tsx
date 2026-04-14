'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Phone, User, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { leadService } from '@/services';
import { maskPhone } from '@/utils/masks';

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', notes: '', status: 'new' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone) { setError('Telefone é obrigatório.'); return; }
    setLoading(true);
    setError('');
    try {
      await leadService.create(form);
      router.push('/dashboard/leads');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar lead.');
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem' };
  const labelStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', width: 'fit-content' }}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <UserPlus size={24} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Novo Lead</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Cadastre um contato manualmente.</p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}><User size={14} /> Nome Completo</label>
            <input type="text" placeholder="Ex: João Silva" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}><Phone size={14} /> Telefone / WhatsApp *</label>
            <input type="tel" required placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}><FileText size={14} /> Observações</label>
            <textarea placeholder="Informações adicionais..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '0.75rem 1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" className="custom-button" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><UserPlus size={18} /> Cadastrar Lead</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
