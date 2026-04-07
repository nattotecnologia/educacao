'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, ShieldCheck, Mail, Globe, BrainCircuit, Loader2, RefreshCw } from 'lucide-react';
import styles from './Settings.module.css';

import { getInstitutionSettings, updateInstitutionSettings } from './actions';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [syncingStatus, setSyncingStatus] = useState(false);

  const [institution, setInstitution] = useState<any>(null);

  useEffect(() => {
    async function fetchInstitution() {
      try {
        const data = await getInstitutionSettings();
        if (data) {
          setInstitution(data);
        }
      } catch (err: any) {
        console.error('Erro ao buscar dados:', err);
        setErrorMsg(err?.message || 'Erro ao carregar configurações. Tente novamente.');
      } finally {
        setLoading(false);
      }
    }
    fetchInstitution();
  }, []);

  // Busca automática de modelos com Debounce
  useEffect(() => {
    const currentKey = 
      institution?.ai_provider === 'openai' ? institution?.openai_key :
      institution?.ai_provider === 'groq' ? institution?.groq_key :
      institution?.ai_provider === 'openrouter' ? institution?.openrouter_key :
      institution?.ai_api_key; // fallback para custom

    if (currentKey?.length > 10) {
      const timer = setTimeout(() => {
        loadModels(institution);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [institution?.openai_key, institution?.groq_key, institution?.openrouter_key, institution?.ai_api_key, institution?.ai_provider, institution?.ai_base_url]);

  const loadModels = async (instData: any) => {
    const currentKey = 
      instData.ai_provider === 'openai' ? instData.openai_key :
      instData.ai_provider === 'groq' ? instData.groq_key :
      instData.ai_provider === 'openrouter' ? instData.openrouter_key :
      instData.ai_api_key;

    if (!instData || !currentKey) return;
    setFetchingModels(true);
    try {
      let url = 'https://api.openai.com/v1/models';
      if (instData.ai_provider === 'openrouter') url = 'https://openrouter.ai/api/v1/models';
      if (instData.ai_provider === 'groq') url = 'https://api.groq.com/openai/v1/models';
      if (instData.ai_base_url) url = `${instData.ai_base_url}/models`;

      url = url.replace(/([^:]\/)\/+/g, "$1");

      const res = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${currentKey}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      
      if (data.data) {
        setAvailableModels(data.data);
      } else if (data.error) {
        console.warn('API recusou listagem:', data.error);
      }
    } catch (err) {
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSyncStatus = async () => {
    if (!institution?.evolution_instance_name) return;
    setSyncingStatus(true);
    try {
      const res = await fetch(`/api/evolution?action=status&instance=${institution.evolution_instance_name}`);
      const data = await res.json();
      
      const newStatus = data?.instance?.state === 'open' ? 'connected' : 'disconnected';
      
      // Atualiza localmente e no banco de forma otimista (opcional, aqui só local pra feedback)
      setInstitution((prev: any) => ({ ...prev, whatsapp_status: newStatus }));
    } catch (err) {
      console.error('Erro ao sincronizar status:', err);
    } finally {
      setSyncingStatus(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setErrorMsg('');

    try {
      await updateInstitutionSettings(institution);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setErrorMsg(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Configurações do Sistema</h1>
          <p className={styles.subtitle}>Gerencie sua instituição e as credenciais das inteligências artificiais.</p>
        </div>
      </div>

      {errorMsg && (
         <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
           {errorMsg}
         </div>
      )}

      {/* BLOQUEIO DE TELA SE NÃO TIVER INSTITUIÇÃO (impede deletar o state via input) */}
      {!institution ? (
         <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <Globe className="text-secondary" size={48} style={{ margin: '0 auto 1rem' }} />
            <h3>Nenhuma instituição vinculada</h3>
            <p>Seu usuário não possui os requisitos mínimos para acessar esta área.</p>
         </div>
      ) : (
      <form onSubmit={handleSave} className={styles.grid}>

        {/* Painel Esquerdo - Instituição */}
        <div className={`glass-panel ${styles.panel}`}>
          <div className={styles.panelTitle}>
            <Globe size={20} />
            <h2>Dados da Instituição</h2>
          </div>
          <div className={styles.inputGroup}>
            <label>Nome Oficial da Escola</label>
            <input 
              type="text" 
              value={institution?.name || ''} 
              onChange={(e) => setInstitution({...institution, name: e.target.value})}
              className={styles.input} 
            />
          </div>
          <div className={styles.inputGroup}>
            <label>E-mail Corporativo</label>
            <input 
              type="email" 
              placeholder="contato@escola.com"
              className={styles.input} 
            />
          </div>
          <p className={styles.infoText}>Esses dados serão usados para identificação em relatórios e cabeçalhos de mensagens se configurados.</p>
        </div>

        {/* Painel Central - Conexão WhatsApp */}
        <div className={`glass-panel ${styles.panel}`}>
          <div className={styles.panelTitle}>
            <ShieldCheck size={20} />
            <h2>Conexão WhatsApp (Evolution API)</h2>
          </div>
          
          <div className={styles.inputGroup}>
            <label>Nome da Instância</label>
            <input 
              type="text" 
              placeholder="Ex: education"
              value={institution?.evolution_instance_name || ''} 
              onChange={(e) => setInstitution({...institution, evolution_instance_name: e.target.value})}
              className={styles.input} 
            />
          </div>

          <div className={styles.inputGroup}>
            <label>API Token / Key</label>
            <input 
              type="password" 
              placeholder="Token da Instância ou Global Key"
              value={institution?.evolution_api_key || ''} 
              onChange={(e) => setInstitution({...institution, evolution_api_key: e.target.value})}
              className={styles.input} 
            />
          </div>

          <div className={styles.webhookInfo}>
            <label>Sua URL de Webhook (Copie para a Evolution):</label>
            <div className={styles.urlDisplay}>
              <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/evolution` : '...'}</code>
            </div>
          </div>

          <div className={styles.statusBadge}>
            <div className={`${styles.statusDot} ${institution?.whatsapp_status === 'connected' ? styles.online : styles.offline}`} />
            <span>Status: {institution?.whatsapp_status === 'connected' ? 'Conectado' : 'Desconectado'}</span>
            
            <button 
              type="button"
              className={styles.syncBtn} 
              onClick={handleSyncStatus}
              disabled={syncingStatus || !institution?.evolution_instance_name}
              title="Sincronizar Status com Evolution"
            >
              <RefreshCw size={14} className={syncingStatus ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Painel Direito - Integração AI */}
        <div className={`glass-panel ${styles.panel}`}>
          <div className={styles.panelTitle}>
            <BrainCircuit size={20} />
            <h2>Cérebro da IA (Integração LLM)</h2>
          </div>
          <div className={styles.inputGroup}>
            <label>Provedor / API Principal</label>
            <select 
              value={institution?.ai_provider || 'openai'}
              onChange={(e) => {
                const newInst = {...institution, ai_provider: e.target.value};
                setInstitution(newInst);
                setAvailableModels([]); // Limpa ao trocar
              }}
              className={styles.input}
            >
              <option value="openai">OpenAI (GPT-4 / GPT-3.5)</option>
              <option value="groq">Groq (Llama 3 / Mixtral)</option>
              <option value="openrouter">OpenRouter (Múltiplos Modelos)</option>
              <option value="custom">API Customizada (URL Base)</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label>API Key ({institution?.ai_provider?.toUpperCase()})</label>
            <div className={styles.keyArea}>
              <input 
                type="password" 
                placeholder="Insira sua chave aqui..."
                value={
                  institution?.ai_provider === 'openai' ? institution?.openai_key || '' :
                  institution?.ai_provider === 'groq' ? institution?.groq_key || '' :
                  institution?.ai_provider === 'openrouter' ? institution?.openrouter_key || '' :
                  institution?.ai_api_key || ''
                } 
                onChange={(e) => {
                  const val = e.target.value;
                  const keyNode = 
                    institution?.ai_provider === 'openai' ? 'openai_key' :
                    institution?.ai_provider === 'groq' ? 'groq_key' :
                    institution?.ai_provider === 'openrouter' ? 'openrouter_key' :
                    'ai_api_key';
                  setInstitution({...institution, [keyNode]: val});
                }}
                className={styles.input} 
              />
              <button 
                type="button" 
                onClick={() => loadModels(institution)} 
                className={styles.fetchBtn}
                disabled={fetchingModels}
              >
                {fetchingModels ? <Loader2 className="animate-spin" size={16} /> : 'Listar Modelos'}
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>Escolher Modelo {fetchingModels && <Loader2 className="animate-spin inline" size={12} />}</label>
              {availableModels.length > 0 ? (
                <select
                  value={institution?.ai_model || ''}
                  onChange={(e) => setInstitution({...institution, ai_model: e.target.value})}
                  className={styles.input}
                >
                  <option value="">Selecione um modelo...</option>
                  {availableModels.map(m => {
                    // Lógica para OpenRouter preços
                    const isFree = m.pricing?.prompt === '0' && m.pricing?.completion === '0';
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id} {isFree ? '(FREE)' : '(Premium)'}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input 
                  type="text" 
                  placeholder="ID do modelo (ex: gpt-4o)"
                  value={institution?.ai_model || ''} 
                  onChange={(e) => setInstitution({...institution, ai_model: e.target.value})}
                  className={styles.input} 
                />
              )}
            </div>
            
            <div className={styles.inputGroup}>
              <label>API Base URL (Opcional)</label>
              <input 
                type="text" 
                placeholder="https://api.groq.com/openai/v1"
                value={institution?.ai_base_url || ''} 
                onChange={(e) => setInstitution({...institution, ai_base_url: e.target.value})}
                className={styles.input} 
              />
            </div>
          </div>
          
          <div className={styles.securityNote}>
            <ShieldCheck size={16} />
            <span>Suas chaves são criptografadas e nunca exibidas ao público.</span>
          </div>
        </div>

        <div className={styles.footer}>
          {errorMsg && <span className={styles.error}>{errorMsg}</span>}
          {success && <span className={styles.success}>Configurações atualizadas com sucesso!</span>}
          <button type="submit" className="custom-button" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Salvar Alterações</>}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
