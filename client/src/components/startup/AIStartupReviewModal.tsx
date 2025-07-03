import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Startup } from "@shared/schema";
import { Bot, CheckCircle, AlertTriangle, Edit, Eye, Trash2, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AddStartupModalNew } from "./AddStartupModalNew";

type AIStartupReviewModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AIStartupReviewModal({ open, onClose }: AIStartupReviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [editingStartup, setEditingStartup] = useState<Startup | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Fetch all startups for AI review filtering
  const { data: allStartups = [], isLoading } = useQuery<Startup[]>({
    queryKey: ['/api/startups'],
    enabled: open,
    refetchOnWindowFocus: false,
    staleTime: 60000 // Consider data fresh for 1 minute
  });

  // Fetch statuses for editing
  const { data: statuses = [] } = useQuery<SelectStatus[]>({
    queryKey: ['/api/statuses'],
    enabled: open
  });

  // Filter AI-generated startups that haven't been reviewed yet
  const aiStartups = allStartups.filter(startup => {
    console.log('Checking startup for AI review:', {
      name: startup.name,
      id: startup.id,
      created_by_ai: (startup as any).created_by_ai,
      ai_reviewed: (startup as any).ai_reviewed
    });
    
    // Skip if already reviewed
    if ((startup as any).ai_reviewed === true) {
      return false;
    }
    
    // Primary filter: Check if marked as AI-generated
    if ((startup as any).created_by_ai === true) {
      return true;
    }
    
    // Fallback: Check for typical AI-generated patterns for existing data
    const hasAIPatterns = (
      startup.ceo_name?.includes('João') ||
      startup.ceo_name?.includes('Silva') ||
      startup.name?.includes('TechCorp') ||
      startup.sector === 'tech'
    );
    
    // Additional check: Recent entries that might be AI-generated
    const recentDate = new Date();
    recentDate.setHours(recentDate.getHours() - 2); // Last 2 hours
    const createdAt = new Date(startup.created_at);
    const isVeryRecent = createdAt > recentDate;

    return hasAIPatterns || isVeryRecent;
  });
  
  console.log('Filtered AI startups for review:', aiStartups.length, aiStartups.map(s => ({name: s.name, id: s.id})));
  
  // Debug logging for AI startup data
  React.useEffect(() => {
    if (aiStartups.length > 0) {
      console.log('AI startups data for review:', aiStartups.map(s => ({
        name: s.name,
        ceo_name: s.ceo_name,
        ceo_email: s.ceo_email,
        sector: s.sector,
        website: s.website,
        business_model: s.business_model,
        description: s.description?.substring(0, 100) + '...'
      })));
    }
  }, [aiStartups]);

  // Delete startup mutation
  const deleteStartupMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/startups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      toast({
        title: "Startup removida",
        description: "A startup foi removida com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao remover",
        description: "Falha ao remover a startup.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (startup: Startup) => {
    setEditingStartup(startup);
    setEditModalOpen(true);
  };

  const handleEditClose = () => {
    setEditModalOpen(false);
    setEditingStartup(null);
  };

  const handleEditSuccess = () => {
    // Mark as reviewed when editing is successful
    if (editingStartup) {
      markAsReviewedMutation.mutate(editingStartup.id);
    }
    handleEditClose();
  };

  // Mark startup as reviewed without editing
  const markAsReviewedMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/startups/${id}`, { ai_reviewed: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      toast({
        title: "Startup marcada como revisada",
        description: "A startup foi removida da lista de revisão.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao marcar como revisada",
        description: "Falha ao atualizar o status.",
        variant: "destructive",
      });
    },
  });

  const handleMarkAsReviewed = (startup: Startup) => {
    markAsReviewedMutation.mutate(startup.id);
  };

  const handleDelete = (startup: Startup) => {
    if (confirm(`Tem certeza que deseja remover a startup "${startup.name}"?`)) {
      deleteStartupMutation.mutate(startup.id);
    }
  };

  const getStatusBadge = (startup: Startup) => {
    const status = statuses.find(s => s.id === startup.status_id);
    return (
      <Badge variant="outline">
        {status?.name || 'Sem status'}
      </Badge>
    );
  };

  const getAIIndicator = (startup: Startup) => {
    const isAIGenerated = (startup as any).created_by_ai === true;
    const hasAIPatterns = startup.ceo_name?.includes('João') || startup.name?.includes('TechCorp');
    
    if (isAIGenerated || hasAIPatterns) {
      return (
        <div className="flex items-center gap-1">
          <Bot className="h-4 w-4 text-blue-600" />
          <span className="text-xs text-blue-600">IA</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-1">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-xs text-yellow-600">Manual</span>
      </div>
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Revisar Startups Criadas pela IA
          </DialogTitle>
          <DialogDescription>
            Revise e confirme as informações das startups criadas automaticamente pela IA.
            Encontradas {aiStartups.length} startups para revisão.

          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : aiStartups.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma startup para revisão</h3>
            <p className="text-gray-600">
              Todas as startups criadas pela IA já foram revisadas ou não há startups pendentes.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <Card>
              <CardHeader>
                <CardTitle>Startups Pendentes de Revisão</CardTitle>
                <CardDescription>
                  {aiStartups.length} startup{aiStartups.length !== 1 ? 's' : ''} aguardando revisão manual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CEO</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiStartups.map((startup) => (
                      <TableRow key={startup.id}>
                        <TableCell className="font-medium">
                          {startup.name}
                        </TableCell>
                        <TableCell>{startup.ceo_name || '-'}</TableCell>
                        <TableCell>{startup.sector || '-'}</TableCell>
                        <TableCell>{getStatusBadge(startup)}</TableCell>
                        <TableCell>{getAIIndicator(startup)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {format(new Date(startup.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedStartup(startup)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(startup)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsReviewed(startup)}
                              title="Marcar como revisada"
                              disabled={markAsReviewedMutation.isPending}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(startup)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Details Modal */}
        {selectedStartup && (
          <Dialog open={!!selectedStartup} onOpenChange={() => setSelectedStartup(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalhes - {selectedStartup.name}</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-500">CEO</h4>
                  <p className="text-sm">{selectedStartup.ceo_name || '-'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-500">Email</h4>
                  <p className="text-sm">{selectedStartup.ceo_email || '-'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-500">Setor</h4>
                  <p className="text-sm">{selectedStartup.sector || '-'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-500">Modelo de Negócio</h4>
                  <p className="text-sm">{selectedStartup.business_model || '-'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-500">Localização</h4>
                  <p className="text-sm">
                    {[selectedStartup.city, selectedStartup.state].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>
              </div>
              
              {selectedStartup.description && (
                <div>
                  <h4 className="font-medium text-sm text-gray-500 mb-2">Descrição</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded">{selectedStartup.description}</p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Modal using AddStartupModalNew */}
        <AddStartupModalNew
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          editingStartup={editingStartup}
          onSuccess={handleEditSuccess}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}