'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bot, Settings, Play, Pause, Plus, Activity, Cpu, Loader2, AlertCircle, BrainCircuit
} from 'lucide-react';
import { agentService } from '@/services';
import { getInstitutionSettings, updateInstitutionSettings } from '../settings/actions';
import styles from './Agents.module.css';
import { useNotification } from '@/contexts/NotificationContext';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addNotification } = useNotification();
  
  const [institution, setInstitution] = useState<any>(null);
  const [aiSettings, setAiSettings] = useState({
    ai_provider: 'openai',
    ai_api_key: '',
    openai_key: '',
    groq_key: '',
    openrouter_key: '',
    ai_model: ''
  });
  const [savingAi, setSavingAi] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agentsData, instData] = await Promise.all([
        agentService.getAll(),
        getInstitutionSettings()
      ]);
      setAgents(agentsData);
      if (instData) {
        setInstitution(instData);
        setAiSettings({
          ai_provider: instData.ai_provider || 'openai',
          ai_api_key: instData.ai_api_key || '',
          openai_key: instData.openai_key || '',
          groq_key: instData.groq_key || '',
          openrouter_key: instData.openrouter_key || '',
          ai_model: instData.ai_model || ''
        });
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      await updateInstitutionSettings({
        ...institution,
        ...aiSettings
      });
      addNotification({ type: 'success', title: 'Sucesso', message: 'Configurações de IA atualizadas.' });
      setShowAiSettings(false);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Erro', message: err.message || 'Falha ao salvar.' });
    } finally {
      setSavingAi(false);
    }
  };

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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="custom-button secondary" onClick={() => setShowAiSettings(!showAiSettings)}>
            <Cpu size={18} />
            <span>Provedores (LLM)</span>
          </button>
          <Link href="/dashboard/agents/new" className="custom-button">
            <Plus size={18} />
            <span>Novo Agente</span>
          </Link>
        </div>
      </div>

      {showAiSettings && (
        <div className="glass-panel animate-in" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--accent-primary)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BrainCircuit size={20} /> Configuração Global da Inteligência
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Provedor Principal</label>
              <select 
                value={aiSettings.ai_provider}
                onChange={(e) => setAiSettings({...aiSettings, ai_provider: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
              >
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>API Key ({aiSettings.ai_provider.toUpperCase()})</label>
              <input 
                type="password"
                value={aiSettings.ai_provider === 'openai' ? aiSettings.openai_key : aiSettings.ai_provider === 'groq' ? aiSettings.groq_key : aiSettings.openrouter_key}
                onChange={(e) => {
                  const val = e.target.value;
                  const keyNode = aiSettings.ai_provider === 'openai' ? 'openai_key' : aiSettings.ai_provider === 'groq' ? 'groq_key' : 'openrouter_key';
                  setAiSettings({...aiSettings, [keyNode]: val});
                }}
                placeholder="Insira sua chave"
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Modelo Padrão</label>
              <input 
                type="text"
                value={aiSettings.ai_model}
                onChange={(e) => setAiSettings({...aiSettings, ai_model: e.target.value})}
                placeholder="Ex: gpt-4o-mini"
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--glass-border)' }}>
             <button onClick={() => setShowAiSettings(false)} style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cancelar</button>
             <button className="custom-button" onClick={handleSaveAi} disabled={savingAi}>
               {savingAi ? <Loader2 className="animate-spin" size={16} /> : 'Salvar Configuração de IA'}
             </button>
          </div>
        </div>
      )}

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
