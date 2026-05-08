'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function FinancialPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalBilled: 0,
    totalPending: 0,
    totalCancelled: 0,
    activeEnrollments: 0
  });
  const [enrollments, setEnrollments] = useState<any[]>([]);

  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id, 
          student_name, 
          status, 
          enrolled_at,
          classes (
            name,
            courses (
              name,
              price
            )
          )
        `)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;

      let billed = 0;
      let pending = 0;
      let cancelled = 0;
      let activeCount = 0;

      const items = data || [];
      
      items.forEach((enrollment: any) => {
        const price = enrollment.classes?.courses?.price || 0;
        
        if (enrollment.status === 'active') {
          billed += price;
          activeCount++;
        } else if (enrollment.status === 'pending') {
          pending += price;
        } else if (enrollment.status === 'cancelled') {
          cancelled += price;
        }
      });

      setMetrics({
        totalBilled: billed,
        totalPending: pending,
        totalCancelled: cancelled,
        activeEnrollments: activeCount
      });
      setEnrollments(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancialData();

    let channel: any;
    const setupRealtime = async () => {
      const supabase = createClient();
      const channelId = `financial_realtime_${Math.random().toString(36).substring(7)}`;
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'enrollments' },
          () => {
            console.log('Dados de faturamento alterados, atualizando tela financeira...');
            fetchFinancialData();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
      }
    };
  }, [fetchFinancialData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Financeiro</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Visão geral do faturamento de matrículas.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={36} /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Card Faturamento Total */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <TrendingUp size={20} color="#10b981" />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Faturado</h3>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                {formatCurrency(metrics.totalBilled)}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Matrículas Ativas</p>
            </div>

            {/* Card Pendentes */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <DollarSign size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Valor Pendente</h3>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
                {formatCurrency(metrics.totalPending)}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pré-matrículas aguardando aprovação</p>
            </div>

            {/* Card Cancelados */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <TrendingDown size={20} color="#ef4444" />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Valor Cancelado</h3>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
                {formatCurrency(metrics.totalCancelled)}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receita perdida</p>
            </div>

            {/* Card Volume */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <Users size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Alunos Ativos</h3>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {metrics.activeEnrollments}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total de matrículas ativas</p>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Últimas Movimentações</h2>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Aluno</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Curso / Turma</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valor</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.slice(0, 10).map((en, i) => {
                    const price = en.classes?.courses?.price || 0;
                    return (
                      <tr key={en.id} style={{ borderBottom: i < 9 ? '1px solid var(--glass-border)' : 'none' }}>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {en.student_name}
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{en.classes?.courses?.name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{en.classes?.name || '—'}</div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {formatCurrency(price)}
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', padding: '0.28rem 0.65rem', borderRadius: '999px', fontWeight: 600,
                            background: en.status === 'active' ? '#10b9811a' : en.status === 'pending' ? '#f59e0b1a' : '#ef44441a',
                            color: en.status === 'active' ? '#10b981' : en.status === 'pending' ? '#f59e0b' : '#ef4444'
                          }}>
                            {en.status === 'active' ? 'Faturado' : en.status === 'pending' ? 'Pendente' : 'Cancelado'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {enrollments.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhuma movimentação encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
