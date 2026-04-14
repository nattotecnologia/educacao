'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, GraduationCap, Save, Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { maskPhone } from '@/utils/masks';

interface ClassOption {
  id: string;
  name: string;
  total_slots: number;
  filled_slots: number;
  courses?: { name: string };
}

interface Lead {
  id: string;
  name: string;
  phone: string;
}

export default function NewEnrollmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetClassId = searchParams.get('class_id') || '';

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [form, setForm] = useState({
    class_id: presetClassId,
    lead_id: '',
    student_name: '',
    student_email: '',
    student_phone: '',
    student_cpf: '',
    notes: '',
  });

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const [classRes] = await Promise.all([
      fetch('/api/classes', { headers: { Authorization: `Bearer ${session?.access_token}` } }),
    ]);
    const classData = await classRes.json();
    setClasses(classData.filter((c: any) => c.status === 'open'));

    // Busca leads via supabase client
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('institution_id').eq('id', user!.id).single();
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, name, phone')
      .eq('institution_id', profile!.institution_id)
      .order('name');
    setLeads(leadsData || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLeadSelect = (lead: Lead) => {
    set('lead_id', lead.id);
    set('student_name', lead.name || '');
    set('student_phone', maskPhone(lead.phone || ''));
    setLeadSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_id || !form.student_name) { setError('Selecione uma turma e informe o nome do aluno.'); return; }
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...form, lead_id: form.lead_id || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(form.class_id ? `/dashboard/classes/${form.class_id}` : '/dashboard/enrollments');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar matrícula.');
      setSaving(false);
    }
  };

  const filteredLeads = leadSearch
    ? leads.filter(l => l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.phone?.includes(leadSearch))
    : [];

  const inp = {
    width: '100%', padding: '0.75rem 1rem',
    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' as const,
  };
  const lbl = { display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' };

  const selectedClass = classes.find(c => c.id === form.class_id);
  const vagas = selectedClass ? selectedClass.total_slots - selectedClass.filled_slots : null;

  return (
    <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: 'fit-content' }}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Nova Matrícula</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Matricule um aluno em uma turma.</p>
          </div>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Seleção de turma */}
          <div>
            <label style={lbl}>Turma *</label>
            <select
              id="select-class"
              value={form.class_id}
              onChange={e => set('class_id', e.target.value)}
              style={{ ...inp }}
            >
              <option value="">Selecione uma turma...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {(c as any).courses?.name ? `${(c as any).courses.name} — ` : ''}{c.name} ({c.total_slots - c.filled_slots} vagas)
                </option>
              ))}
            </select>
            {vagas !== null && (
              <p style={{ fontSize: '0.75rem', color: vagas === 0 ? '#ef4444' : '#10b981', marginTop: '0.35rem' }}>
                {vagas === 0 ? '⚠️ Turma sem vagas disponíveis!' : `✅ ${vagas} vaga(s) disponível(is)`}
              </p>
            )}
          </div>

          {/* Vincular Lead existente */}
          <div>
            <label style={lbl}>Vincular Lead Existente (opcional)</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="lead-search"
                value={form.lead_id ? (leads.find(l => l.id === form.lead_id)?.name || '') : leadSearch}
                onChange={e => { setLeadSearch(e.target.value); set('lead_id', ''); }}
                placeholder="Buscar lead pelo nome ou telefone..."
                style={{ ...inp, paddingLeft: '2.4rem' }}
              />
            </div>
            {filteredLeads.length > 0 && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', marginTop: '0.5rem', overflow: 'hidden', maxHeight: '160px', overflowY: 'auto' }}>
                {filteredLeads.slice(0, 8).map(lead => (
                  <button key={lead.id} type="button" onClick={() => handleLeadSelect(lead)}
                    style={{ width: '100%', padding: '0.65rem 1rem', textAlign: 'left', display: 'flex', gap: '0.75rem', background: 'none', border: 'none', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <span style={{ fontWeight: 600 }}>{lead.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{lead.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {form.lead_id && (
              <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.35rem' }}>✅ Lead vinculado. O lead será marcado como "convertido" após a matrícula.</p>
            )}
          </div>

          {/* Dados do Aluno */}
          <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Dados do Aluno
            </div>
            <div>
              <label style={lbl}>Nome Completo *</label>
              <input id="student-name" style={inp} value={form.student_name} onChange={e => set('student_name', e.target.value)} placeholder="Nome completo do aluno" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={lbl}>E-mail</label>
                <input id="student-email" type="email" style={inp} value={form.student_email} onChange={e => set('student_email', e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div>
                <label style={lbl}>Telefone</label>
                <input id="student-phone" style={inp} value={form.student_phone} onChange={e => set('student_phone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div>
              <label style={lbl}>CPF</label>
              <input id="student-cpf" style={inp} value={form.student_cpf} onChange={e => set('student_cpf', e.target.value)} placeholder="000.000.000-00" />
            </div>
          </div>

          <div>
            <label style={lbl}>Observações</label>
            <textarea id="enrollment-notes" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Informações adicionais sobre a matrícula..." />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '0.75rem 1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" id="btn-save-enrollment" className="custom-button" disabled={saving} style={{ minWidth: '160px' }}>
              {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Confirmar Matrícula</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
