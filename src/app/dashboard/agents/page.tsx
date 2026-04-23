'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bot, Settings, Play, Pause, Plus, Activity, Cpu, Loader2, AlertCircle, BrainCircuit
} from 'lucide-react';
import { agentService } from '@/services';
import { getInstitutionSettings, updateInstitutionSettings, updateTokenQuota, fetchAvailableModels } from '../settings/actions';

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
  const [tokenUsage, setTokenUsage] = useState(0);
  const [tokenQuota, setTokenQuota] = useState(1000000);
  const [newQuota, setNewQuota] = useState('');
  const [savingQuota, setSavingQuota] = useState(false);
  const [modelsList, setModelsList] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);


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
        const quota = instData.ai_token_quota ?? 1000000;
        const usage = instData.ai_token_usage ?? 0;
        setTokenQuota(quota);
        setTokenUsage(usage);
        setNewQuota(String(quota));
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

  // Busca modelos automaticamente quando o provedor ou a chave muda
  useEffect(() => {
    const key = aiSettings.ai_provider === 'openai' ? aiSettings.openai_key : 
                aiSettings.ai_provider === 'groq' ? aiSettings.groq_key : 
                aiSettings.openrouter_key;
                
    if (key && key.length > 10) {
      const timer = setTimeout(async () => {
        setLoadingModels(true);
        try {
          const models = await fetchAvailableModels(aiSettings.ai_provider, key);
          setModelsList(models);
        } catch (err) {
          console.error('Falha ao listar modelos:', err);
        } finally {
          setLoadingModels(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setModelsList([]);
    }
  }, [aiSettings.ai_provider, aiSettings.openai_key, aiSettings.groq_key, aiSettings.openrouter_key]);


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

  const handleSaveQuota = async () => {
    const quotaNum = parseInt(newQuota, 10);
    if (isNaN(quotaNum) || quotaNum < 1000) {
      addNotification({ type: 'error', title: 'Erro', message: 'A cota mínima é 1.000 tokens.' });
      return;
    }
    setSavingQuota(true);
    try {
      await updateTokenQuota(quotaNum);
      setTokenQuota(quotaNum);
      addNotification({ type: 'success', title: 'Cota Atualizada', message: `Nova cota: ${quotaNum.toLocaleString('pt-BR')} tokens.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Erro', message: err.message || 'Falha ao atualizar cota.' });
    } finally {
      setSavingQuota(false);
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
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BrainCircuit size={20} /> Configuração Global da Inteligência
          </h3>

          {/* --- Barra de Progresso de Tokens --- */}
          {(() => {
            const pct = tokenQuota > 0 ? Math.min((tokenUsage / tokenQuota) * 100, 100) : 0;
            const barColor = pct < 60
              ? '#22c55e'
              : pct < 85
              ? '#f59e0b'
              : '#ef4444';
            return (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Activity size={13} /> Uso de Tokens da LLM
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: barColor }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
                {/* Track */}
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, #22c55e, ${barColor})`,
                      borderRadius: '99px',
                      transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                      boxShadow: `0 0 8px ${barColor}66`,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {tokenUsage.toLocaleString('pt-BR')} tokens usados
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Cota: {tokenQuota.toLocaleString('pt-BR')}
                  </span>
                </div>
                {/* Ajuste de cota */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={newQuota}
                    onChange={(e) => setNewQuota(e.target.value)}
                    placeholder="Nova cota (tokens)"
                    style={{ flex: 1, padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '7px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                  />
                  <button
                    className="custom-button"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                    onClick={handleSaveQuota}
                    disabled={savingQuota}
                  >
                    {savingQuota ? <Loader2 size={14} className="animate-spin" /> : 'Salvar Cota'}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* --- Configurações de Provedor/Modelo --- */}
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
              <div style={{ position: 'relative' }}>
                <select 
                  value={aiSettings.ai_model}
                  onChange={(e) => setAiSettings({...aiSettings, ai_model: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', appearance: 'none' }}
                  disabled={loadingModels}
                >
                  <option value="">{loadingModels ? 'Buscando modelos...' : 'Selecione um modelo'}</option>
                  {modelsList.length > 0 ? (
                    <>
                      <optgroup label="✨ Modelos Gratuitos (Free)">
                        {modelsList.filter(m => m.category === 'free').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🚀 Modelos Premium / Pagos">
                        {modelsList.filter(m => m.category === 'premium').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    aiSettings.ai_model && <option value={aiSettings.ai_model}>{aiSettings.ai_model}</option>
                  )}
                </select>
                {loadingModels && (
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {modelsList.length > 0 ? `${modelsList.length} modelos encontrados.` : 'Insira a chave para listar os modelos.'}
              </p>
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
