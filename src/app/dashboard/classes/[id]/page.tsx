'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, UserPlus, Users, CheckCircle, XCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { maskPhone } from '@/utils/masks';

interface Enrollment {
  id: string;
  student_name: string;
  student_email?: string;
  student_phone?: string;
  student_cpf?: string;
  status: string;
  enrolled_at: string;
  notes?: string;
  leads?: { name: string; phone: string };
}

interface ClassDetail {
  id: string;
  name: string;
  teacher_name?: string;
  schedule?: string;
  start_date?: string;
  end_date?: string;
  total_slots: number;
  filled_slots: number;
  status: string;
  courses?: { name: string };
  enrollments: Enrollment[];
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: '#f59e0b', icon: Clock },
  active: { label: 'Ativa', color: '#10b981', icon: CheckCircle },
  locked: { label: 'Trancada', color: '#94a3b8', icon: AlertCircle },
  finished: { label: 'Concluída', color: '#6366f1', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: '#ef4444', icon: XCircle },
};

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, meta]) => ({ value, ...meta }));

export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchClass = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const [classRes, enrollRes] = await Promise.all([
        fetch(`/api/classes?course_id=all`, { headers: { Authorization: `Bearer ${session?.access_token}` } }),
        fetch(`/api/enrollments?class_id=${id}&pageSize=100`, { headers: { Authorization: `Bearer ${session?.access_token}` } }),
      ]);

      // Busca via supabase direto no client para a turma
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('*, courses(name)')
        .eq('id', id)
        .single();

      const enrollData = await enrollRes.json();

      if (classErr) throw new Error('Turma não encontrada.');
      setCls({
        ...classData,
        enrollments: enrollData.data || [],
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar turma.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClass(); }, [fetchClass]);

  const updateEnrollmentStatus = async (enrollId: string, status: string) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/enrollments/${enrollId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status }),
    });
    fetchClass();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={40} /></div>;
  if (!cls) return <div style={{ color: 'var(--accent-danger)', padding: '2rem' }}>{error || 'Turma não encontrada.'}</div>;

  const vagas = cls.total_slots - cls.filled_slots;
  const pct = Math.round((cls.filled_slots / cls.total_slots) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: 'fit-content' }}>
        <ArrowLeft size={18} /> Voltar
      </button>

      {/* Cabeçalho */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          {cls.courses?.name || 'Curso'} / {cls.name}
        </p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>{cls.name}</h1>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          {cls.teacher_name && <span>👤 {cls.teacher_name}</span>}
          {cls.schedule && <span>🕐 {cls.schedule}</span>}
          {cls.start_date && <span>📅 {new Date(cls.start_date).toLocaleDateString('pt-BR')} – {cls.end_date ? new Date(cls.end_date).toLocaleDateString('pt-BR') : 'Em aberto'}</span>}
        </div>

        {/* Barra de vagas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981', borderRadius: '999px', transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            <strong style={{ color: vagas === 0 ? '#ef4444' : 'var(--text-primary)' }}>{vagas}</strong>
            <span style={{ color: 'var(--text-muted)' }}>/{cls.total_slots} vagas disponíveis</span>
          </span>
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          <Users size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Alunos Matriculados ({cls.enrollments.length})
        </h2>
        <button
          id="btn-new-enrollment"
          onClick={() => router.push(`/dashboard/enrollments/new?class_id=${id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.6rem 1.1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}
        >
          <UserPlus size={16} /> Nova Matrícula
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {cls.enrollments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <Users size={40} style={{ margin: '0 auto 1rem' }} />
          <p>Nenhum aluno matriculado nesta turma ainda.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                {['Aluno', 'Contato', 'CPF', 'Status', 'Matrícula', 'Ação'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cls.enrollments.map((en, i) => {
                const st = STATUS_MAP[en.status] || STATUS_MAP.pending;
                const StIcon = st.icon;
                return (
                  <tr key={en.id} id={`enrollment-row-${en.id}`} style={{ borderBottom: i < cls.enrollments.length - 1 ? '1px solid var(--glass-border)' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{en.student_name}</div>
                      {en.student_email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{en.student_email}</div>}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{en.student_phone ? maskPhone(en.student_phone) : '—'}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{en.student_cpf || '—'}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <select
                        value={en.status}
                        onChange={e => updateEnrollmentStatus(en.id, e.target.value)}
                        style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40`, borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(en.enrolled_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {en.notes && <span title={en.notes} style={{ color: 'var(--text-muted)', cursor: 'help' }}>📝</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
