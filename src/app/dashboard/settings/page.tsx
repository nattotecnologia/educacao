'use client';

import { useState, useEffect } from 'react';
import { 
  Globe, Loader2, Save, 
  Palette, Upload, Moon, Sun,
  Clock, Calendar, Trash2, Plus
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNotification } from '@/contexts/NotificationContext';
import styles from './Settings.module.css';
import { createClient } from '@/utils/supabase/client';
import { getInstitutionSettings, updateInstitutionSettings, getPlatformSettings, updatePlatformSettings } from './actions';

export default function SettingsPage() {
  const { addNotification } = useNotification();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'geral' | 'horarios' | 'whitelabel'>('geral');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [institution, setInstitution] = useState<any>(null);
  const [platform, setPlatform] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    async function fetchData() {
      try {
        const [instData, platData] = await Promise.all([
          getInstitutionSettings(),
          getPlatformSettings(),
        ]);
        if (instData) {
          setInstitution({
            ...instData,
            business_hours: instData.business_hours || [
              {"day": 0, "isOpen": false, "open": "08:00", "close": "18:00"},
              {"day": 1, "isOpen": true,  "open": "08:00", "close": "18:00"},
              {"day": 2, "isOpen": true,  "open": "08:00", "close": "18:00"},
              {"day": 3, "isOpen": true,  "open": "08:00", "close": "18:00"},
              {"day": 4, "isOpen": true,  "open": "08:00", "close": "18:00"},
              {"day": 5, "isOpen": true,  "open": "08:00", "close": "18:00"},
              {"day": 6, "isOpen": false, "open": "08:00", "close": "12:00"}
            ],
            closed_days: instData.closed_days || []
          });
        }
        if (platData) {
          setPlatform(platData);
          document.documentElement.style.setProperty('--accent-primary', platData.primary_color || '#3b82f6');
        }
      } catch (err: any) {
        addNotification({ type: 'error', title: 'Erro', message: 'Falha ao carregar configurações.' });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [addNotification]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (activeTab === 'whitelabel') {
        await updatePlatformSettings(platform);
        document.documentElement.style.setProperty('--accent-primary', platform.primary_color);
      } else {
        await updateInstitutionSettings(institution);
      }
      addNotification({ type: 'success', title: 'Salvo', message: 'Configurações atualizadas com sucesso.' });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Erro', message: err.message || 'Falha ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'light' | 'dark' | 'fav_light' | 'fav_dark') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `brand-${mode}-${Math.random()}.${fileExt}`;
      const filePath = `platform/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('brand-assets').getPublicUrl(filePath);
      
      const keyMap: any = {
        'light': 'logo_light_url',
        'dark': 'logo_dark_url',
        'fav_light': 'favicon_light_url',
        'fav_dark': 'favicon_dark_url'
      };

      setPlatform((prev: any) => ({
        ...prev,
        [keyMap[mode]]: data.publicUrl
      }));

      addNotification({ type: 'success', title: 'Asset Atualizado', message: `Asset ${mode} carregado para pre-visualização.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Upload Falhou', message: 'Não foi possível fazer o upload da imagem.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !mounted) {
    return <div className={styles.loadingContainer}><Loader2 className="animate-spin" size={40} /></div>;
  }

  if (!institution) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h3>Nenhuma instituição vinculada</h3>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className={styles.container}>
      <nav className={styles.sidebarNav}>
        <button type="button" onClick={() => setActiveTab('geral')} className={`${styles.navButton} ${activeTab === 'geral' ? styles.navButtonActive : ''}`}>
          <Globe size={18} /> Instituição
        </button>
        <button type="button" onClick={() => setActiveTab('horarios')} className={`${styles.navButton} ${activeTab === 'horarios' ? styles.navButtonActive : ''}`}>
          <Clock size={18} /> Horários
        </button>
        <button type="button" onClick={() => setActiveTab('whitelabel')} className={`${styles.navButton} ${activeTab === 'whitelabel' ? styles.navButtonActive : ''}`}>
          <Palette size={18} /> Personalização
        </button>
        
        <button 
          type="button" 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
          className={styles.navButton}
          style={{ marginTop: '2rem' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}
        </button>
      </nav>

      <div className={styles.mainContent}>
        {activeTab === 'geral' && (
          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Dados da Instituição</h2>
              <p>Informações básicas e identificação nos relatórios.</p>
            </header>
            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Nome Oficial</label>
                <input 
                  type="text" 
                  value={institution.name || ''} 
                  onChange={(e) => setInstitution({...institution, name: e.target.value})}
                  className={styles.input} 
                />
              </div>
            </div>
          </section>
        )}

        {activeTab === 'whitelabel' && platform && (
          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>White-label Platform</h2>
              <p>Personalize a estética global do sistema. Aplicado inclusive na página de login e cadastro.</p>
            </header>

            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Cor Primária (Destaque)</label>
                <div className={styles.colorPickerGroup}>
                  <input 
                    type="color" 
                    value={platform.primary_color || '#3b82f6'} 
                    onChange={(e) => {
                      setPlatform({...platform, primary_color: e.target.value});
                      document.documentElement.style.setProperty('--accent-primary', e.target.value);
                    }}
                    className={styles.colorInput} 
                  />
                  <span>{platform.primary_color || '#3b82f6'}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                   {['#3b82f6', '#8b5cf6', '#10b981', '#f43f5e', '#f59e0b', '#000000'].map(preset => (
                     <button 
                       key={preset}
                       type="button"
                       style={{ width: '24px', height: '24px', borderRadius: '50%', background: preset, border: 'none', cursor: 'pointer', boxShadow: '0 0 0 1px var(--glass-border)' }}
                       onClick={() => {
                         setPlatform({...platform, primary_color: preset});
                         document.documentElement.style.setProperty('--accent-primary', preset);
                       }}
                       title={preset}
                     />
                   ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Logotipo Branco (Para Dark Mode)</label>
                  <div className={styles.uploadArea}>
                    {platform.logo_light_url ? <img src={platform.logo_light_url} alt="Logo Light" className={styles.logoPreview} /> : <span style={{ color: 'var(--text-muted)' }}>Sem Imagem</span>}
                    <label className={styles.primaryBtn} style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                      <Upload size={14} /> Fazer Upload
                      <input type="file" accept="image/*" hidden onChange={(e) => handleLogoUpload(e, 'light')} disabled={saving} />
                    </label>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Logotipo Escuro (Para Light Mode)</label>
                  <div className={styles.uploadArea} style={{ background: 'var(--text-primary)', borderColor: 'var(--bg-primary)' }}>
                    {platform.logo_dark_url ? <img src={platform.logo_dark_url} alt="Logo Dark" className={styles.logoPreview} /> : <span style={{ color: 'var(--bg-primary)' }}>Sem Imagem</span>}
                    <label className={styles.primaryBtn} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                      <Upload size={14} /> Fazer Upload
                      <input type="file" accept="image/*" hidden onChange={(e) => handleLogoUpload(e, 'dark')} disabled={saving} />
                    </label>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Favicon Light</label>
                  <div className={styles.uploadArea}>
                    {platform.favicon_light_url ? <img src={platform.favicon_light_url} alt="Favicon Light" className={styles.logoPreview} style={{maxWidth: '40px'}} /> : <span style={{ color: 'var(--text-muted)' }}>Favicon Vazio</span>}
                    <label className={styles.primaryBtn} style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                      <Upload size={14} /> Upload Favicon
                      <input type="file" accept="image/*" hidden onChange={(e) => handleLogoUpload(e, 'fav_light')} disabled={saving} />
                    </label>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Favicon Dark</label>
                  <div className={styles.uploadArea} style={{ background: 'var(--text-primary)', borderColor: 'var(--bg-primary)' }}>
                    {platform.favicon_dark_url ? <img src={platform.favicon_dark_url} alt="Favicon Dark" className={styles.logoPreview} style={{maxWidth: '40px'}} /> : <span style={{ color: 'var(--bg-primary)' }}>Favicon Vazio</span>}
                    <label className={styles.primaryBtn} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                      <Upload size={14} /> Upload Favicon
                      <input type="file" accept="image/*" hidden onChange={(e) => handleLogoUpload(e, 'fav_dark')} disabled={saving} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'horarios' && (
          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <div>
                <h2>Horário de Funcionamento</h2>
                <p>Configure os dias e horários que o agente IA considerará como abertos.</p>
              </div>
            </header>
            
            <div className={styles.hoursGrid}>
               {institution.business_hours?.map((bh: any, idx: number) => {
                 const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                 return (
                   <div 
                     key={idx} 
                     className={`${styles.hoursCard} ${!bh.isOpen ? styles.hoursCardInactive : ''}`}
                   >
                      <div className={styles.dayLabel}>{days[bh.day]}</div>
                      
                      <div 
                        className={styles.toggleWrapper}
                        onClick={() => {
                          const newHours = [...institution.business_hours];
                          newHours[idx].isOpen = !bh.isOpen;
                          setInstitution({...institution, business_hours: newHours});
                        }}
                      >
                        <div className={`${styles.customToggle} ${bh.isOpen ? styles.customToggleActive : ''}`}>
                          <div className={styles.toggleThumb} />
                        </div>
                        <span className={styles.toggleLabel}>
                          {bh.isOpen ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>

                      {bh.isOpen && (
                        <div className={styles.timeInputs}>
                          <input 
                            type="time" 
                            value={bh.open} 
                            onChange={(e) => {
                              const newHours = [...institution.business_hours];
                              newHours[idx].open = e.target.value;
                              setInstitution({...institution, business_hours: newHours});
                            }}
                            className={styles.input}
                            style={{ width: '120px' }}
                          />
                          <span className={styles.timeSeparator}>às</span>
                          <input 
                            type="time" 
                            value={bh.close} 
                            onChange={(e) => {
                              const newHours = [...institution.business_hours];
                              newHours[idx].close = e.target.value;
                              setInstitution({...institution, business_hours: newHours});
                            }}
                            className={styles.input}
                            style={{ width: '120px' }}
                          />
                        </div>
                      )}
                   </div>
                 )
               })}
            </div>

            <header className={styles.sectionHeader} style={{ marginTop: '3rem' }}>
              <div>
                <h2>Dias Fechados / Feriados</h2>
                <p>Dias específicos em que a instituição não terá atendimento.</p>
              </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div className={styles.holidayInputGroup}>
                 <div className={styles.inputGroup} style={{ flex: 1 }}>
                   <label className={styles.label}>Data</label>
                   <input type="date" id="newClosedDate" className={styles.input} />
                 </div>
                 <div className={styles.inputGroup} style={{ flex: 2 }}>
                   <label className={styles.label}>Motivo</label>
                   <input type="text" id="newClosedReason" placeholder="Ex: Feriado Nacional" className={styles.input} />
                 </div>
                 <button 
                   type="button" 
                   className={styles.primaryBtn} 
                   style={{ height: '48px' }}
                   onClick={() => {
                     const dateEl = document.getElementById('newClosedDate') as HTMLInputElement;
                     const reasonEl = document.getElementById('newClosedReason') as HTMLInputElement;
                     if(dateEl.value && reasonEl.value) {
                       setInstitution({
                         ...institution, 
                         closed_days: [...(institution.closed_days || []), { date: dateEl.value, reason: reasonEl.value }]
                       });
                       dateEl.value = '';
                       reasonEl.value = '';
                     }
                   }}
                 >
                   <Plus size={18} /> Adicionar
                 </button>
               </div>

               {institution.closed_days?.length > 0 ? (
                 <div className={styles.holidayList}>
                   {institution.closed_days.map((cd: any, idx: number) => (
                     <div key={idx} className={styles.holidayItem}>
                        <div className={styles.holidayInfo}>
                          <span className={styles.holidayDate}>{cd.date.split('-').reverse().join('/')}</span>
                          <span className={styles.holidayReason}>{cd.reason}</span>
                        </div>
                        <button 
                          type="button" 
                          className={styles.deleteHolidayBtn}
                          onClick={() => {
                            const newClosed = institution.closed_days.filter((_:any, i:number) => i !== idx);
                            setInstitution({...institution, closed_days: newClosed});
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                     </div>
                   ))}
                 </div>
               ) : (
                 <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                   Nenhum feriado cadastrado.
                 </p>
               )}
            </div>
          </section>
        )}

      </div>
      
      <div className={styles.submitBar}>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Gravar Modificações</>}
        </button>
      </div>

    </form>
  );
}
