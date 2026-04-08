'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { messageService, leadService } from '@/services';
import { 
  Search, User, Bot, UserCog, Send, Loader2, MessageSquare, ArrowLeft
} from 'lucide-react';
import styles from './Chat.module.css';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function ChatPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Função de Busca de Leads MEMOIZADA para o Realtime
  const fetchLeads = useCallback(async () => {
    try {
      const { data } = await leadService.getFiltered({ search: debouncedSearch, pageSize: 50 });
      setLeads(data);
    } catch (err) {
      console.error('Erro ao buscar leads', err);
    } finally {
      setLoadingLeads(false);
    }
  }, [debouncedSearch]);

  // Busca Leads inicial e ao mudar busca
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Inscrição em Tempo Real para a LISTA de LEADS (Barra Lateral)
  useEffect(() => {
    let channel: any;

    const setupRealtimeLeads = async () => {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      
      const channelId = `chat_sidebar_${Math.random().toString(36).substring(7)}`;
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leads' },
          (payload) => {
            console.log('Lead atualizado/inserido, recarregando lista...', payload);
            fetchLeads();
          }
        )
        .subscribe();
    };

    setupRealtimeLeads();

    return () => {
      if (channel) {
        import('@/utils/supabase/client').then(m => {
          const supabase = m.createClient();
          supabase.removeChannel(channel);
        });
      }
    };
  }, [fetchLeads]);

  // SSE para mensagens em tempo real
  useEffect(() => {
    if (!selectedLead) return;

    const connectSSE = async () => {
      const supabase = await import('@/utils/supabase/client').then(m => m.createClient());
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setLoadingMessages(true);

      try {
        const initialMessages = await messageService.getMessages(selectedLead.id);
        setMessages(initialMessages);
      } catch (err) {
        console.error('Erro ao buscar mensagens iniciais', err);
      } finally {
        setLoadingMessages(false);
      }

      const eventSource = new EventSource(`/api/chat/stream?leadId=${selectedLead.id}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('message', (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'messages' && parsed.data) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = parsed.data.filter((m: any) => !existingIds.has(m.id));
              return [...prev, ...newMsgs];
            });
          }
        } catch (err) {
          console.error('Erro ao processar evento SSE', err);
        }
      });

      eventSource.onerror = () => {
        console.warn('SSE connection error, retrying...');
        eventSource.close();
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [selectedLead]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !selectedLead) return;

    setSending(true);
    try {
      const novaMensagem = await messageService.sendMessage(selectedLead.id, draft);
      setMessages(prev => [...prev, novaMensagem]);
      setDraft('');
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const toggleHandoff = async () => {
    if (!selectedLead) return;
    const newStatus = selectedLead.status === 'human_handling' ? 'ai_handling' : 'human_handling';
    try {
      const updated = await leadService.updateStatus(selectedLead.id, newStatus);
      setSelectedLead(updated);
      setLeads(leads.map(l => l.id === updated.id ? updated : l));
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'human_handling') return 'var(--accent-warning)';
    if (status === 'ai_handling') return 'var(--accent-secondary)';
    return 'var(--text-muted)';
  };

  return (
    <div className={`${styles.container} ${selectedLead ? styles.showChat : styles.showSidebar}`}>
      {/* SIDEBAR: Lista de Leads */}
      <div className={`glass-panel ${styles.sidebar}`}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.title}>Atendimentos</h2>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Buscar lead..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className={styles.leadsList}>
          {loadingLeads ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <Loader2 className="animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : leads.map(lead => (
            <div 
              key={lead.id} 
              className={`${styles.leadItem} ${selectedLead?.id === lead.id ? styles.leadItemActive : ''}`}
              onClick={() => setSelectedLead(lead)}
            >
              <div className={styles.leadAvatar}>
                <User size={20} />
              </div>
              <div className={styles.leadInfo}>
                <span className={styles.leadName}>{lead.name || 'Sem Nome'}</span>
                <span className={styles.leadPhone}>{lead.phone}</span>
              </div>
              <div 
                className={styles.statusIndicator} 
                style={{ background: getStatusColor(lead.status) }}
                title={lead.status === 'human_handling' ? 'Atendimento Humano' : 'IA Atendendo'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className={`glass-panel ${styles.chatArea}`}>
        {selectedLead ? (
          <>
            <div className={styles.chatHeader}>
              <button 
                className={styles.backBtn}
                onClick={() => setSelectedLead(null)}
                title="Voltar para lista"
              >
                <ArrowLeft size={20} />
              </button>
              
              <div className={styles.chatHeaderInfo}>
                <div className={styles.leadAvatar}>
                  <User size={20} />
                </div>
                <div>
                  <div className={styles.headerName}>{selectedLead.name || selectedLead.phone}</div>
                  <div className={styles.headerStatus}>
                    {selectedLead.status === 'human_handling' ? (
                       <><UserCog size={12} color="var(--accent-warning)" /> Humano assumiu</>
                    ) : (
                       <><Bot size={12} color="var(--accent-secondary)" /> IA atendendo</>
                    )}
                  </div>
                </div>
              </div>

              <button 
                className={`${styles.actionBtn} ${selectedLead.status === 'human_handling' ? styles.ai : styles.human}`}
                onClick={toggleHandoff}
              >
                {selectedLead.status === 'human_handling' ? (
                  <><Bot size={16} /> Devolver para IA</>
                ) : (
                  <><UserCog size={16} /> Assumir Conversa</>
                )}
              </button>
            </div>

            <div className={styles.messagesList}>
               {loadingMessages ? (
                 <Loader2 className="animate-spin" style={{ margin: 'auto' }} />
               ) : messages.length === 0 ? (
                 <div className={styles.emptyState}>
                   <MessageSquare size={32} opacity={0.5} />
                   <p>Nenhuma mensagem ainda.</p>
                 </div>
               ) : messages.map((msg) => (
                 <div 
                   key={msg.id} 
                   className={`${styles.messageBubble} ${
                     msg.direction === 'inbound' ? styles.messageInbound :
                     msg.direction === 'outbound_ai' ? styles.messageOutboundAi : 
                     styles.messageOutboundHuman
                   }`}
                 >
                   <div>{msg.content}</div>
                   <span className={styles.messageTime}>
                     {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                     {msg.direction === 'outbound_ai' && ' • IA'}
                     {msg.direction === 'outbound_human' && ' • Você'}
                   </span>
                 </div>
               ))}
               <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
              <form onSubmit={handleSend} className={styles.inputForm}>
                <textarea 
                  className={styles.messageInput} 
                  placeholder={selectedLead.status === 'human_handling' 
                    ? "Digite sua mensagem..." 
                    : "Você precisa 'Assumir Conversa' para enviar mensagens"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  disabled={selectedLead.status !== 'human_handling'}
                />
                <button 
                  type="submit" 
                  className={styles.sendBtn}
                  disabled={selectedLead.status !== 'human_handling' || !draft.trim() || sending}
                >
                  {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <MessageSquare size={64} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <h2>Selecione um atendimento</h2>
            <p>Escolha um lead na barra lateral para ver o histórico e responder.</p>
          </div>
        )}
      </div>
    </div>
  );
}
