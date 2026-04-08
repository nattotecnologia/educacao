'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const WeeklyChart = dynamic(() => import('./components/WeeklyChart'), { 
  ssr: false, 
  loading: () => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}><Loader2 className="animate-spin" /></div>
});
import { Users, Bot, CheckCircle, TrendingUp, TrendingDown, Activity, Clock, Phone, Loader2 } from 'lucide-react';
import { authService } from '@/services';
import styles from './Dashboard.module.css';

const statusMap: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'var(--accent-primary)' },
  ai_handling: { label: 'IA Atendendo', color: 'var(--accent-secondary)' },
  human_handling: { label: 'Humano', color: 'var(--accent-warning)' },
  converted: { label: 'Convertido', color: 'var(--accent-success)' },
  lost: { label: 'Perdido', color: 'var(--accent-danger)' },
};

interface Stats {
  total: number;
  converted: number;
  conversionRate: number;
  aiHandling: number;
  newLeads: number;
  activeAgents: number;
  weeklyChart: { name: string; ai: number; human: number }[];
  recentLeads: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('institution_id').eq('id', user.id).single();
      
      if (!profile?.institution_id) {
        setError('Nenhuma instituição vinculada. Acesse as Configurações.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/dashboard/stats?institution_id=${profile.institution_id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
    } catch (err: any) {
      console.error('Erro ao buscar stats:', err);
      setError(err.message || 'Erro ao carregar estatísticas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    let channel: any;

    const setupRealtime = async () => {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      
      const channelId = `dashboard_stats_${Math.random().toString(36).substring(7)}`;
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leads' },
          () => {
            console.log('Dados de leads mudaram, atualizando dashboard...');
            fetchStats();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        import('@/utils/supabase/client').then(m => {
          const supabase = m.createClient();
          supabase.removeChannel(channel);
        });
      }
    };
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh', display: 'flex' }}>
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={styles.container}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error || 'Não foi possível carregar as estatísticas.'}
        </div>
      </div>
    );
  }

  const aiAutonomyPct = stats.total > 0 ? Math.round((stats.aiHandling / stats.total) * 100) : 0;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Visão Geral</h1>
        <p className={styles.subtitle}>Acompanhe a performance da IA e do time comercial em tempo real.</p>
      </div>

      {/* Cards de Métricas */}
      <div className={styles.statsGrid}>
        <div className="card">
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Total de Leads (Mês)</span>
            <div className={styles.iconWrapper} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
              <Users size={20} />
            </div>
          </div>
          <p className={styles.statValue}>{stats.total.toLocaleString('pt-BR')}</p>
          <div className={styles.statFooter}>
            <TrendingUp size={14} className={styles.trendUp} />
            <span className={styles.trendText}>{stats.newLeads} novos aguardando atendimento</span>
          </div>
        </div>

        <div className="card">
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Atendidos pela IA</span>
            <div className={styles.iconWrapper} style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-secondary)' }}>
              <Bot size={20} />
            </div>
          </div>
          <p className={styles.statValue}>{aiAutonomyPct}%</p>
          <div className={styles.statFooter}>
            <Activity size={14} style={{ color: 'var(--accent-secondary)' }} />
            <span className={styles.trendText}>{stats.activeAgents} agente(s) ativo(s)</span>
          </div>
        </div>

        <div className="card">
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Conversão Direta</span>
            <div className={styles.iconWrapper} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <p className={styles.statValue}>{stats.conversionRate}%</p>
          <div className={styles.statFooter}>
            <span className={styles.trendText}>{stats.converted} matrículas realizadas</span>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className={styles.chartsGrid}>
        <div className="card">
          <h3 className={styles.chartTitle}>Novas Capturas Semanais (IA vs Humano)</h3>
          {stats.weeklyChart.some(d => d.ai > 0 || d.human > 0) ? (
            <div className={styles.chartContainer}>
              <WeeklyChart data={stats.weeklyChart} />
            </div>
          ) : (
            <div className={styles.emptyChart}>
              <TrendingUp size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <p>Sem capturas nos últimos 7 dias. Os dados aparecerão aqui quando leads chegarem pelo WhatsApp.</p>
            </div>
          )}
        </div>

        {/* Feed de Últimos Leads */}
        <div className="card">
          <h3 className={styles.chartTitle}>Atividade Recente</h3>
          {stats.recentLeads.length === 0 ? (
            <div className={styles.emptyChart}>
              <Users size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <p>Nenhum lead ainda. Os contatos do WhatsApp aparecerão aqui.</p>
            </div>
          ) : (
            <div className={styles.recentLeads}>
              {stats.recentLeads.map((lead) => (
                <div key={lead.id} className={styles.leadRow}>
                  <div className={styles.leadAvatar}>
                    {(lead.name || lead.phone)?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className={styles.leadDetails}>
                    <span className={styles.leadName}>{lead.name || 'Sem nome'}</span>
                    <span className={styles.leadPhone}>
                      <Phone size={11} /> {lead.phone}
                    </span>
                  </div>
                  <span className={styles.leadStatus} style={{ color: statusMap[lead.status]?.color }}>
                    {statusMap[lead.status]?.label || lead.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
