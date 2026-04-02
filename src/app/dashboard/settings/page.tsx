'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, ShieldCheck, Mail, Globe, BrainCircuit, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import styles from './Settings.module.css';

import { authService } from '@/services';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  const [institution, setInstitution] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchInstitution() {
      try {
        const profile = await authService.getProfile();
        
        if (!profile?.institution_id) {
          setErrorMsg('Sua conta não possui uma Instituição vinculada. Crie uma nova conta em /register.');
          setLoading(false);
          return;
        }

        const { data: inst, error: instError } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', profile.institution_id)
          .single();
        
        if (instError) {
          setErrorMsg('Erro de permissão ou as tabelas SQL não foram atualizadas.');
          setLoading(false);
          return;
        }

        setInstitution(inst);
      } catch (err: any) {
        console.error('Erro ao buscar dados:', typeof err === 'object' ? JSON.stringify(err) : err);
        setErrorMsg(err?.message || 'Sua sessão parece inválida ou a conta não possui escola. Faça logout e login.');
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setErrorMsg('');

    try {
      const profile = await authService.getProfile();
      const institutionId = institution?.id || profile.institution_id;

      if (!institutionId) throw new Error("ID da Instituição não resolvido. Relogue no sistema.");

      const { error } = await supabase
        .from('institutions')
        .update({
          name: institution.name,
          ai_provider: institution.ai_provider,
          ai_api_key: institution.ai_api_key, // Mantido como backup/custom
          openai_key: institution.openai_key,
          groq_key: institution.groq_key,
          openrouter_key: institution.openrouter_key,
          ai_model: institution.ai_model,
          ai_base_url: institution.ai_base_url
        })
        .eq('id', institutionId);

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
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
