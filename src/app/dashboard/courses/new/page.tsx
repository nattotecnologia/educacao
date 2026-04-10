'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, BookOpen, Save } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const MODALITY_OPTIONS = [
  { value: 'presential', label: '🏫 Presencial', desc: 'Aulas na instituição física' },
  { value: 'online', label: '💻 Online / EAD', desc: 'Aulas 100% remotas' },
  { value: 'hybrid', label: '🔀 Híbrido', desc: 'Mescla presencial e online' },
];

export default function NewCoursePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    modality: 'presential',
    duration_hours: '',
    price: '',
    is_active: true,
  });

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError('Nome do curso é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          ...form,
          duration_hours: form.duration_hours ? parseInt(form.duration_hours) : null,
          price: form.price ? parseFloat(form.price) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/dashboard/courses/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar curso.');
      setSaving(false);
    }
  };

  const inp = {
    width: '100%', padding: '0.75rem 1rem',
    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none',
    fontSize: '0.9rem', boxSizing: 'border-box' as const,
  };
  const lbl = {
    display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem',
  };

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: 'fit-content' }}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(16,185,129,0.12)', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Novo Curso</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Preencha as informações do curso.</p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={lbl}>Nome do Curso *</label>
            <input id="course-name" style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Técnico em Informática" />
          </div>

          <div>
            <label style={lbl}>Descrição</label>
            <textarea id="course-description" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }} rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descreva o curso brevemente..." />
          </div>

          <div>
            <label style={lbl}>Modalidade</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {MODALITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  id={`modality-${opt.value}`}
                  onClick={() => set('modality', opt.value)}
                  style={{
                    padding: '0.875rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${form.modality === opt.value ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                    background: form.modality === opt.value ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.15)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={lbl}>Carga Horária (horas)</label>
              <input id="course-hours" type="number" min="1" style={inp} value={form.duration_hours} onChange={e => set('duration_hours', e.target.value)} placeholder="Ex: 400" />
            </div>
            <div>
              <label style={lbl}>Valor (R$)</label>
              <input id="course-price" type="number" min="0" step="0.01" style={inp} value={form.price} onChange={e => set('price', e.target.value)} placeholder="0 para gratuito" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Curso Ativo</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cursos inativos não aceitam novas matrículas.</p>
            </div>
            <button
              type="button"
              id="toggle-active"
              onClick={() => set('is_active', !form.is_active)}
              style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', padding: '2px', background: form.is_active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)', flexShrink: 0 }}
            >
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: form.is_active ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '0.75rem 1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" id="btn-save-course" className="custom-button" disabled={saving} style={{ minWidth: '160px' }}>
              {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Criar Curso</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
