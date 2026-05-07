'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Search, Edit2, Trash2, Tag } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Promotion {
  id: string;
  name: string;
  description: string;
  discount_percentage: number | null;
  discount_value: number | null;
  is_active: boolean;
  valid_until: string | null;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_percentage: '',
    discount_value: '',
    is_active: true,
    valid_until: ''
  });

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/promotions?active=false', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPromotions(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromotions(); }, [fetchPromotions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        name: formData.name,
        description: formData.description,
        discount_percentage: formData.discount_percentage ? Number(formData.discount_percentage) : null,
        discount_value: formData.discount_value ? Number(formData.discount_value) : null,
        is_active: formData.is_active,
        valid_until: formData.valid_until || null
      };

      const url = editingId ? `/api/promotions/${editingId}` : '/api/promotions';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Erro ao salvar promoção');
      
      setIsModalOpen(false);
      fetchPromotions();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar promoção');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta promoção?')) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/promotions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      fetchPromotions();
    } catch (error) {
      console.error(error);
    }
  };

  const openEdit = (promo: Promotion) => {
    setFormData({
      name: promo.name,
      description: promo.description || '',
      discount_percentage: promo.discount_percentage?.toString() || '',
      discount_value: promo.discount_value?.toString() || '',
      is_active: promo.is_active,
      valid_until: promo.valid_until ? promo.valid_until.split('T')[0] : ''
    });
    setEditingId(promo.id);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setFormData({ name: '', description: '', discount_percentage: '', discount_value: '', is_active: true, valid_until: '' });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const filtered = search
    ? promotions.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : promotions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Promoções e Descontos</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Gerencie campanhas e cupons disponíveis para o agente de IA.
          </p>
        </div>
        <button
          onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <Plus size={18} /> Nova Promoção
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          placeholder="Buscar promoção..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.65rem 0.875rem 0.65rem 2.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={36} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <Tag size={48} style={{ margin: '0 auto 1rem' }} />
          <p>Nenhuma promoção encontrada.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                {['Nome', 'Desconto', 'Validade', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {p.discount_percentage ? `${p.discount_percentage}%` : p.discount_value ? `R$ ${p.discount_value}` : '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {p.valid_until ? new Date(p.valid_until).toLocaleDateString('pt-BR') : 'Sem validade'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.28rem 0.65rem', borderRadius: '999px', background: p.is_active ? '#10b9811a' : '#ef44441a', color: p.is_active ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {p.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(p)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', border: '1px solid var(--glass-border)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editingId ? 'Editar' : 'Nova'} Promoção</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Nome da Promoção *</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Descrição</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Desconto (%)</label>
                  <input type="number" step="0.01" value={formData.discount_percentage} onChange={e => setFormData({ ...formData, discount_percentage: e.target.value })} style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Desconto (R$)</label>
                  <input type="number" step="0.01" value={formData.discount_value} onChange={e => setFormData({ ...formData, discount_value: e.target.value })} style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Válido até</label>
                  <input type="date" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                  <label style={{ fontSize: '0.875rem' }}>Ativo</label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.65rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: '6px', color: 'var(--text-primary)' }}>Cancelar</button>
                <button type="submit" style={{ padding: '0.65rem 1.25rem', background: 'var(--accent-primary)', borderRadius: '6px', color: '#fff', fontWeight: 600 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
