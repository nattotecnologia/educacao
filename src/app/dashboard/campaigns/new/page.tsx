'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotification } from '@/contexts/NotificationContext';
import { ArrowLeft, Send, Save, Loader2, Users, Megaphone, ShieldAlert, Clock } from 'lucide-react';
import Link from 'next/link';
import styles from '../Campaigns.module.css';
import { createCampaign, getActivePromotions, getLeadsForCampaign, getCampaignById, updateCampaign } from '../actions';

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { addNotification } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [promotions, setPromotions] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  
  const [name, setName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Olá {nome}! Temos uma novidade para você:');
  const [targetType, setTargetType] = useState<'all' | 'custom'>('all');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [promotionId, setPromotionId] = useState<string>('');
  
  const [batchSize, setBatchSize] = useState(20);
  const [delaySecs, setDelaySecs] = useState(60); // 1 minuto entre lotes (representa na verdade só a configuração visual, pois o batch roda a cada execução do cron)
  const [messageDelay, setMessageDelay] = useState(2); // 2 segundos entre mensagens individuais
  
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [promos, leadsData] = await Promise.all([
          getActivePromotions(),
          getLeadsForCampaign()
        ]);
        setPromotions(promos || []);
        setLeads(leadsData || []);

        if (editId) {
          const campaignData = await getCampaignById(editId);
          if (campaignData) {
            setName(campaignData.name || '');
            setMessageTemplate(campaignData.message_template || '');
            setTargetType(campaignData.target_audience?.type || 'all');
            setSelectedLeads(campaignData.target_audience?.lead_ids || []);
            setPromotionId(campaignData.promotion_id || '');
            setBatchSize(campaignData.batch_size || 20);
            setMessageDelay((campaignData.delay_ms || 2000) / 1000);
            
            if (campaignData.scheduled_at) {
              setScheduleType('later');
              // Formata pra o datetime-local
              const date = new Date(campaignData.scheduled_at);
              const pad = (n:number) => n.toString().padStart(2, '0');
              const formatted = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
              setScheduledAt(formatted);
            }
          }
        }
      } catch (err) {
        addNotification({ type: 'error', title: 'Erro', message: 'Falha ao carregar dados' });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [addNotification, editId]);

  const handleToggleLead = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(l => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return addNotification({ type: 'error', title: 'Atenção', message: 'Dê um nome à campanha' });
    if (!messageTemplate.trim()) return addNotification({ type: 'error', title: 'Atenção', message: 'Escreva a mensagem' });
    if (targetType === 'custom' && selectedLeads.length === 0) return addNotification({ type: 'error', title: 'Atenção', message: 'Selecione pelo menos um lead' });

    let finalSchedule = null;
    if (scheduleType === 'later') {
      if (!scheduledAt) return addNotification({ type: 'error', title: 'Atenção', message: 'Selecione a data e hora do agendamento' });
      finalSchedule = new Date(scheduledAt).toISOString();
    }

    setSaving(true);
    try {
      const payload = {
        name,
        message_template: messageTemplate,
        promotion_id: promotionId || null,
        target_audience: targetType === 'all' ? { type: 'all' } : { type: 'custom', lead_ids: selectedLeads },
        batch_size: batchSize,
        delay_ms: messageDelay * 1000,
        scheduled_at: finalSchedule
      };

      if (editId) {
        await updateCampaign(editId, payload);
        addNotification({ type: 'success', title: 'Atualizada', message: 'Campanha atualizada com sucesso.' });
      } else {
        await createCampaign(payload);
        addNotification({ type: 'success', title: 'Sucesso', message: scheduleType === 'now' ? 'Campanha iniciada!' : 'Campanha agendada!' });
      }
      
      router.push('/dashboard/campaigns');
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Erro', message: err.message || 'Falha ao salvar campanha' });
      setSaving(false);
    }
  };

  const mockupText = useMemo(() => {
    let text = messageTemplate.replace(/{nome}/gi, 'João da Silva');
    if (promotionId) {
      const promo = promotions.find(p => p.id === promotionId);
      if (promo) {
         text += `\n\n*${promo.name}*\n${promo.description || ''}`;
      }
    }
    return text;
  }, [messageTemplate, promotionId, promotions]);

  if (loading) {
    return <div className={styles.loadingContainer}><Loader2 className="animate-spin" size={40} /></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard/campaigns" className={styles.title} style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
            <ArrowLeft size={18} /> Voltar
          </Link>
          <h1 className={styles.title} style={{ marginTop: '0.5rem' }}>
            <Megaphone size={28} /> {editId ? 'Editar Campanha' : 'Nova Campanha'}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSave} className={styles.builderLayout}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className={styles.formCard}>
            <h2 className={styles.sectionTitle}>Detalhes da Campanha</h2>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Nome Interno da Campanha</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className={styles.input} 
                placeholder="Ex: Black Friday 2026 - Lote 1"
              />
            </div>
          </div>

          <div className={styles.formCard}>
            <h2 className={styles.sectionTitle}>Público Alvo</h2>
            
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input type="radio" checked={targetType === 'all'} onChange={() => setTargetType('all')} />
                Todos os Leads da Base ({leads.length} leads)
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" checked={targetType === 'custom'} onChange={() => setTargetType('custom')} />
                Selecionar Leads Específicos
              </label>
            </div>

            {targetType === 'custom' && (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                {leads.map(lead => (
                  <label key={lead.id} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => handleToggleLead(lead.id)}
                    />
                    <span style={{ fontSize: '0.9rem' }}>{lead.name} ({lead.phone})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formCard}>
            <h2 className={styles.sectionTitle}>Mensagem e Promoção</h2>
            
            <div className={styles.inputGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className={styles.label}>Promoção Ativa (Opcional)</label>
                <Link href="/dashboard/promotions" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                  + Nova Promoção
                </Link>
              </div>
              <select value={promotionId} onChange={e => setPromotionId(e.target.value)} className={styles.input}>
                <option value="">Nenhuma promoção vinculada</option>
                {promotions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Texto da Mensagem</label>
              <textarea 
                value={messageTemplate} 
                onChange={e => setMessageTemplate(e.target.value)} 
                className={styles.input}
                style={{ minHeight: '120px', resize: 'vertical' }}
              />
              <span className={styles.hint}>Use <code>{'{nome}'}</code> para o nome do lead. Use asteriscos para *negrito*.</span>
            </div>
          </div>

          <div className={styles.formCard}>
            <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} style={{color: 'var(--accent-primary)'}} /> Prevenção de Bloqueio (Anti-Spam)
            </h2>
            <p className={styles.hint} style={{marginBottom: '1rem'}}>
              O WhatsApp pode bloquear números que enviam milhares de mensagens de uma vez. O sistema envia as mensagens em pequenos lotes ao longo do tempo.
            </p>

            <div className={styles.grid2}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Tamanho do Lote</label>
                <input 
                  type="number" 
                  min="1" max="100" 
                  value={batchSize} 
                  onChange={e => setBatchSize(parseInt(e.target.value)||20)} 
                  className={styles.input} 
                />
                <span className={styles.hint}>Mensagens enviadas por minuto. (Recomendado: 20)</span>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Pausa individual (segundos)</label>
                <input 
                  type="number" 
                  min="1" max="10" 
                  value={messageDelay} 
                  onChange={e => setMessageDelay(parseInt(e.target.value)||2)} 
                  className={styles.input} 
                />
                <span className={styles.hint}>Tempo entre cada mensagem do lote.</span>
              </div>
            </div>
          </div>

          <div className={styles.formCard}>
            <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} /> Agendamento
            </h2>
            
            <div className={styles.radioGroup} style={{marginBottom: '1rem'}}>
              <label className={styles.radioLabel}>
                <input type="radio" checked={scheduleType === 'now'} onChange={() => setScheduleType('now')} />
                Iniciar agora (Assim que o cron rodar)
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" checked={scheduleType === 'later'} onChange={() => setScheduleType('later')} />
                Agendar para data e hora
              </label>
            </div>

            {scheduleType === 'later' && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Data e Hora do Disparo</label>
                <input 
                  type="datetime-local" 
                  value={scheduledAt} 
                  onChange={e => setScheduledAt(e.target.value)} 
                  className={styles.input} 
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => router.back()} className={styles.secondaryBtn} disabled={saving}>Cancelar</button>
            <button type="submit" className={styles.primaryBtn} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <Loader2 className="animate-spin" size={18} /> : scheduleType === 'now' ? <><Send size={18} /> Enviar Campanha</> : <><Save size={18} /> Agendar Campanha</>}
            </button>
          </div>

        </div>

        {/* Mockup Preview Lateral */}
        <div className={styles.mockupContainer}>
          <div className={styles.phoneMockup}>
            <div className={styles.phoneHeader}>
              <div className={styles.phoneAvatar}>
                <Users size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.95rem' }}>Nome da Instituição</span>
                <span style={{ fontSize: '0.7rem', color: '#8696a0' }}>Conta comercial</span>
              </div>
            </div>
            
            <div className={styles.phoneBody}>
              {/* Formatação para WhatsApp no frontend (negrito e quebra de linha) */}
              <div className={styles.bubble}>
                {mockupText.split('\n').map((line, i) => (
                  <span key={i}>
                    {line.split(/(\*.*?\*)/).map((part, j) => {
                      if (part.startsWith('*') && part.endsWith('*')) {
                        return <strong key={j}>{part.slice(1, -1)}</strong>;
                      }
                      return part;
                    })}
                    <br />
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.phoneFooter}>
              <div className={styles.phoneInput}></div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
