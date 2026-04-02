'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ArrowLeft, Loader2, Save, Sparkles, MessageSquare } from 'lucide-react';
import { agentService } from '@/services';

export default function NewAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    system_prompt: '',
    status: 'active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.system_prompt) {
      setError('Nome e Prompt são obrigatórios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await agentService.create(form);
      router.push('/dashboard/agents');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar agente.');
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem' };
  const labelStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', width: 'fit-content', background: 'none', border: 'none', cursor: 'pointer' }}>
        <ArrowLeft size={18} /> Voltar para a lista
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Criar Agente IA</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Defina a personalidade e missão deste assistente.</p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle}><Sparkles size={14} /> Nome do Agente</label>
              <input 
                type="text" 
                placeholder="Ex: SDR Vendas Primário" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                style={inputStyle} 
              />
            </div>
            
            <div>
              <label style={labelStyle}><MessageSquare size={14} /> System Prompt (Instruções da IA)</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Escreva de forma detalhada como a IA deve agir e o que ela deve responder.
              </p>
              <textarea 
                placeholder="Ex: Você é um assistente de vendas da Edux. Sua missão é agendar reuniões com leads interessados em cursos de TI..." 
                value={form.system_prompt} 
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} 
                rows={12}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '0.75rem 1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Descartar
            </button>
            <button type="submit" className="custom-button" disabled={loading} style={{ minWidth: '160px' }}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Salvar Agente</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
