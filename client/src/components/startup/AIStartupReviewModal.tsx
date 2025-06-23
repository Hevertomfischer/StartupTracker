import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertStartupSchema, type SelectStatus, type Startup } from "@shared/schema";
import { Bot, CheckCircle, AlertTriangle, Edit, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AIStartupReviewModalProps = {
  open: boolean;
  onClose: () => void;
};

const editStartupSchema = insertStartupSchema.partial();

export function AIStartupReviewModal({ open, onClose }: AIStartupReviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [editingStartup, setEditingStartup] = useState<Startup | null>(null);

  // Fetch AI-generated startups (simulated - we'll filter by creation date and specific patterns)
  const { data: allStartups = [], isLoading } = useQuery<Startup[]>({
    queryKey: ['/api/startups'],
    enabled: open
  });

  // Fetch statuses for editing
  const { data: statuses = [] } = useQuery<SelectStatus[]>({
    queryKey: ['/api/statuses'],
    enabled: open
  });

  // Filter AI-generated startups
  const aiStartups = allStartups.filter(startup => {
    // Primary filter: Check if marked as AI-generated
    if ((startup as any).created_by_ai === true) {
      return true;
    }
    
    // Fallback: Check for typical AI-generated patterns for existing data
    const hasAIPatterns = (
      startup.ceo_name?.includes('João') ||
      startup.ceo_name?.includes('Silva') ||
      startup.name?.includes('TechCorp') ||
      startup.website?.includes('techcorp') ||
      startup.description?.includes('SaaS para empresas') ||
      startup.sector === 'tech' ||
      startup.business_model === 'SaaS'
    );

    // Also include recent entries (last 7 days) that might be AI-generated
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    const createdAt = new Date(startup.created_at);
    const isRecent = createdAt > recentDate;

    return hasAIPatterns || isRecent;
  });

  // Edit form
  const editForm = useForm({
    resolver: zodResolver(editStartupSchema),
    defaultValues: {}
  });

  // Update startup mutation
  const updateStartupMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/startups/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      toast({
        title: "Startup atualizada",
        description: "As informações foram salvas com sucesso.",
      });
      setEditingStartup(null);
      editForm.reset();
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar",
        description: "Falha ao salvar as alterações.",
        variant: "destructive",
      });
    },
  });

  // Delete startup mutation
  const deleteStartupMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/startups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      toast({
        title: "Startup removida",
        description: "A startup foi removida do sistema.",
      });
      setSelectedStartup(null);
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
    editForm.reset(startup);
  };

  const handleSaveEdit = (data: any) => {
    if (!editingStartup) return;
    updateStartupMutation.mutate({
      id: editingStartup.id,
      updates: data
    });
  };

  const handleDelete = (startup: Startup) => {
    if (confirm(`Tem certeza que deseja remover a startup "${startup.name}"?`)) {
      deleteStartupMutation.mutate(startup.id);
    }
  };

  const getStatusBadge = (startup: Startup) => {
    const status = statuses.find(s => s.id === startup.status_id);
    return (
      <Badge variant="outline" className="text-xs">
        {status?.nome || 'Sem status'}
      </Badge>
    );
  };

  const getAIIndicator = (startup: Startup) => {
    const isAIGenerated = (startup as any).created_by_ai === true;
    
    const hasAIPatterns = (
      startup.ceo_name?.includes('João') ||
      startup.ceo_name?.includes('Silva') ||
      startup.name?.includes('TechCorp') ||
      startup.website?.includes('techcorp')
    );

    return (isAIGenerated || hasAIPatterns) ? (
      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
        <Bot className="h-3 w-3 mr-1" />
        IA
      </Badge>
    ) : (
      <Badge variant="outline" className="text-xs">
        Manual
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            Revisão de Startups Geradas por IA
          </DialogTitle>
          <DialogDescription>
            Revise e confirme as informações das startups criadas automaticamente pela IA.
            Encontradas {aiStartups.length} startups para revisão.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Carregando startups...</p>
            </div>
          </div>
        ) : aiStartups.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma startup pendente
                </h3>
                <p className="text-sm text-gray-600">
                  Todas as startups geradas por IA já foram revisadas.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo da Revisão</CardTitle>
                <CardDescription>
                  {aiStartups.length} startups encontradas para revisão
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Startups Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Startups para Revisão</CardTitle>
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
                      <TableHead>Data</TableHead>
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
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(startup)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(startup)}
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

        {/* Edit Modal */}
        {editingStartup && (
          <Dialog open={!!editingStartup} onOpenChange={() => setEditingStartup(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Startup - {editingStartup.name}</DialogTitle>
              </DialogHeader>
              
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleSaveEdit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="ceo_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEO</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="ceo_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email do CEO</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="sector"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Setor</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="business_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo de Negócio</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="status_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statuses.map((status) => (
                                <SelectItem key={status.id} value={status.id}>
                                  {status.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setEditingStartup(null)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateStartupMutation.isPending}
                    >
                      {updateStartupMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
                  <h4 className="font-medium text-sm text-gray-500">Website</h4>
                  <p className="text-sm">{selectedStartup.website || '-'}</p>
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}