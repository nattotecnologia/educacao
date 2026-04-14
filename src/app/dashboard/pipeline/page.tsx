'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { pipelineService, leadService } from '@/services';
import { maskPhone } from '@/utils/masks';
import { Loader2, Plus, GripVertical, User, MoreVertical, Edit, Trash2 } from 'lucide-react';
import styles from './Pipeline.module.css';

export default function PipelinePage() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  
  // Para gerenciar o estado local das colunas e leads
  const [columns, setColumns] = useState<any>({});
  
  // Estados para Modal de Estágio
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('#3b82f6');

  // Estado para Dropdown de Opções da Coluna
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const presetColors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#6b7280'];

  useEffect(() => {
    loadData();

    // Fechar menu ao clicar fora
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      let pipes = await pipelineService.getPipelines();
      let currentPipe = pipes[0];
      
      if (!currentPipe) {
        currentPipe = await pipelineService.createPipeline('Funil de Vendas');
        await pipelineService.createStage(currentPipe.id, 'Novo Lead', 0, '#3b82f6');
        await pipelineService.createStage(currentPipe.id, 'Em Atendimento', 1, '#f59e0b');
        await pipelineService.createStage(currentPipe.id, 'Proposta Enviada', 2, '#8b5cf6');
        await pipelineService.createStage(currentPipe.id, 'Fechado/Ganho', 3, '#10b981');
      }

      setPipeline(currentPipe);
      const stagesData = await pipelineService.getStages(currentPipe.id);
      setStages(stagesData);

      const { data: leadsData } = await leadService.getFiltered({ pageSize: 100 });
      setLeads(leadsData);

      const initialColumns: any = {};
      stagesData.forEach(stage => {
        initialColumns[stage.id] = leadsData
          .filter(l => l.stage_id === stage.id)
          .sort((a, b) => (a.stage_order || 0) - (b.stage_order || 0));
      });

      if (stagesData.length > 0) {
        const orphanLeads = leadsData.filter(l => !l.stage_id);
        initialColumns[stagesData[0].id] = [...orphanLeads, ...(initialColumns[stagesData[0].id] || [])];
      }

      setColumns(initialColumns);
    } catch (err) {
      console.error('Erro ao carregar pipeline:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (stage: any = null) => {
    if (stage) {
      setEditingStage(stage);
      setStageName(stage.name);
      setStageColor(stage.color);
    } else {
      setEditingStage(null);
      setStageName('');
      setStageColor('#3b82f6');
    }
    setIsModalOpen(true);
    setActiveMenuId(null); // Fecha o menu ao abrir o modal
  };

  const handleSaveStage = async () => {
    if (!stageName.trim()) return;

    try {
      if (editingStage) {
        await pipelineService.updateStage(editingStage.id, { name: stageName, color: stageColor });
      } else {
        await pipelineService.createStage(pipeline.id, stageName, stages.length, stageColor);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Erro ao salvar estágio:', err);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    setActiveMenuId(null);
    if (!confirm('Deseja realmente excluir este estágio? Todos os leads serão movidos para o primeiro estágio.')) return;

    try {
      // Mover leads antes de deletar (operação simplificada)
      const targetStage = stages.find(s => s.id !== stageId);
      if (targetStage && columns[stageId]?.length > 0) {
        for (const lead of columns[stageId]) {
          await pipelineService.moveLead(lead.id, targetStage.id, 0);
        }
      }
      
      await pipelineService.deleteStage(stageId);
      loadData();
    } catch (err) {
      console.error('Erro ao deletar estágio:', err);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const sourceList = Array.from(columns[sourceColId]);
    const draggedLead: any = sourceList.find((l: any) => l.id === draggableId);
    
    if (!draggedLead) return;

    sourceList.splice(source.index, 1);

    if (sourceColId === destColId) {
      sourceList.splice(destination.index, 0, draggedLead);
      const newColumns = { ...columns, [sourceColId]: sourceList };
      setColumns(newColumns);
      await updateLeadsOrder(destColId, sourceList);
    } else {
      const destList = Array.from(columns[destColId] || []);
      destList.splice(destination.index, 0, draggedLead);
      
      const newColumns = {
        ...columns,
        [sourceColId]: sourceList,
        [destColId]: destList
      };
      setColumns(newColumns);
      await updateLeadsOrder(destColId, destList, destColId);
    }
  };

  const updateLeadsOrder = async (stageId: string, sortedList: any[], newStageId?: string) => {
    try {
      for (let i = 0; i < sortedList.length; i++) {
        const lead = sortedList[i];
        const newOrder = i * 1000;
        if (lead.stage_order !== newOrder || (newStageId && lead.stage_id !== newStageId)) {
           pipelineService.moveLead(lead.id, newStageId || stageId, newOrder);
        }
      }
    } catch (err) {
      console.error('Erro ao salvar posições', err);
    }
  };

  if (loading && !pipeline) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={40} />
        <p>Construindo seu funil...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{pipeline?.name || 'Pipeline'}</h1>
      </header>

      <div className={styles.boardWrapper}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className={styles.board}>
            {stages.map((stage) => (
              <div key={stage.id} className={styles.columnWrapper}>
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitleWrapper}>
                    <div className={styles.columnDot} style={{ background: stage.color }}></div>
                    <span className={styles.columnTitle}>{stage.name}</span>
                  </div>
                  <div className={styles.columnActions}>
                    <span className={styles.columnCount}>{(columns[stage.id] || []).length}</span>
                    <div className={styles.menuContainer}>
                      <button 
                        className={styles.columnActionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === stage.id ? null : stage.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuId === stage.id && (
                        <div className={styles.dropdownMenu}>
                          <button className={styles.menuItem} onClick={() => handleOpenModal(stage)}>
                            <Edit size={14} />
                            <span>Editar Estágio</span>
                          </button>
                          <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => handleDeleteStage(stage.id)}>
                            <Trash2 size={14} />
                            <span>Excluir Estágio</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      className={`${styles.columnContent} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {(columns[stage.id] || []).map((lead: any, index: number) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              className={`${styles.card} ${snapshot.isDragging ? styles.isDragging : ''}`}
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <div className={styles.cardHeader}>
                                <div className={styles.cardAvatar}>
                                  <User size={14} />
                                </div>
                                <span className={styles.cardName}>{lead.name || maskPhone(lead.phone)}</span>
                              </div>
                              <div className={styles.cardFooter}>
                                <span className={styles.cardTime}>
                                  {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
            
            <button className={styles.addStageBtn} onClick={() => handleOpenModal()}>
              <Plus size={20} />
              <span>Novo Estágio</span>
            </button>
          </div>
        </DragDropContext>
      </div>

      {/* Modal de Gestão de Estágio */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingStage ? 'Editar Estágio' : 'Novo Estágio'}
              </h2>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Nome do Estágio</label>
                <input 
                  type="text" 
                  className={styles.input}
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  placeholder="Ex: Em Negociação"
                  autoFocus
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Cor do Marcador</label>
                <div className={styles.colorPicker}>
                  {presetColors.map(color => (
                    <div 
                      key={color}
                      className={`${styles.colorOption} ${stageColor === color ? styles.active : ''}`}
                      style={{ background: color }}
                      onClick={() => setStageColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                Cancelar
              </button>
              <button className={styles.saveBtn} onClick={handleSaveStage}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
