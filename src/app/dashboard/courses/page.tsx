'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Loader2, ChevronRight, GraduationCap, Monitor, MapPin, DollarSign, Clock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Course {
  id: string;
  name: string;
  description: string;
  modality: 'presential' | 'online' | 'hybrid';
  duration_hours: number;
  price: number;
  is_active: boolean;
  classes?: { count: number }[];
}

const MODALITY_LABEL: Record<string, { label: string; icon: any; color: string }> = {
  presential: { label: 'Presencial', icon: MapPin, color: '#10b981' },
  online: { label: 'Online / EAD', icon: Monitor, color: '#06b6d4' },
  hybrid: { label: 'Híbrido', icon: GraduationCap, color: '#f59e0b' },
};

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/courses?active=false', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCourses(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar cursos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const s = {
    page: { display: 'flex', flexDirection: 'column' as const, gap: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' },
    card: {
      background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
      borderRadius: '12px', padding: '1.5rem', cursor: 'pointer',
      transition: 'all 0.15s ease', display: 'flex', flexDirection: 'column' as const, gap: '1rem',
    },
    badge: (color: string) => ({
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem',
      fontWeight: 600, padding: '0.3rem 0.65rem', borderRadius: '999px',
      background: `${color}20`, color,
    }),
    meta: { display: 'flex', gap: '1rem', flexWrap: 'wrap' as const },
    metaItem: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' },
    btn: {
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      background: 'var(--accent-primary)', color: '#fff',
      padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
    },
    empty: {
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
      justifyContent: 'center', gap: '1rem', padding: '4rem', textAlign: 'center' as const,
      color: 'var(--text-muted)',
    },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Cursos</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Gerencie o catálogo de cursos da sua instituição.
          </p>
        </div>
        <button id="btn-new-course" style={s.btn} onClick={() => router.push('/dashboard/courses/new')}>
          <Plus size={18} /> Novo Curso
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 className="animate-spin" size={40} />
        </div>
      ) : courses.length === 0 ? (
        <div style={s.empty}>
          <BookOpen size={52} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Nenhum curso cadastrado
          </h3>
          <p style={{ maxWidth: '360px' }}>
            Crie seu primeiro curso para começar a gerenciar turmas e matrículas.
          </p>
          <button style={s.btn} onClick={() => router.push('/dashboard/courses/new')}>
            <Plus size={16} /> Criar Primeiro Curso
          </button>
        </div>
      ) : (
        <div style={s.grid}>
          {courses.map((course) => {
            const mod = MODALITY_LABEL[course.modality] || MODALITY_LABEL.presential;
            const ModIcon = mod.icon;
            const classCount = course.classes?.[0]?.count ?? 0;

            return (
              <div
                key={course.id}
                id={`course-card-${course.id}`}
                style={{
                  ...s.card,
                  opacity: course.is_active ? 1 : 0.55,
                  borderColor: course.is_active ? 'var(--glass-border)' : 'rgba(255,255,255,0.04)',
                }}
                onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={s.badge(mod.color)}>
                        <ModIcon size={11} /> {mod.label}
                      </span>
                      {!course.is_active && (
                        <span style={s.badge('#94a3b8')}>Inativo</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {course.name}
                    </h3>
                    {course.description && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {course.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' }} />
                </div>

                <div style={s.meta}>
                  {course.duration_hours && (
                    <span style={s.metaItem}>
                      <Clock size={13} /> {course.duration_hours}h
                    </span>
                  )}
                  {course.price != null && (
                    <span style={s.metaItem}>
                      <DollarSign size={13} />
                      {course.price === 0 ? 'Gratuito' : `R$ ${course.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </span>
                  )}
                  <span style={{ ...s.metaItem, marginLeft: 'auto', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    <BookOpen size={13} />
                    {classCount} turma{classCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
