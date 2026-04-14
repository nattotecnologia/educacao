'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, Plus, Loader2, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/enrollments?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnrollments(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

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
                {['Aluno', 'Turma / Curso', 'Contato', 'Status', 'Matriculado em'].map(h => (
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(en.classes as any)?.courses?.name || ''}</div>
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
    </div>
  );
}
