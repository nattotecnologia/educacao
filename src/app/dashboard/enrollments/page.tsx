'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Plus, Loader2, Search, ChevronLeft, ChevronRight, Edit2, XCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { maskPhone } from '@/utils/masks';

interface Enrollment {
  id: string;
  student_name: string;
  student_email?: string;
  student_phone?: string;
  status: string;
  enrolled_at: string;
  classes?: { name: string; courses?: { name: string } };
  leads?: { name: string };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: '#f59e0b' },
  active: { label: 'Ativa', color: '#10b981' },
  locked: { label: 'Trancada', color: '#94a3b8' },
  finished: { label: 'Concluída', color: '#6366f1' },
  cancelled: { label: 'Cancelada', color: '#ef4444' },
};

export default function EnrollmentsPage() {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; course_id: string }[]>([]);
  const [page, setPage] = useState(1);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [enrollmentToCancel, setEnrollmentToCancel] = useState<Enrollment | null>(null);
  const pageSize = 20;

  const s = {
    modalOverlay: {
      position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out'
    },
    modalContent: {
      background: 'var(--bg-primary)', padding: '2.5rem 2rem 2rem 2rem', borderRadius: '16px',
      width: '100%', maxWidth: '420px', border: '1px solid var(--glass-border)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative' as const,
      display: 'flex', flexDirection: 'column' as const, gap: '1.25rem'
    }
  };

  const fetchFiltersData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const coursesRes = await fetch('/api/courses', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCourses(coursesData || []);
      }

      const classesRes = await fetch('/api/classes?course_id=all', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados dos filtros:', err);
    }
  }, []);

  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set('status', statusFilter);
      if (courseFilter) params.set('course_id', courseFilter);
      if (classFilter) params.set('class_id', classFilter);

      const res = await fetch(`/api/enrollments?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnrollments(data.data || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, courseFilter, classFilter]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const handleCancel = async () => {
    if (!enrollmentToCancel) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/enrollments/${enrollmentToCancel.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
      setIsCancelModalOpen(false);
      setEnrollmentToCancel(null);
      fetchEnrollments();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = search
    ? enrollments.filter(e =>
        e.student_name.toLowerCase().includes(search.toLowerCase()) ||
        e.student_phone?.includes(search) ||
        e.student_email?.toLowerCase().includes(search.toLowerCase())
      )
    : enrollments;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Matrículas</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {total} matrícula(s) registrada(s).
          </p>
        </div>
        <button
          id="btn-new-enrollment"
          onClick={() => router.push('/dashboard/enrollments/new')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <Plus size={18} /> Nova Matrícula
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="search-enrollments"
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 0.875rem 0.65rem 2.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <select
          id="filter-course"
          value={courseFilter}
          onChange={e => { setCourseFilter(e.target.value); setClassFilter(''); setPage(1); }}
          style={{ padding: '0.65rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', minWidth: '150px' }}
        >
          <option value="">Todos os cursos</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          id="filter-class"
          value={classFilter}
          onChange={e => { setClassFilter(e.target.value); setPage(1); }}
          style={{ padding: '0.65rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', minWidth: '150px' }}
        >
          <option value="">Todas as turmas</option>
          {(courseFilter ? classes.filter(c => c.course_id === courseFilter) : classes).map(cl => (
            <option key={cl.id} value={cl.id}>{cl.name}</option>
          ))}
        </select>

        <select
          id="filter-status"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '0.65rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_MAP).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 className="animate-spin" size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <GraduationCap size={48} style={{ margin: '0 auto 1rem' }} />
          <p>Nenhuma matrícula encontrada.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                {['Aluno', 'Turma / Curso', 'Contato', 'Status', 'Matriculado em', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((en, i) => {
                const st = STATUS_MAP[en.status] || STATUS_MAP.pending;
                return (
                  <tr key={en.id} id={`enrollment-${en.id}`} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--glass-border)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{en.student_name}</div>
                      {en.student_email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{en.student_email}</div>}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{en.classes?.name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{en.classes?.courses?.name || ''}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{en.student_phone ? maskPhone(en.student_phone) : '—'}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', padding: '0.28rem 0.65rem', borderRadius: '999px', background: `${st.color}1a`, color: st.color, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(en.enrolled_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => router.push(`/dashboard/enrollments/${en.id}`)}
                          title="Editar"
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        {en.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setEnrollmentToCancel(en);
                              setIsCancelModalOpen(true);
                            }}
                            title="Cancelar Matrícula"
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--glass-border)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.75rem', color: 'var(--text-primary)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.75rem', color: 'var(--text-primary)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {isCancelModalOpen && enrollmentToCancel && (
        <div 
          style={s.modalOverlay}
          onClick={() => {
            setIsCancelModalOpen(false);
            setEnrollmentToCancel(null);
          }}
        >
          <div 
            style={s.modalContent} 
            className="animate-in"
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem', padding: '0.5rem 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <XCircle size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Cancelar Matrícula</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.4' }}>
                  Você tem certeza que deseja cancelar a matrícula de <strong style={{ color: 'var(--text-primary)' }}>{enrollmentToCancel.student_name}</strong>?<br />O status passará para <strong style={{ color: '#ef4444' }}>Cancelada</strong>.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setEnrollmentToCancel(null);
                }} 
                style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                Manter Matrícula
              </button>
              <button 
                type="button" 
                onClick={handleCancel} 
                style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
