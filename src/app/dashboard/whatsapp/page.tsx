'use client';

import { useState, useEffect } from 'react';
import { 
  QrCode, Smartphone, CheckCircle2, XCircle, RefreshCw, Loader2, 
  ExternalLink, LogOut, ShieldCheck, Zap
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getInstitutionSettings, updateInstitutionSettings } from '../settings/actions';
import styles from './WhatsApp.module.css';
import { useNotification } from '@/contexts/NotificationContext';

export default function WhatsAppPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [institution, setInstitution] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'open' | 'close' | 'connecting' | 'none'>('none');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualConfig, setManualConfig] = useState<{ manualMode: boolean; instanceName: string | null } | null>(null);
  const { addNotification } = useNotification();

  const [settings, setSettings] = useState({
    evolution_instance_name: '',
    evolution_api_key: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const supabase = createClient();

  // 1. Carrega dados da instituição e check se tem config manual no .env
  useEffect(() => {
    async function init() {
      try {
        const instData = await getInstitutionSettings();
        if (instData) {
          setInstitution(instData);
          setSettings({
            evolution_instance_name: instData.evolution_instance_name || '',
            evolution_api_key: instData.evolution_api_key || ''
          });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Verifica se o servidor já tem dados manuais configurados (Modo Manual)
          const configRes = await fetch('/api/evolution?action=config');
          const configData = await configRes.json();
          setManualConfig(configData);

          if (configData.manualMode || instData?.evolution_instance_name) {
            checkStatus(configData.instanceName || instData?.evolution_instance_name);
          }
        }
      } catch (err) {
        console.error('Erro ao inicializar:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const checkStatus = async (name: string) => {
    if (!name) return;
    try {
      const res = await fetch(`/api/evolution?action=status&instance=${name}`);
      const data = await res.json();
      if (data?.instance?.state) {
        setConnectionStatus(data.instance.state);
      }
    } catch (err) {
      console.error('Erro ao checar status:', err);
    }
  };

  const handleGenerateQR = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      // Prioridade: Nome manual do .env.local -> Nome do banco -> Novo nome gerado
      const instanceName = manualConfig?.instanceName || institution?.evolution_instance_name || `edux_${institution?.id?.slice(0, 8)}`;

      // 1. Handshake/Criar Instância
      const createRes = await fetch('/api/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, action: 'create' }),
      });
      
      const createData = await createRes.json();
      
      if (!createRes.ok) {
        throw new Error(createData.error || 'Falha na comunicação com a API.');
      }

      const activeInstance = createData.instanceName || instanceName;

      // 2. Salva nome da instância no banco se ainda não tiver e NÃO for manual
      if (!institution?.evolution_instance_name && !manualConfig?.manualMode) {
        await supabase.from('institutions').update({ evolution_instance_name: activeInstance }).eq('id', institution.id);
        setInstitution((prev: any) => ({ ...prev, evolution_instance_name: activeInstance }));
      }

      // 3. Busca QR Code
      const qrRes = await fetch(`/api/evolution?action=qr&instance=${activeInstance}`);
      const qrData = await qrRes.json();

      if (qrData.base64) {
        setQrCode(qrData.base64);
        setConnectionStatus('connecting');
      } else if (
        qrData.instance?.state === 'open' || 
        qrData.state === 'open' ||
        qrData.message?.toLowerCase().includes('already connected') ||
        qrData.message?.toLowerCase().includes('already_connected')
      ) {
        setConnectionStatus('open');
        addNotification({ type: 'success', title: 'Conectado', message: 'O WhatsApp já está conectado!' });
      } else {
        console.error('Dados do QR inesperados:', qrData);
        throw new Error('Não foi possível gerar o QR Code. Se o seu WhatsApp já estiver aberto no PC/Web, feche-o e tente novamente.');
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao conectar.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateInstitutionSettings({
        ...institution,
        evolution_instance_name: settings.evolution_instance_name,
        evolution_api_key: settings.evolution_api_key
      });
      setInstitution((prev: any) => ({
        ...prev,
        evolution_instance_name: settings.evolution_instance_name,
        evolution_api_key: settings.evolution_api_key
      }));
      addNotification({ type: 'success', title: 'Sucesso', message: 'Configurações de conexão atualizadas.' });
      if (settings.evolution_instance_name) {
        checkStatus(settings.evolution_instance_name);
      }
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Erro', message: err.message || 'Falha ao salvar.' });
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) return <div className={styles.loadingContainer}><Loader2 className="animate-spin" /> Carregando...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Integração WhatsApp</h1>
          <p className={styles.subtitle}>Conecte seu número oficial para atendimento via IA e campanhas.</p>
        </div>
        {manualConfig?.manualMode && (
          <div className={styles.manualBadge}>
            <ShieldCheck size={14} /> Modo Manual Ativo
          </div>
        )}
      </header>

      {errorMsg && (
        <div className={styles.errorAlert}>
          <XCircle size={18} /> {errorMsg}
        </div>
      )}

      <div className={styles.content}>
        <div className={`glass-panel ${styles.mainCard}`}>
          {connectionStatus === 'open' ? (
            <div className={styles.statusView}>
              <div className={styles.successIconWrapper}>
                <CheckCircle2 size={48} className={styles.successIcon} />
              </div>
              <h2>WhatsApp Conectado!</h2>
              <p>O seu agente de IA agora pode gerenciar contatos e responder mensagens em tempo real.</p>
              
              <div className={styles.detailsList}>
                <div className={styles.detailItem}>
                  <span>Status:</span>
                  <strong style={{ color: 'var(--accent-success)' }}>Operacional</strong>
                </div>
                <div className={styles.detailItem}>
                  <span>Instância:</span>
                  <strong>{manualConfig?.instanceName || institution?.evolution_instance_name}</strong>
                </div>
              </div>

              <div className={styles.actions}>
                <button className="custom-button secondary" onClick={() => checkStatus(manualConfig?.instanceName || institution?.evolution_instance_name)}>
                  <RefreshCw size={18} /> Atualizar Status
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.connectView}>
              <div className={styles.qrWrapper}>
                {qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className={styles.qrImage} />
                ) : (
                  <div className={styles.qrPlaceholder}>
                    <QrCode size={64} className={styles.emptyIcon} />
                    {generating && <div className={styles.qrLoader}><Loader2 className="animate-spin" /></div>}
                  </div>
                )}
              </div>

              <h3>Pronto para conectar?</h3>
              <p>Clique abaixo para gerar o QR Code e parear seu WhatsApp Business com a plataforma.</p>
              
              <button
                className="custom-button secondary"
                onClick={handleGenerateQR}
                disabled={generating}
                style={{ marginTop: '1.5rem', minWidth: '220px' }}
              >
                {generating ? <Loader2 className="animate-spin" size={18} /> : (qrCode ? <><RefreshCw size={18} /> Novo QR Code</> : <><Zap size={18} /> Gerar Nova Conexão</>)}
              </button>
            </div>
          )}
        </div>

        <aside className={styles.infoBoard}>
          <div className={`glass-panel ${styles.infoCard}`}>
            <h3>Como conectar?</h3>
            <ol className={styles.steps}>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em <strong>Aparelhos conectados</strong></li>
              <li>Clique em <strong>Conectar um aparelho</strong></li>
              <li>Aponte a câmera para o QR Code ao lado</li>
            </ol>
          </div>

          <div className={`glass-panel ${styles.settingsCard}`} style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', marginBottom: '1rem' }}>
              <ShieldCheck size={18} /> Configurações Técnicas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Instância</label>
                <input 
                  type="text"
                  value={settings.evolution_instance_name}
                  onChange={(e) => setSettings({...settings, evolution_instance_name: e.target.value})}
                  placeholder="Nome da instância"
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>API API Key</label>
                <input 
                  type="password"
                  value={settings.evolution_api_key}
                  onChange={(e) => setSettings({...settings, evolution_api_key: e.target.value})}
                  placeholder="Seu Token Evolution"
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  className="custom-button" 
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  style={{ flex: 1, padding: '0.65rem', fontSize: '0.875rem' }}
                >
                  {savingSettings ? <Loader2 className="animate-spin" size={16} /> : 'Salvar'}
                </button>
                <button 
                  className="custom-button secondary" 
                  onClick={async () => {
                    if (confirm('Deseja realmente desconectar esta instância do WhatsApp?')) {
                      setGenerating(true);
                      try {
                        const instanceName = manualConfig?.instanceName || institution?.evolution_instance_name;
                        await fetch('/api/evolution', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ instanceName, action: 'disconnect' }),
                        });
                        setConnectionStatus('none');
                        setQrCode(null);
                        addNotification({ type: 'success', title: 'Desconectado', message: 'Instância desconectada com sucesso.' });
                      } catch (err: any) {
                        addNotification({ type: 'error', title: 'Erro', message: 'Falha ao desconectar.' });
                      } finally {
                        setGenerating(false);
                      }
                    }
                  }}
                  disabled={generating}
                  style={{ flex: 1, padding: '0.65rem', fontSize: '0.875rem', borderColor: 'rgba(255,0,0,0.3)', color: '#ff4444' }}
                >
                  Desconectar
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
