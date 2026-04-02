'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bot, Settings, Play, Pause, Plus, Activity, Cpu, Loader2, AlertCircle
} from 'lucide-react';
import { agentService } from '@/services';
import styles from './Agents.module.css';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAgents = async () => {
    try {
      const data = await agentService.getAll();
      setAgents(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar agentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const updated = await agentService.toggleStatus(id, currentStatus);
      setAgents(agents.map(a => a.id === id ? updated : a));
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  if (loading) return (
    <div className={styles.loadingState}>
      <Loader2 className="animate-spin" size={40} />
      <p>Carregando agentes...</p>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Agentes de IA</h1>
          <p className={styles.subtitle}>Configure as instruções e o comportamento dos seus assistentes virtuais.</p>
        </div>
        <Link href="/dashboard/agents/new" className="custom-button">
          <Plus size={18} />
          <span>Novo Agente</span>
        </Link>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className={styles.agentsGrid}>
        {agents.map((agent) => (
          <div key={agent.id} className={`glass-panel ${styles.agentCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.avatarWrapper}>
                <Bot size={24} style={{ color: agent.status === 'active' ? 'var(--accent-success)' : 'var(--text-muted)' }} />
              </div>
              <div className={styles.statusIndicator}>
                <span className={agent.status === 'active' ? styles.statusDotActive : styles.statusDotInactive}></span>
                <span className={styles.statusText}>{agent.status === 'active' ? 'Operacional' : 'Inativo'}</span>
              </div>
            </div>

            <div className={styles.cardBody}>
              <h3 className={styles.agentName}>{agent.name}</h3>
              <p className={styles.agentPrompt}>
                {agent.system_prompt ? `"${agent.system_prompt.substring(0, 80)}..."` : 'Sem instruções configuradas.'}
              </p>
              
              <div className={styles.metrics}>
                <div className={styles.metricItem}>
                  <Activity size={14} className={styles.metricIcon} />
                  <span>Interações Ativas</span>
                </div>
                <div className={styles.metricItem}>
                  <Cpu size={14} className={styles.metricIcon} />
                  <span>Status: {agent.status === 'active' ? 'Pronto' : 'Pausado'}</span>
                </div>
              </div>
            </div>

            <div className={styles.cardActions}>
              <Link href={`/dashboard/agents/${agent.id}`} className={styles.actionBtn}>
                <Settings size={18} />
                <span>Configurar</span>
              </Link>
              <div className={styles.divider}></div>
              <button 
                className={styles.actionBtn} 
                onClick={() => toggleStatus(agent.id, agent.status)}
                style={{ color: agent.status === 'active' ? 'var(--accent-warning)' : 'var(--accent-success)' }}
              >
                {agent.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                <span>{agent.status === 'active' ? 'Pausar' : 'Ativar'}</span>
              </button>
            </div>
          </div>
        ))}

        <Link href="/dashboard/agents/new" className={styles.addAgentCard}>
          <div className={styles.addIconWrapper}>
            <Plus size={32} />
          </div>
          <p>Adicionar Novo Agente</p>
        </Link>
      </div>
    </div>
  );
}
