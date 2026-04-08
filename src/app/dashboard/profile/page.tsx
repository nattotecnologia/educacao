'use client';

import { useState, useEffect } from 'react';
import { User, Upload, Save, Loader2, Mail } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';
import { createClient } from '@/utils/supabase/client';
import styles from './Profile.module.css';

export default function ProfilePage() {
  const supabase = createClient();
  const { addNotification } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ id: string; full_name: string; avatar_url: string; email: string }>({
    id: '',
    full_name: '',
    avatar_url: '',
    email: '',
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: pData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setProfile({
          id: user.id,
          full_name: pData?.full_name || '',
          avatar_url: pData?.avatar_url || '',
          email: user.email || '',
        });
      } catch (err: any) {
        console.error('Erro ao carregar perfil:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
        })
        .eq('id', profile.id);

      if (error) throw error;

      addNotification({ type: 'success', title: 'Perfil Atualizado', message: 'Suas informações foram salvas com sucesso.' });
    } catch (err: any) {
      console.error(err);
      addNotification({ type: 'error', title: 'Erro ao Salvar', message: err.message || 'Falha ao atualizar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Tenta fazer o upload para o Storage (se o bucket existir e permitir)
      // Se falhar porque não configuramos o bucket de avatars, daremos um mock para fins visuais
      const { error: uploadError } = await supabase.storage
        .from('brand-assets') // Usando o mesmo bucket por hora
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('brand-assets').getPublicUrl(filePath);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: data.publicUrl }));
      addNotification({ type: 'success', title: 'Foto Atualizada', message: 'Seu avatar foi salvo.' });
    } catch (err: any) {
      console.error('Upload error:', err);
      addNotification({ type: 'warning', title: 'Aviso de Upload', message: 'Não foi possível salvar na nuvem. Verifique as permissões de Storage.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>MY PROFILE</h1>
        <p className={styles.subtitle}>Gerencie sua identidade e credenciais de acesso.</p>
      </header>

      <form onSubmit={handleSave} className={styles.glassCard}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarWrapper}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className={styles.avatarImage} />
            ) : (
              <User size={48} color="var(--text-secondary)" />
            )}
          </div>
          <div className={styles.uploadActions}>
            <label className={styles.uploadButton}>
              <Upload size={16} />
              Trocar Imagem
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarUpload} 
                style={{ display: 'none' }} 
                disabled={saving}
              />
            </label>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Nome Completo</label>
          <input 
            type="text" 
            className={styles.input} 
            value={profile.full_name} 
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            placeholder="Seu nome"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Endereço de E-mail (Leitura)</label>
          <input 
            type="email" 
            className={styles.input} 
            value={profile.email} 
            disabled
          />
        </div>

        <button type="submit" className={styles.saveButton} disabled={saving}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </form>
    </div>
  );
}
