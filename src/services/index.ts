import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

export const authService = {
  async getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não logado');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) throw error;
    return data;
  },
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  }
};

export const leadService = {
  async getAll() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getFiltered({
    search = '',
    status = '',
    page = 1,
    pageSize = 20,
    orderBy = 'updated_at',
    orderDirection = 'desc'
  }: { 
    search?: string; 
    status?: string; 
    page?: number; 
    pageSize?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }) {
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], total: count || 0 };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async create(leadPartial: any) {
    const profile = await authService.getProfile();
    const payload = {
      ...leadPartial,
      institution_id: profile.institution_id
    };
    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    // Apaga apenas o histórico de mensagens do lead
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('lead_id', id);
    if (error) throw error;
    return true;
  },

  async deleteMany(ids: string[]) {
    // Apaga o histórico de mensagens de vários leads
    const { error } = await supabase
      .from('messages')
      .delete()
      .in('lead_id', ids);
    if (error) throw error;
    return true;
  },

  async deleteAll() {
    const profile = await authService.getProfile();
    const instId = profile.institution_id;

    // Busca os IDs dos leads da instituição para limpar apenas as mensagens deles
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('institution_id', instId);
    
    if (leads && leads.length > 0) {
      const ids = leads.map(l => l.id);
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('lead_id', ids);
      if (error) throw error;
    }
    return true;
  }
};

export type AgentRole = 'reception' | 'sdr' | 'followup' | 'support' | 'custom';
export type CommunicationStyle = 'default' | 'whatsapp' | 'casual' | 'formal';

export interface AgentPayload {
  name: string;
  system_prompt: string;
  status: 'active' | 'inactive' | 'training';
  agent_role?: AgentRole;
  communication_style?: CommunicationStyle;
  temperature?: number;
  max_tokens?: number;
  ai_model_override?: string;
  enable_line_breaks?: boolean;
  response_delay_ms?: number;
  max_history_messages?: number;
  greeting_message?: string;
  fallback_message?: string;
  is_default?: boolean;
}

export const agentService = {
  async getAll() {
    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(agentPartial: AgentPayload) {
    const profile = await authService.getProfile();
    const payload = {
      ...agentPartial,
      institution_id: profile.institution_id,
    };

    const { data, error } = await supabase
      .from('ai_agents')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, payload: Partial<AgentPayload>) {
    const { data, error } = await supabase
      .from('ai_agents')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('ai_agents').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { data, error } = await supabase
      .from('ai_agents')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async setDefault(id: string) {
    const { data, error } = await supabase
      .from('ai_agents')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const messageService = {
  async getMessages(leadId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async sendMessage(leadId: string, content: string) {
    const response = await fetch('/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leadId, content }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao enviar mensagem');
    }

    const { message } = await response.json();
    return message;
  }
};

export const pipelineService = {
  async getPipelines() {
    const profile = await authService.getProfile();
    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .eq('institution_id', profile.institution_id)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getStages(pipelineId: string) {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('order', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createPipeline(name: string) {
    const profile = await authService.getProfile();
    const { data, error } = await supabase
      .from('pipelines')
      .insert({ name, institution_id: profile.institution_id })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createStage(pipelineId: string, name: string, order: number, color: string = '#3b82f6') {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .insert({ pipeline_id: pipelineId, name, order, color })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async moveLead(leadId: string, stageId: string, stageOrder: number) {
    const { data, error } = await supabase
      .from('leads')
      .update({ stage_id: stageId, stage_order: stageOrder })
      .eq('id', leadId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async updateStage(stageId: string, payload: { name?: string; color?: string; order?: number }) {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .update(payload)
      .eq('id', stageId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteStage(stageId: string) {
    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', stageId);
    
    if (error) throw error;
    return true;
  }
};


