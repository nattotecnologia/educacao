'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const WeeklyChart = dynamic(() => import('./components/WeeklyChart'), { 
  ssr: false, 
  loading: () => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}><Loader2 className="animate-spin" /></div>
});
const EnrollmentEvolutionChart = dynamic(() => import('./components/EnrollmentEvolutionChart'), { 
  ssr: false, 
  loading: () => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}><Loader2 className="animate-spin" /></div>
});
import { Users, Bot, CheckCircle, TrendingUp, TrendingDown, Activity, Clock, Phone, Loader2, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { authService } from '@/services';
import { maskPhone } from '@/utils/masks';
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
  heatmapData: number[];
  rankedCourses?: { name: string; count: number }[];
  enrollmentEvolution?: { name: string; count: number }[];
  totalBilled?: number;
}

const fetchDashboardStats = async (institutionId: string) => {
  const supabase = (await import('@/utils/supabase/client')).createClient();
  
  const res = await fetch(`/api/dashboard/stats?institution_id=${institutionId}`);
  if (!res.ok) throw new Error('Falha ao buscar estatísticas básicas.');
  
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  // Buscar dados de cursos e matrículas para o ranking de cursos em alta
  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);

  const { data: enrollmentsData } = await supabase
    .from('enrollments')
    .select('enrolled_at, status, classes(courses(id, name, price))')
    .eq('institution_id', institutionId);

  const courseCounts: Record<string, number> = {};
  coursesData?.forEach((c) => {
    courseCounts[c.name] = 0;
  });

  enrollmentsData?.forEach((e: any) => {
    const courseName = e.classes?.courses?.name;
    if (courseName && courseCounts[courseName] !== undefined) {
      courseCounts[courseName] += 1;
    }
  });

  const ranked = Object.entries(courseCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Calcular evolução histórica de matrículas (últimos 6 meses)
  const monthsMap = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const evolutionMap: Record<string, number> = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${monthsMap[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    evolutionMap[key] = 0;
  }

  enrollmentsData?.forEach((e: any) => {
    if (e.enrolled_at) {
      const date = new Date(e.enrolled_at);
      const key = `${monthsMap[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
      if (evolutionMap[key] !== undefined) {
        evolutionMap[key] += 1;
      }
    }
  });

  const evolution = Object.entries(evolutionMap).map(([name, count]) => ({
    name,
    count
  }));

  // Buscar promoções ativas
  const { data: promotionsData } = await supabase
    .from('promotions')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('is_active', true);

  const now = new Date();
  const activePromotions = (promotionsData || []).filter((p: any) => {
    if (!p.valid_until) return true;
    return new Date(p.valid_until) >= now;
  });

  const globalPromotions = activePromotions.filter((p: any) => !p.course_id);

  let totalBilled = 0;
  enrollmentsData?.forEach((e: any) => {
    if (e.status === 'active') {
      let price = e.classes?.courses?.price || 0;
      const courseId = e.classes?.courses?.id;
      const enrolledAt = new Date(e.enrolled_at);

      if (price > 0 && courseId) {
        const specificPromo = activePromotions.find((p: any) => p.course_id === courseId && new Date(p.created_at) <= enrolledAt);
        const validGlobalPromos = globalPromotions.filter((p: any) => new Date(p.created_at) <= enrolledAt);
        const appliedPromo = specificPromo || (validGlobalPromos.length > 0 ? validGlobalPromos[0] : null);

        if (appliedPromo) {
          let discountAmount = 0;
          if (appliedPromo.discount_percentage) {
            discountAmount = price * (appliedPromo.discount_percentage / 100);
          } else if (appliedPromo.discount_value) {
            discountAmount = appliedPromo.discount_value;
          }
          price = Math.max(0, price - discountAmount);
        }
      }

      totalBilled += price;
    }
  });

  return {
    ...data,
    rankedCourses: ranked,
    enrollmentEvolution: evolution,
    totalBilled
  };
};

export default function Dashboard() {
  const queryClient = useQueryClient();

  // Query do Perfil (compartilhado e cacheado globalmente)
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { data, error } = await supabase.from('profiles').select('institution_id, full_name').eq('id', user.id).single();
      if (error) throw error;
      return data;
    }
  });

  const institutionId = profile?.institution_id;
  const userName = profile?.full_name || '';

  // Query de Estatísticas (reativa, baseada no ID da instituição)
  const { data: stats, isLoading: isStatsLoading, error } = useQuery<Stats>({
    queryKey: ['dashboardStats', institutionId],
    queryFn: () => fetchDashboardStats(institutionId!),
    enabled: !!institutionId,
  });

  // Listener Supabase Realtime para invalidar cache de queries
  useEffect(() => {
    if (!institutionId) return;
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
            console.log('Realtime: leads alterados. Atualizando stats...');
            queryClient.invalidateQueries({ queryKey: ['dashboardStats', institutionId] });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'enrollments' },
          () => {
            console.log('Realtime: matrículas alteradas. Atualizando stats...');
            queryClient.invalidateQueries({ queryKey: ['dashboardStats', institutionId] });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'visit_appointments' },
          () => {
            console.log('Realtime: agendamentos alterados. Atualizando stats...');
            queryClient.invalidateQueries({ queryKey: ['dashboardStats', institutionId] });
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
  }, [institutionId, queryClient]);

  if (isProfileLoading || (institutionId && isStatsLoading)) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh', display: 'flex' }}>
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  if (!isProfileLoading && !institutionId) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '2rem', border: '1px solid var(--glass-border)' }}>
          <h2 style={{ color: 'var(--accent-danger)', marginBottom: '1rem' }}>Vínculo de Instituição Pendente</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Seu perfil foi carregado com sucesso, mas ainda não está associado a nenhuma instituição educacional. 
            Isso pode ocorrer se o cadastro inicial não tiver sido concluído ou se houver pendências de sincronização.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link href="/dashboard/settings" className="custom-button">
              Ir para Configurações
            </Link>
            <button 
              onClick={() => authService.logout().then(() => window.location.href = '/login')}
              className="custom-button" 
              style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            >
              Fazer Sair (Logout)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={styles.container}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error?.message || 'Não foi possível carregar as estatísticas.'}
        </div>
      </div>
    );
  }

  const aiAutonomyPct = stats.total > 0 ? Math.round((stats.aiHandling / stats.total) * 100) : 0;

  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = userName ? userName.split(' ')[0] : 'Equipe';
  const greeting = `${greetingTime}, ${firstName}!`;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{greeting}</h1>
        <p className={styles.subtitle}>Visão geral e performance comercial em tempo real.</p>
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

        <div className="card">
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Faturamento Estimado</span>
            <div className={styles.iconWrapper} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <p className={styles.statValue}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalBilled || 0)}
          </p>
          <div className={styles.statFooter}>
            <span className={styles.trendText}>Receita de matrículas ativas</span>
          </div>
        </div>
      </div>

      {/* Gráficos Principais (Lado a Lado, Mesmo Tamanho) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
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

        {/* Evolução de Matrículas */}
        <div className="card">
          <h3 className={styles.chartTitle}>Evolução de Matriculados (Últimos 6 Meses)</h3>
          {stats.enrollmentEvolution && stats.enrollmentEvolution.some(d => d.count > 0) ? (
            <div className={styles.chartContainer}>
              <EnrollmentEvolutionChart data={stats.enrollmentEvolution} />
            </div>
          ) : (
            <div className={styles.emptyChart}>
              <TrendingUp size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <p>Nenhuma matrícula registrada nos últimos 6 meses. Novas matrículas aparecerão aqui automaticamente.</p>
            </div>
          )}
        </div>
      </div>

      {/* Cartões de Desempenho e Atividades (3 em uma Linha Só) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Cursos em Alta */}
        <div className="card">
          <h3 className={styles.chartTitle}>Cursos em Alta (Ranking)</h3>
          {!stats.rankedCourses || stats.rankedCourses.length === 0 ? (
            <div className={styles.emptyChart}>
              <TrendingUp size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <p>Nenhum curso ativo registrado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats.rankedCourses.map((c, idx) => {
                const rank = idx + 1;
                let badge = null;
                if (rank === 1) badge = <span style={{ fontSize: '1.25rem' }}>🥇</span>;
                else if (rank === 2) badge = <span style={{ fontSize: '1.25rem' }}>🥈</span>;
                else if (rank === 3) badge = <span style={{ fontSize: '1.25rem' }}>🥉</span>;
                else badge = <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', width: '24px', display: 'inline-block', textAlign: 'center' }}>{rank}</span>;

                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '10px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0 }}>
                        {badge}
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.name}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.25rem 0.6rem', borderRadius: '6px', flexShrink: 0, marginLeft: '0.5rem' }}>
                      {c.count} {c.count === 1 ? 'matrícula' : 'matrículas'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mapa de Calor de Visitas */}
        <div className="card">
          <h3 className={styles.chartTitle}>Visitas no Mês Atual (Mapa de Calor)</h3>
          {stats.heatmapData && stats.heatmapData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {/* Header com Dias da Semana */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, idx) => <span key={`${d}-${idx}`}>{d}</span>)}
              </div>
              
              {/* Grid do Calendário */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {/* Preenche os dias vazios antes do dia 1 */}
                {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ aspectRatio: '1/1' }} />
                ))}
                
                {/* Dias do Mês */}
                {stats.heatmapData.map((val, i) => {
                  const max = Math.max(...stats.heatmapData, 1);
                  const intensity = val > 0 ? 0.2 + (val / max) * 0.8 : 0.05;
                  const dayNum = i + 1;
                  
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        aspectRatio: '1/1', 
                        borderRadius: 'var(--radius-sm)', 
                        backgroundColor: 'var(--accent-primary)', 
                        opacity: intensity,
                        transition: 'opacity 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: val > 0 ? 700 : 400,
                        color: val > 0 ? '#fff' : 'var(--text-muted)',
                        position: 'relative',
                        cursor: 'pointer'
                      }}
                      title={`Dia ${dayNum}: ${val} visitas`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Distribuição de visitas ao longo do mês vigente</p>
            </div>
          ) : (
             <div className={styles.emptyChart}>
               <Activity size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
               <p>Sem dados suficientes para o mapa de calor do mês.</p>
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
                      <Phone size={11} /> {maskPhone(lead.phone)}
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
