'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bot, Settings, Play, Pause, Plus, Activity, Cpu, Loader2, AlertCircle, BrainCircuit,
  Key, Sparkles, Coins, ShieldCheck, Search
} from 'lucide-react';
import { agentService } from '@/services';
import { getInstitutionSettings, updateInstitutionSettings, updateTokenQuota, fetchAvailableModels } from '../settings/actions';
import Autocomplete from '@/components/ui/Autocomplete';

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
  const [isManualModel, setIsManualModel] = useState(false);


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
        <div className={styles.aiSettingsWrapper}>
          <div className={styles.aiSettingsHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.5rem', background: 'var(--accent-primary)', borderRadius: '10px', color: '#fff' }}>
                <BrainCircuit size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Configuração Global da Inteligência</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Defina o cérebro e os recursos de IA para todos os seus agentes.</p>
              </div>
            </div>
            <button onClick={() => setShowAiSettings(false)} style={{ color: 'var(--text-muted)' }}>
              <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
            </button>
          </div>

          <div className={styles.aiSettingsContent}>
            {/* --- Seção de Uso e Cota --- */}
            <div className={styles.settingsSection}>
              <div className={styles.settingsInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>
                  <Coins size={16} />
                  <h4 style={{ margin: 0 }}>Consumo de Tokens</h4>
                </div>
                <p>Gerencie o limite de uso e acompanhe o consumo da sua cota em tempo real.</p>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                {(() => {
                  const pct = tokenQuota > 0 ? Math.min((tokenUsage / tokenQuota) * 100, 100) : 0;
                  const barColor = pct < 60 ? '#22c55e' : pct < 85 ? '#f59e0b' : '#ef4444';
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{pct.toFixed(1)}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacidade Utilizada</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{tokenUsage.toLocaleString('pt-BR')}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>de {tokenQuota.toLocaleString('pt-BR')} tokens</div>
                        </div>
                      </div>
                      
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, #10b981, ${barColor})`,
                            borderRadius: '99px',
                            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: `0 0 10px ${barColor}44`
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            type="number"
                            value={newQuota}
                            onChange={(e) => setNewQuota(e.target.value)}
                            placeholder="Nova cota..."
                            style={{ width: '100%', padding: '0.65rem 1rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                          />
                        </div>
                        <button
                          className="custom-button"
                          style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}
                          onClick={handleSaveQuota}
                          disabled={savingQuota}
                        >
                          {savingQuota ? <Loader2 size={16} className="animate-spin" /> : 'Atualizar Cota'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* --- Seção de Provedor e Chaves --- */}
            <div className={styles.settingsSection}>
              <div className={styles.settingsInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>
                  <ShieldCheck size={16} />
                  <h4 style={{ margin: 0 }}>Provedor e Chaves</h4>
                </div>
                <p>Configure sua conexão com as APIs de inteligência artificial.</p>
              </div>

              <div className={styles.settingsInputs}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Provedor de LLM</label>
                  <select 
                    value={aiSettings.ai_provider}
                    onChange={(e) => setAiSettings({...aiSettings, ai_provider: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="openai">OpenAI (Oficial)</option>
                    <option value="groq">Groq (Ultra-Rápido)</option>
                    <option value="openrouter">OpenRouter (Múltiplos)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Chave de API</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="password"
                      value={aiSettings.ai_provider === 'openai' ? aiSettings.openai_key : aiSettings.ai_provider === 'groq' ? aiSettings.groq_key : aiSettings.openrouter_key}
                      onChange={(e) => {
                        const val = e.target.value;
                        const keyNode = aiSettings.ai_provider === 'openai' ? 'openai_key' : aiSettings.ai_provider === 'groq' ? 'groq_key' : 'openrouter_key';
                        setAiSettings({...aiSettings, [keyNode]: val});
                      }}
                      placeholder={`Sua chave ${aiSettings.ai_provider}...`}
                      style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div className={styles.fullWidth}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} /> Modelo de Inteligência
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setIsManualModel(!isManualModel)}
                      style={{ 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        border: '1px solid rgba(59, 130, 246, 0.2)', 
                        color: 'var(--accent-primary)', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        cursor: 'pointer', 
                        padding: '0.4rem 0.8rem', 
                        borderRadius: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                    >
                      {isManualModel ? 'Selecionar da Lista' : 'Digitar Manualmente'}
                    </button>
                  </div>
                  
                  <div style={{ minHeight: '45px' }}>
                    {isManualModel ? (
                      <input
                        type="text"
                        value={aiSettings.ai_model}
                        onChange={(e) => setAiSettings({...aiSettings, ai_model: e.target.value})}
                        placeholder="Ex: gpt-4o ou openrouter/model-id"
                        style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.875rem' }}
                      />
                    ) : (
                      <Autocomplete
                        options={modelsList}
                        value={aiSettings.ai_model}
                        onChange={(val) => setAiSettings({...aiSettings, ai_model: val})}
                        placeholder={loadingModels ? "Buscando modelos disponíveis..." : "Pesquise um modelo de IA..."}
                        isLoading={loadingModels}
                      />
                    )}
                  </div>
                  
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: 0.8 }}>
                    <Search size={10} /> {modelsList.length > 0 ? `${modelsList.length} modelos sincronizados com seu provedor.` : 'Aguardando chave de API para sincronizar modelos.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.aiFooter}>
             <button onClick={() => setShowAiSettings(false)} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Descartar</button>
             <button className="custom-button" onClick={handleSaveAi} disabled={savingAi} style={{ minWidth: '200px' }}>
               {savingAi ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Todas as Configurações'}
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
