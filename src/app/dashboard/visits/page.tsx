'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Plus, Loader2, CheckCircle, XCircle, AlertCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Visit {
  id: string;
  lead_name: string;
  lead_phone?: string;
  scheduled_at: string;
  status: string;
  notes?: string;
  leads?: { name: string; phone: string };
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: 'Agendada', color: '#06b6d4', icon: Clock },
  confirmed: { label: 'Confirmada', color: '#10b981', icon: CheckCircle },
  done: { label: 'Realizada', color: '#6366f1', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: '#ef4444', icon: XCircle },
  no_show: { label: 'Não compareceu', color: '#94a3b8', icon: AlertCircle },
};

export default function VisitsPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    lead_name: '', lead_phone: '', scheduled_at: '', notes: '', lead_id: '',
  });
  const [leads, setLeads] = useState<any[]>([]);
  const [leadSearch, setLeadSearch] = useState('');

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/visits?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisits(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchVisits();
    // Carrega leads para o formulário
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('institution_id').eq('id', user!.id).single();
      const { data } = await supabase.from('leads').select('id, name, phone').eq('institution_id', profile!.institution_id).order('name');
      setLeads(data || []);
    })();
  }, [fetchVisits]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/visits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status }),
    });
    fetchVisits();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lead_name || !form.scheduled_at) { setError('Nome e data são obrigatórios.'); return; }
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...form, lead_id: form.lead_id || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNewForm(false);
      setForm({ lead_name: '', lead_phone: '', scheduled_at: '', notes: '', lead_id: '' });
      fetchVisits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredLeads = leadSearch
    ? leads.filter(l => l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.phone?.includes(leadSearch))
    : [];

  const grouped = visits.reduce((acc, v) => {
    const date = new Date(v.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(v);
    return acc;
  }, {} as Record<string, Visit[]>);

  const inp = {
    width: '100%', padding: '0.65rem 0.875rem',
    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' as const,
  };
  const lbl = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.35rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Agendamentos de Visita</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {visits.length} visita(s) registrada(s).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select id="filter-visit-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '0.65rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_MAP).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
          <button id="btn-new-visit" onClick={() => setShowNewForm(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}
          >
            <Plus size={18} /> Nova Visita
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.875rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {/* Formulário de nova visita */}
      {showNewForm && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Agendar Nova Visita</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
              <label style={lbl}>Buscar Lead Existente</label>
              <input
                id="visit-lead-search"
                value={form.lead_id ? leads.find(l => l.id === form.lead_id)?.name || '' : leadSearch}
                onChange={e => { setLeadSearch(e.target.value); set('lead_id', ''); set('lead_name', e.target.value); }}
                placeholder="Buscar por nome ou telefone..."
                style={inp}
              />
              {filteredLeads.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, maxHeight: '160px', overflowY: 'auto' }}>
                  {filteredLeads.slice(0, 6).map(lead => (
                    <button key={lead.id} type="button" onClick={() => { set('lead_id', lead.id); set('lead_name', lead.name || ''); set('lead_phone', lead.phone || ''); setLeadSearch(''); }}
                      style={{ width: '100%', padding: '0.65rem 1rem', textAlign: 'left', display: 'flex', gap: '0.75rem', background: 'none', border: 'none', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                    >
                      <span style={{ fontWeight: 600 }}>{lead.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{lead.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>Nome do Visitante *</label>
              <input id="visit-name" style={inp} value={form.lead_name} onChange={e => set('lead_name', e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label style={lbl}>Telefone</label>
              <input id="visit-phone" style={inp} value={form.lead_phone} onChange={e => set('lead_phone', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label style={lbl}>Data e Hora *</label>
              <input id="visit-datetime" type="datetime-local" style={inp} value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Observações</label>
              <input id="visit-notes" style={inp} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Interesse no curso X, veio por indicação..." />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
              <button type="button" onClick={() => setShowNewForm(false)} style={{ padding: '0.65rem 1.25rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" id="btn-save-visit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : <><CalendarDays size={16} /> Agendar</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de visitas agrupadas por data */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={36} /></div>
      ) : visits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <CalendarDays size={52} style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Nenhuma visita agendada</h3>
          <p>Agende a primeira visita para um lead interessado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(grouped).map(([date, dayVisits]) => (
            <div key={date}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
                {date}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {dayVisits.map(visit => {
                  const st = STATUS_MAP[visit.status] || STATUS_MAP.scheduled;
                  const StIcon = st.icon;
                  const time = new Date(visit.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={visit.id} id={`visit-${visit.id}`} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderLeft: `3px solid ${st.color}`, borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ minWidth: '52px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{time}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{visit.lead_name}</div>
                        {visit.lead_phone && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{visit.lead_phone}</div>}
                        {visit.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' }}>{visit.notes}</div>}
                      </div>
                      <select
                        value={visit.status}
                        onChange={e => updateStatus(visit.id, e.target.value)}
                        style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}40`, borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                      >
                        {Object.entries(STATUS_MAP).map(([value, meta]) => (
                          <option key={value} value={value}>{meta.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
