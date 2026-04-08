'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { pipelineService, leadService } from '@/services';
import { Loader2, Plus, GripVertical, User } from 'lucide-react';
import styles from './Pipeline.module.css';

export default function PipelinePage() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  
  // Para gerenciar o estado local das colunas e leads
  const [columns, setColumns] = useState<any>({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Busca pipes
        let pipes = await pipelineService.getPipelines();
        let currentPipe = pipes[0];
        
        // Se nao tem pipeline, cria um padrao ("Vendas") e estágios básicos
        if (!currentPipe) {
          currentPipe = await pipelineService.createPipeline('Funil de Vendas');
          await pipelineService.createStage(currentPipe.id, 'Novo Lead', 0, '#3b82f6');
          await pipelineService.createStage(currentPipe.id, 'Em Atendimento', 1, '#f59e0b');
          await pipelineService.createStage(currentPipe.id, 'Proposta Enviada', 2, '#8b5cf6');
          await pipelineService.createStage(currentPipe.id, 'Fechado/Ganho', 3, '#10b981');
        }

        setPipeline(currentPipe);
        
        // Busca estágios
        const stagesData = await pipelineService.getStages(currentPipe.id);
        setStages(stagesData);

        // Busca leads gerais
        const { data: leadsData } = await leadService.getFiltered({ pageSize: 100 });
        setLeads(leadsData);

        // Monta o estado de colunas
        const initialColumns: any = {};
        stagesData.forEach(stage => {
          initialColumns[stage.id] = leadsData
            .filter(l => l.stage_id === stage.id)
            .sort((a, b) => (a.stage_order || 0) - (b.stage_order || 0));
        });

        // Leads sem stage ficam na primeira coluna por padrão
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
    loadData();
  }, []);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Se dropou fora ou no mesmo lugar exato
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const sourceList = Array.from(columns[sourceColId]);
    const draggedLead: any = sourceList.find((l: any) => l.id === draggableId);
    
    if (!draggedLead) return;

    sourceList.splice(source.index, 1);

    if (sourceColId === destColId) {
      // Movimentação na mesma coluna
      sourceList.splice(destination.index, 0, draggedLead);
      const newColumns = { ...columns, [sourceColId]: sourceList };
      setColumns(newColumns);
      
      // Atualizar a ordem (stage_order) localmente e depois db
      // Uma logica sofisticada recalcularia a propriedade `stage_order` mas vamos apenas salvar o db.
      await updateLeadsOrder(destColId, sourceList);
    } else {
      // Movimentação entre colunas
      const destList = Array.from(columns[destColId] || []);
      destList.splice(destination.index, 0, draggedLead);
      
      const newColumns = {
        ...columns,
        [sourceColId]: sourceList,
        [destColId]: destList
      };
      setColumns(newColumns);

      // Atualiza banco (troca estágio e recalcula ordem na nova coluna)
      await updateLeadsOrder(destColId, destList, destColId);
    }
  };

  const updateLeadsOrder = async (stageId: string, sortedList: any[], newStageId?: string) => {
    try {
      // Atualiza banco de forma otimista/simples sem transações pesadas
      for (let i = 0; i < sortedList.length; i++) {
        const lead = sortedList[i];
        const newOrder = i * 1000; // Incrementos grandes ajudam a inserir items no meio depois
        
        if (lead.stage_order !== newOrder || (newStageId && lead.stage_id !== newStageId)) {
           pipelineService.moveLead(lead.id, newStageId || stageId, newOrder);
        }
      }
    } catch (err) {
      console.error('Erro ao salvar posições', err);
    }
  };

  if (loading) {
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
        {/* Futuro: seletor de pipeline */}
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
                  <span className={styles.columnCount}>{(columns[stage.id] || []).length}</span>
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
                                <span className={styles.cardName}>{lead.name || lead.phone}</span>
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
            
            <button className={styles.addStageBtn}>
              <Plus size={20} />
              <span>Novo Estágio</span>
            </button>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
