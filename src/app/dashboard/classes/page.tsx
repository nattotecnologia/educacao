'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Loader2, 
  Search, 
  GraduationCap, 
  Monitor, 
  MapPin, 
  BookOpen,
  Filter,
  Users2,
  Edit2,
  Trash2
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface ClassItem {
  id: string;
  name: string;
  course_id?: string;
  teacher_name?: string;
  schedule?: string;
  start_date?: string;
  end_date?: string;
  total_slots: number;
  filled_slots: number;
  status: string;
  meeting_url?: string;
  courses: {
    name: string;
    modality: string;
  };
  enrollments: { count: number }[];
}

const MODALITY_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  presential: MapPin,
  online: Monitor,
  hybrid: GraduationCap,
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'Aberta', color: '#10b981' },
  active: { label: 'Em Andamento', color: '#3b82f6' },
  closed: { label: 'Encerrada', color: '#94a3b8' },
  cancelled: { label: 'Cancelada', color: '#ef4444' },
  finished: { label: 'Concluída', color: '#6366f1' },
};

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [courses, setCourses] = useState<{ id: string; name: string; modality: string }[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [classToEdit, setClassToEdit] = useState<ClassItem | null>(null);
  const [editForm, setEditForm] = useState({
    course_id: '',
    name: '',
    teacher_name: '',
    schedule: '',
    start_date: '',
    end_date: '',
    total_slots: '30',
    meeting_url: '',
    status: 'open'
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/classes', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClasses(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar turmas.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/courses', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar cursos:', err);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    fetchCourses();
  }, [fetchClasses, fetchCourses]);

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/classes/${classToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsDeleteModalOpen(false);
      setClassToDelete(null);
      fetchClasses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir turma.';
      alert(msg);
    }
  };

  const handleEditClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classToEdit) return;
    if (!editForm.course_id || !editForm.name) {
      setEditError('Curso e Nome da Turma são obrigatórios.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/classes/${classToEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          course_id: editForm.course_id,
          name: editForm.name,
          teacher_name: editForm.teacher_name,
          schedule: editForm.schedule,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null,
          total_slots: parseInt(editForm.total_slots),
          meeting_url: editForm.meeting_url,
          status: editForm.status
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsEditModalOpen(false);
      setClassToEdit(null);
      fetchClasses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar alterações da turma.';
      setEditError(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditClass = (cls: ClassItem) => {
    setClassToEdit(cls);
    setEditForm({
      course_id: cls.course_id || '',
      name: cls.name,
      teacher_name: cls.teacher_name || '',
      schedule: cls.schedule || '',
      start_date: cls.start_date ? cls.start_date.split('T')[0] : '',
      end_date: cls.end_date ? cls.end_date.split('T')[0] : '',
      total_slots: cls.total_slots.toString(),
      meeting_url: cls.meeting_url || '',
      status: cls.status
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  const filteredClasses = classes.filter(cls => 
    cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cls.courses?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cls.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const s = {
    page: { display: 'flex', flexDirection: 'column' as const, gap: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '1rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' },
    card: {
      background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
      borderRadius: '16px', padding: '1.5rem', cursor: 'pointer',
      transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column' as const, gap: '1.25rem',
      position: 'relative' as const, overflow: 'hidden'
    },
    badge: (color: string) => ({
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem',
      fontWeight: 700, padding: '0.3rem 0.7rem', borderRadius: '999px',
      background: `${color}1a`, color, border: `1px solid ${color}33`
    }),
    searchContainer: {
      display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.6rem 1rem',
      width: '100%', maxWidth: '400px', transition: 'all 0.2s'
    },
    searchInput: {
      background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none',
      width: '100%', fontSize: '0.9rem'
    },
    btn: {
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)', color: '#fff',
      padding: '0.75rem 1.5rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 700,
      boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s', border: 'none', cursor: 'pointer'
    },
    modalOverlay: {
      position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out'
    },
    modalContent: {
      background: 'var(--bg-primary)', padding: '2rem', borderRadius: '16px',
      width: '100%', maxWidth: '550px', border: '1px solid var(--glass-border)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative' as const,
      display: 'flex', flexDirection: 'column' as const, gap: '1.5rem'
    },
    label: { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' },
    input: {
      width: '100%', 
      paddingTop: '0.75rem', paddingBottom: '0.75rem', paddingLeft: '1rem', paddingRight: '1rem',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)',
      fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' as const
    }
  };

  return (
    <div style={s.page} className="animate-in">
      <div style={s.header}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Turmas</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Acompanhe e gerencie todas as turmas ativas da instituição.
          </p>
        </div>
        <button 
          style={s.btn} 
          onClick={() => router.push('/dashboard/classes/new')}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.2)'; }}
        >
          <Plus size={18} /> Nova Turma
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={s.searchContainer}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input 
            style={s.searchInput} 
            placeholder="Buscar por turma, curso ou professor..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={{ ...s.searchContainer, width: 'auto', cursor: 'pointer' }}>
            <Filter size={16} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filtros</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 className="animate-spin" size={48} style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
          <Users2 size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nenhuma turma encontrada</h3>
          <p style={{ marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>Não encontramos turmas com os critérios de busca informados ou ainda não há turmas cadastradas.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filteredClasses.map((cls) => {
            const st = STATUS_MAP[cls.status] || STATUS_MAP.open;
            const ModIcon = MODALITY_ICON[cls.courses?.modality] || BookOpen;
            const pct = Math.round((cls.filled_slots / cls.total_slots) * 100);

            return (
              <div
                key={cls.id}
                style={s.card}
                onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={s.badge(st.color)}>{st.label}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        #{cls.id.substring(0, 6)}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {cls.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <BookOpen size={14} /> {cls.courses?.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ModIcon size={20} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditClass(cls);
                        }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.45rem', borderRadius: '6px', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        title="Editar Turma"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClassToDelete(cls);
                          setIsDeleteModalOpen(true);
                        }}
                        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', padding: '0.45rem', borderRadius: '6px', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; }}
                        title="Excluir Turma"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Professor</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cls.teacher_name || 'Não definido'}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Início</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cls.start_date ? new Date(cls.start_date).toLocaleDateString('pt-BR') : 'A definir'}</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Ocupação</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{cls.filled_slots} / {cls.total_slots} <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vagas</small></span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--accent-danger)' : pct >= 70 ? 'var(--accent-warning)' : 'var(--accent-success)', borderRadius: '999px', transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteModalOpen && classToDelete && (
        <div 
          style={s.modalOverlay}
          onClick={() => {
            setIsDeleteModalOpen(false);
            setClassToDelete(null);
          }}
        >
          <div 
            style={{ ...s.modalContent, maxWidth: '420px', gap: '1.25rem' }} 
            className="animate-in"
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem', padding: '0.5rem 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Trash2 size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Excluir Turma</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.4' }}>
                  Você tem certeza que deseja excluir a turma <strong style={{ color: 'var(--text-primary)' }}>{classToDelete.name}</strong>?<br />Todos os dados vinculados a ela serão permanentemente apagados. Esta ação não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setClassToDelete(null);
                }} 
                style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleDeleteClass} 
                style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Turma */}
      {isEditModalOpen && classToEdit && (
        <div 
          style={s.modalOverlay}
          onClick={() => {
            setIsEditModalOpen(false);
            setClassToEdit(null);
          }}
        >
          <div 
            style={{ ...s.modalContent, maxWidth: '650px', gap: '1.5rem' }} 
            className="animate-in"
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>✏️ Editar Turma</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>#{classToEdit.id.substring(0, 8)}</span>
            </div>

            {editError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.85rem' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditClassSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Curso Vinculado *</label>
                  <select 
                    style={s.input} 
                    value={editForm.course_id} 
                    onChange={e => setEditForm(p => ({ ...p, course_id: e.target.value }))}
                  >
                    <option value="">Selecione um curso...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.modality === 'presential' ? 'Presencial' : c.modality === 'online' ? 'Online' : 'Híbrido'})</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Nome da Turma *</label>
                  <input 
                    style={s.input} 
                    placeholder="Ex: Turma A - Manhã 2024"
                    value={editForm.name} 
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label style={s.label}>Professor Responsável</label>
                  <input 
                    style={s.input} 
                    placeholder="Nome do professor"
                    value={editForm.teacher_name} 
                    onChange={e => setEditForm(p => ({ ...p, teacher_name: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={s.label}>Horário / Frequência</label>
                  <input 
                    style={s.input} 
                    placeholder="Ex: Ter/Qui - 19h às 21h"
                    value={editForm.schedule} 
                    onChange={e => setEditForm(p => ({ ...p, schedule: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={s.label}>Data de Início</label>
                  <input 
                    type="date"
                    style={s.input} 
                    value={editForm.start_date} 
                    onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={s.label}>Previsão de Término</label>
                  <input 
                    type="date"
                    style={s.input} 
                    value={editForm.end_date} 
                    onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={s.label}>Total de Vagas</label>
                  <input 
                    type="number"
                    min="1"
                    style={s.input} 
                    value={editForm.total_slots} 
                    onChange={e => setEditForm(p => ({ ...p, total_slots: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={s.label}>Status da Turma</label>
                  <select 
                    style={s.input} 
                    value={editForm.status} 
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                  >
                    {Object.entries(STATUS_MAP).map(([val, meta]) => (
                      <option key={val} value={val}>{meta.label}</option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selCourse = courses.find(c => c.id === editForm.course_id);
                  if (selCourse && (selCourse.modality === 'online' || selCourse.modality === 'hybrid')) {
                    return (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={s.label}>Link da Aula / Meeting</label>
                        <input 
                          type="url"
                          style={s.input} 
                          placeholder="https://meet.google.com/..."
                          value={editForm.meeting_url} 
                          onChange={e => setEditForm(p => ({ ...p, meeting_url: e.target.value }))}
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setClassToEdit(null);
                  }} 
                  style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingEdit}
                  style={{ ...s.btn, padding: '0.75rem 1.5rem' }}
                >
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
