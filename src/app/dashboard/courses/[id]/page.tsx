'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Users, Calendar, BookOpen, Edit2, X, Save, MapPin, Monitor, GraduationCap, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface ClassItem {
  id: string;
  name: string;
  teacher_name?: string;
  schedule?: string;
  start_date?: string;
  end_date?: string;
  total_slots: number;
  filled_slots: number;
  status: string;
  meeting_url?: string;
}

interface Course {
  id: string;
  name: string;
  description?: string;
  modality: string;
  duration_hours?: number;
  price?: number;
  is_active: boolean;
  classes: ClassItem[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'Aberta', color: '#10b981' },
  closed: { label: 'Encerrada', color: '#94a3b8' },
  cancelled: { label: 'Cancelada', color: '#ef4444' },
  finished: { label: 'Concluída', color: '#6366f1' },
};

const MODALITY_ICON: Record<string, any> = {
  presential: MapPin, online: Monitor, hybrid: GraduationCap,
};

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewClass, setShowNewClass] = useState(false);
  const [savingClass, setSavingClass] = useState(false);
  const [error, setError] = useState('');
  const [classForm, setClassForm] = useState({
    name: '', teacher_name: '', schedule: '',
    start_date: '', end_date: '', total_slots: '30', meeting_url: '',
  });

  const fetchCourse = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/courses/${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCourse(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar curso.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name) { setError('Nome da turma é obrigatório.'); return; }
    setSavingClass(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ course_id: id, ...classForm, total_slots: parseInt(classForm.total_slots) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNewClass(false);
      setClassForm({ name: '', teacher_name: '', schedule: '', start_date: '', end_date: '', total_slots: '30', meeting_url: '' });
      fetchCourse();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar turma.');
    } finally {
      setSavingClass(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Excluir esta turma? Alunos matriculados não serão afetados.')) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/classes/${classId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } });
    fetchCourse();
  };

  const inp = {
    width: '100%', padding: '0.65rem 0.875rem',
    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' as const,
  };
  const lbl = { fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'block' };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={40} /></div>;
  if (!course) return <div style={{ color: 'var(--accent-danger)', padding: '2rem' }}>Curso não encontrado.</div>;

  const ModIcon = MODALITY_ICON[course.modality] || BookOpen;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: 'fit-content' }}>
        <ArrowLeft size={18} /> Voltar para Cursos
      </button>

      {/* Cabeçalho do Curso */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ModIcon size={28} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{course.name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {course.description || 'Sem descrição.'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', borderRadius: '999px', background: course.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', color: course.is_active ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
              {course.is_active ? '✅ Ativo' : '⏸️ Inativo'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          {course.duration_hours && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⏱️ {course.duration_hours}h</span>}
          {course.price != null && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>💰 {course.price === 0 ? 'Gratuito' : `R$ ${course.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🏫 {course.classes?.length || 0} turma(s)</span>
        </div>
      </div>

      {/* Turmas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Turmas</h2>
        <button
          id="btn-new-class"
          onClick={() => setShowNewClass(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.6rem 1.1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}
        >
          <Plus size={16} /> Nova Turma
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {/* Formulário inline de nova turma */}
      {showNewClass && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Nova Turma</h3>
            <button onClick={() => setShowNewClass(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleCreateClass} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Nome da Turma *</label>
              <input id="class-name" style={inp} value={classForm.name} onChange={e => setClassForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Turma A — 2024/1" />
            </div>
            <div>
              <label style={lbl}>Professor</label>
              <input id="class-teacher" style={inp} value={classForm.teacher_name} onChange={e => setClassForm(p => ({ ...p, teacher_name: e.target.value }))} placeholder="Nome do professor" />
            </div>
            <div>
              <label style={lbl}>Horário</label>
              <input id="class-schedule" style={inp} value={classForm.schedule} onChange={e => setClassForm(p => ({ ...p, schedule: e.target.value }))} placeholder="Ex: Seg/Qua/Sex 19h–21h" />
            </div>
            <div>
              <label style={lbl}>Data Início</label>
              <input id="class-start" type="date" style={inp} value={classForm.start_date} onChange={e => setClassForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Data Fim</label>
              <input id="class-end" type="date" style={inp} value={classForm.end_date} onChange={e => setClassForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Total de Vagas</label>
              <input id="class-slots" type="number" min="1" style={inp} value={classForm.total_slots} onChange={e => setClassForm(p => ({ ...p, total_slots: e.target.value }))} />
            </div>
            {(course.modality === 'online' || course.modality === 'hybrid') && (
              <div>
                <label style={lbl}>Link da Aula</label>
                <input id="class-meeting-url" type="url" style={inp} value={classForm.meeting_url} onChange={e => setClassForm(p => ({ ...p, meeting_url: e.target.value }))} placeholder="https://meet.google.com/..." />
              </div>
            )}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
              <button type="button" onClick={() => setShowNewClass(false)} style={{ padding: '0.65rem 1.25rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                Cancelar
              </button>
              <button type="submit" id="btn-save-class" disabled={savingClass} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                {savingClass ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Criar Turma</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de turmas */}
      {course.classes?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <Calendar size={40} style={{ margin: '0 auto 1rem' }} />
          <p>Nenhuma turma cadastrada. Crie a primeira turma para este curso.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {course.classes?.map(cls => {
            const st = STATUS_MAP[cls.status] || STATUS_MAP.open;
            const vagas = cls.total_slots - cls.filled_slots;
            const pct = Math.round((cls.filled_slots / cls.total_slots) * 100);
            return (
              <div key={cls.id} id={`class-row-${cls.id}`} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{cls.name}</span>
                    <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '999px', background: `${st.color}1a`, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {cls.teacher_name && <span>👤 {cls.teacher_name}</span>}
                    {cls.schedule && <span>🕐 {cls.schedule}</span>}
                    {cls.start_date && <span>📅 {new Date(cls.start_date).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flex: 1, height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981', borderRadius: '999px', transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: vagas === 0 ? '#ef4444' : 'var(--text-primary)' }}>{vagas}</strong>/{cls.total_slots} vagas
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button id={`btn-view-class-${cls.id}`} onClick={() => router.push(`/dashboard/classes/${cls.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(99,102,241,0.2)', padding: '0.5rem 0.875rem', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Users size={14} /> Alunos
                  </button>
                  <button id={`btn-delete-class-${cls.id}`} onClick={() => handleDeleteClass(cls.id)} style={{ background: 'rgba(239,68,68,0.05)', color: 'var(--accent-danger)', border: '1px solid rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '7px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
