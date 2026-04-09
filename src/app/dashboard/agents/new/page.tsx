'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, ArrowLeft, Loader2, Save, Sparkles, MessageSquare,
  Thermometer, Hash, Cpu, MessageCircle, Zap, Star,
  AlignLeft, Clock, ToggleLeft, ToggleRight, Info
} from 'lucide-react';
import { agentService, AgentRole, AgentPayload } from '@/services';

const ROLE_OPTIONS: { value: AgentRole; label: string; emoji: string; description: string }[] = [
  { value: 'reception', label: 'Recepção', emoji: '🤝', description: ' 1º contato, boas-vindas e triagem de leads' },
  { value: 'sdr', label: 'SDR / Vendas', emoji: '📞', description: 'Qualificação e agendamento de reuniões' },
  { value: 'followup', label: 'Follow-up', emoji: '🔔', description: 'Reengajamento e acompanhamento de leads' },
  { value: 'support', label: 'Suporte', emoji: '💬', description: 'Tirar dúvidas e suporte ao aluno' },
  { value: 'custom', label: 'Personalizado', emoji: '⚙️', description: 'Comportamento totalmente customizado' },
];

const DEFAULT_FORM: AgentPayload = {
  name: '',
  system_prompt: '',
  status: 'active',
  agent_role: 'custom',
  temperature: 0.7,
  max_tokens: 500,
  ai_model_override: '',
  enable_line_breaks: false,
  response_delay_ms: 800,
  max_history_messages: 10,
  greeting_message: '',
  fallback_message: '',
  is_default: false,
};

export default function NewAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<AgentPayload>(DEFAULT_FORM);

  const set = (key: keyof AgentPayload, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.system_prompt) {
      setError('Nome e System Prompt são obrigatórios.');
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

  const s = {
    input: {
      width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)',
      border: '1px solid var(--glass-border)', borderRadius: '8px',
      color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' as const
    },
    label: {
      display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem',
      color: 'var(--text-muted)', marginBottom: '0.5rem',
      textTransform: 'uppercase' as const, letterSpacing: '0.05em'
    },
    section: {
      padding: '1.5rem', background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--glass-border)', borderRadius: '12px', display: 'flex',
      flexDirection: 'column' as const, gap: '1.25rem'
    },
    sectionTitle: {
      display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
      fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem'
    },
    hint: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' },
    toggle: {
      width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
      transition: 'background 0.2s', display: 'flex', alignItems: 'center', padding: '2px',
      flexShrink: 0
    },
    toggleKnob: {
      width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
      transition: 'transform 0.2s'
    }
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{ ...s.toggle, background: value ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)' }}
    >
      <div style={{ ...s.toggleKnob, transform: value ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '860px' }}>
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', width: 'fit-content', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <ArrowLeft size={18} /> Voltar para a lista
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Criar Agente IA</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Configure identidade, comportamento e mensagens do assistente.</p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── SEÇÃO 1: Identidade ── */}
          <div style={s.section}>
            <div style={s.sectionTitle}><Sparkles size={15} /> Identidade & Papel</div>

            {/* Nome */}
            <div>
              <label style={s.label}>Nome do Agente</label>
              <input
                type="text"
                placeholder="Ex: SDR Vendas, Suporte 24h..."
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                style={s.input}
              />
            </div>

            {/* Papel */}
            <div>
              <label style={s.label}>Papel Predefinido</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => set('agent_role', role.value)}
                    style={{
                      padding: '0.875rem 1rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                      border: `1px solid ${form.agent_role === role.value ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                      background: form.agent_role === role.value ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.15)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>{role.emoji}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{role.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{role.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Agente Padrão */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  <Star size={14} style={{ color: '#f59e0b' }} /> Agente Padrão da Instituição
                </div>
                <p style={s.hint}>Se ativo, este agente é priorizado quando há mensagens novas.</p>
              </div>
              <Toggle value={form.is_default!} onChange={(v) => set('is_default', v)} />
            </div>
          </div>

          {/* ── SEÇÃO 2: System Prompt ── */}
          <div style={s.section}>
            <div style={s.sectionTitle}><MessageSquare size={15} /> System Prompt</div>
            <div>
              <label style={s.label}>Instruções da IA</label>
              <p style={s.hint}>Descreva detalhadamente como a IA deve se comportar, o que responder e o que evitar.</p>
              <textarea
                placeholder="Você é um assistente de vendas da [Escola]. Sua missão é qualificar leads interessados em cursos e agendar visitas. Seja cordial, objetivo e nunca prometa valores sem confirmação..."
                value={form.system_prompt}
                onChange={(e) => set('system_prompt', e.target.value)}
                rows={10}
                style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6', marginTop: '0.5rem' }}
              />
              <p style={{ ...s.hint, textAlign: 'right' }}>{form.system_prompt.length} caracteres</p>
            </div>
          </div>

          {/* ── SEÇÃO 3: Comportamento da IA ── */}
          <div style={s.section}>
            <div style={s.sectionTitle}><Cpu size={15} /> Comportamento da IA</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Temperatura */}
              <div>
                <label style={s.label}><Thermometer size={13} /> Temperatura: {form.temperature}</label>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={form.temperature}
                  onChange={(e) => set('temperature', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', ...s.hint, marginTop: '0.25rem' }}>
                  <span>Focado (0)</span><span>Balanceado (0.7)</span><span>Criativo (2)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label style={s.label}><Hash size={13} /> Tokens Máximos</label>
                <input
                  type="number" min="50" max="4000" step="50"
                  value={form.max_tokens}
                  onChange={(e) => set('max_tokens', parseInt(e.target.value))}
                  style={s.input}
                />
                <p style={s.hint}>Limite de tokens por resposta da IA (50–4000).</p>
              </div>

              {/* Modelo Override */}
              <div>
                <label style={s.label}><Cpu size={13} /> Modelo Específico (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: gpt-4o, llama-3.3-70b..."
                  value={form.ai_model_override || ''}
                  onChange={(e) => set('ai_model_override', e.target.value)}
                  style={s.input}
                />
                <p style={s.hint}>Se vazio, usa o modelo configurado na instituição.</p>
              </div>

              {/* Histórico */}
              <div>
                <label style={s.label}><AlignLeft size={13} /> Histórico de Mensagens</label>
                <input
                  type="number" min="1" max="50"
                  value={form.max_history_messages}
                  onChange={(e) => set('max_history_messages', parseInt(e.target.value))}
                  style={s.input}
                />
                <p style={s.hint}>Quantidade de mensagens anteriores enviadas como contexto.</p>
              </div>
            </div>
          </div>

          {/* ── SEÇÃO 4: Mensagens Especiais ── */}
          <div style={s.section}>
            <div style={s.sectionTitle}><MessageCircle size={15} /> Mensagens Especiais</div>

            <div>
              <label style={s.label}><Zap size={13} /> Mensagem de Boas-Vindas (Greeting)</label>
              <textarea
                placeholder="Ex: Olá! Seja bem-vindo(a)! Sou a assistente virtual da [Escola]. Como posso te ajudar hoje? 😊"
                value={form.greeting_message || ''}
                onChange={(e) => set('greeting_message', e.target.value)}
                rows={3}
                style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
              />
              <p style={s.hint}>Enviada automaticamente quando um novo lead entra em contato pela primeira vez.</p>
            </div>

            <div>
              <label style={s.label}><Info size={13} /> Mensagem de Fallback (Erro)</label>
              <textarea
                placeholder="Ex: Desculpe, estou com dificuldades técnicas. Um atendente irá te ajudar em breve!"
                value={form.fallback_message || ''}
                onChange={(e) => set('fallback_message', e.target.value)}
                rows={3}
                style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
              />
              <p style={s.hint}>Usada quando a IA falha ou não há API Key configurada.</p>
            </div>
          </div>

          {/* ── SEÇÃO 5: Formatação de Respostas ── */}
          <div style={s.section}>
            <div style={s.sectionTitle}><ToggleRight size={15} /> Formatação de Respostas</div>

            {/* Quebra de linha */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>Ativar Quebra de Linha</div>
                <p style={s.hint}>
                  Quando ativado, mensagens com parágrafos separados por linhas em branco são enviadas
                  em <strong>múltiplas mensagens</strong> no WhatsApp — experiência mais natural.
                </p>
              </div>
              <Toggle value={form.enable_line_breaks!} onChange={(v) => set('enable_line_breaks', v)} />
            </div>

            {/* Delay */}
            {form.enable_line_breaks && (
              <div>
                <label style={s.label}><Clock size={13} /> Delay Entre Partes: {form.response_delay_ms}ms</label>
                <input
                  type="range" min="300" max="3000" step="100"
                  value={form.response_delay_ms}
                  onChange={(e) => set('response_delay_ms', parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', ...s.hint, marginTop: '0.25rem' }}>
                  <span>Rápido (300ms)</span><span>Natural (800ms)</span><span>Lento (3s)</span>
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
            <button
              type="button"
              onClick={() => router.back()}
              style={{ padding: '0.75rem 1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
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
