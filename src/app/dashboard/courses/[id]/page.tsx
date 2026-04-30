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

const MODALITY_LABEL: Record<string, { label: string; color: string }> = {
  presential: { label: 'Presencial', color: '#10b981' },
  online: { label: 'Online / EAD', color: '#06b6d4' },
  hybrid: { label: 'Híbrido', color: '#f59e0b' },
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

  // Estados para edição do curso
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({
    name: '',
    description: '',
    modality: '',
    duration_hours: '',
    price: '',
    is_active: true
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
      // Inicializa o formulário de edição com os dados do curso
      setCourseForm({
        name: data.name,
        description: data.description || '',
        modality: data.modality,
        duration_hours: data.duration_hours?.toString() || '',
        price: data.price?.toString() || '',
        is_active: data.is_active
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar curso.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);



  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.name) { setError('Nome do curso é obrigatório.'); return; }
    setSavingCourse(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/courses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          ...courseForm,
          duration_hours: courseForm.duration_hours ? parseInt(courseForm.duration_hours) : null,
          price: courseForm.price ? parseFloat(courseForm.price) : null
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsEditingCourse(false);
      fetchCourse();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar curso.');
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!confirm('Deseja excluir este curso? Esta ação não pode ser desfeita e removerá todas as turmas associadas.')) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      router.push('/dashboard/courses');
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir curso.');
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
    width: '100%',
    padding: '0.8rem 1rem',
    background: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '0.9rem',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s ease',
  };

  const lbl = {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '0.5rem',
    display: 'block'
  };

  if (loading) return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Loader2 className="animate-spin" size={48} style={{ color: 'var(--accent-primary)' }} />
    </div>
  );
  if (!course) return <div style={{ color: 'var(--accent-danger)', padding: '2rem', textAlign: 'center' }}><BookOpen size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} /><br />Curso não encontrado.</div>;

  const ModIcon = MODALITY_ICON[course.modality] || BookOpen;

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <button 
        onClick={() => router.back()} 
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, transition: 'color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={16} /> Voltar para Cursos
      </button>

      {/* Cabeçalho do Curso / Painel de Edição */}
      <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
        {/* Efeito de luz sutil no fundo */}
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'var(--accent-primary)', filter: 'blur(100px)', opacity: 0.05, pointerEvents: 'none' }} />

        {!isEditingCourse ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                  <ModIcon size={32} />
                </div>
                <div>
                  <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {course.name}
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.4rem', lineHeight: 1.5, maxWidth: '600px' }}>
                    {course.description || 'Sem descrição cadastrada para este curso.'}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsEditingCourse(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <Edit2 size={15} /> Editar Curso
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: '999px', background: course.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', border: `1px solid ${course.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.2)'}`, color: course.is_active ? 'var(--accent-success)' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: course.is_active ? 'var(--accent-success)' : 'var(--text-muted)', boxShadow: course.is_active ? '0 0 10px var(--accent-success)' : 'none' }} />
                  {course.is_active ? 'ATIVO' : 'INATIVO'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={lbl}>Modalidade</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: MODALITY_LABEL[course.modality]?.color }}>
                  <ModIcon size={16} /> {MODALITY_LABEL[course.modality]?.label || course.modality}
                </div>
              </div>

              {course.duration_hours && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={lbl}>Carga Horária</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>⏱️ {course.duration_hours} horas</div>
                </div>
              )}

              {course.price != null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={lbl}>Investimento</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-success)' }}>
                    💰 {course.price === 0 ? 'Gratuito' : `R$ ${course.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginLeft: 'auto' }}>
                <span style={lbl}>Turmas Ativas</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, textAlign: 'right' }}>{course.classes?.length || 0}</div>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveCourse} className="animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Editar Curso</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>Atualize as informações principais do catálogo.</p>
              </div>
              <button type="button" onClick={() => setIsEditingCourse(false)} style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <X size={22} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Nome do Curso *</label>
                <input 
                  style={inp} 
                  value={courseForm.name} 
                  onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))} 
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                />
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Descrição Detalhada</label>
                <textarea 
                  style={{ ...inp, minHeight: '100px', resize: 'vertical', lineHeight: '1.5' }} 
                  value={courseForm.description} 
                  onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                />
              </div>

              <div>
                <label style={lbl}>Modalidade</label>
                <select 
                  style={inp} 
                  value={courseForm.modality} 
                  onChange={e => setCourseForm(p => ({ ...p, modality: e.target.value }))}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <option value="presential">📍 Presencial</option>
                  <option value="online">💻 Online / EAD</option>
                  <option value="hybrid">🎓 Híbrido</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={lbl}>Preço (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    style={inp} 
                    value={courseForm.price} 
                    onChange={e => setCourseForm(p => ({ ...p, price: e.target.value }))} 
                  />
                </div>
                <div>
                  <label style={lbl}>Horas</label>
                  <input 
                    type="number" 
                    style={inp} 
                    value={courseForm.duration_hours} 
                    onChange={e => setCourseForm(p => ({ ...p, duration_hours: e.target.value }))} 
                  />
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Disponibilidade do Curso</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div 
                    onClick={() => setCourseForm(p => ({ ...p, is_active: true }))}
                    style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: courseForm.is_active ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${courseForm.is_active ? 'rgba(16,185,129,0.3)' : 'var(--glass-border)'}`, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid', borderColor: courseForm.is_active ? 'var(--accent-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {courseForm.is_active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-success)' }} />}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: courseForm.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>Ativo</span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Visível no catálogo e disponível para novas turmas.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => setCourseForm(p => ({ ...p, is_active: false }))}
                    style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: !courseForm.is_active ? 'rgba(148,163,184,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${!courseForm.is_active ? 'rgba(148,163,184,0.3)' : 'var(--glass-border)'}`, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid', borderColor: !courseForm.is_active ? 'var(--text-secondary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!courseForm.is_active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-secondary)' }} />}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: !courseForm.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>Inativo</span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Oculto e pausado para novos agendamentos.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
              <button 
                type="button" 
                onClick={handleDeleteCourse} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-danger)', padding: '0.7rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid transparent', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <Trash2 size={16} /> Excluir Curso
              </button>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditingCourse(false)} 
                  style={{ padding: '0.75rem 1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingCourse} 
                  className="custom-button"
                  style={{ 
                    padding: '0.75rem 2rem', 
                    borderRadius: '10px', 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.25)',
                    background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                  }}
                >
                  {savingCourse ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Salvar Alterações</>}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Turmas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Turmas</h2>
        <button
          id="btn-new-class"
          onClick={() => router.push(`/dashboard/classes/new?course_id=${id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.6rem 1.1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}
        >
          <Plus size={16} /> Nova Turma
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}



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
