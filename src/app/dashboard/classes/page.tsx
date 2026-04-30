'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Plus, 
  Loader2, 
  ChevronRight, 
  Search, 
  GraduationCap, 
  Monitor, 
  MapPin, 
  Calendar, 
  BookOpen,
  Filter,
  Users2
} from 'lucide-react';
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
  courses: {
    name: string;
    modality: string;
  };
  enrollments: { count: number }[];
}

const MODALITY_ICON: Record<string, any> = {
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
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar turmas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const filteredClasses = classes.filter(cls => 
    cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cls.courses?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cls.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const s = {
    page: { display: 'flex', flexDirection: 'column' as const, gap: '2rem', maxWidth: '1200px', margin: '0 auto' },
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
      boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s'
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
            const vagas = cls.total_slots - cls.filled_slots;
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
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <ModIcon size={20} />
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
    </div>
  );
}
