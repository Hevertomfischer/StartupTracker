import { useQuery } from "@tanstack/react-query";

// Interface para a contagem de tarefas
export interface TaskCount {
  startupId: string;
  count: number;
}

// Hook para buscar e gerenciar contagens de tarefas
export function useTaskCounts() {
  const { data: taskCounts, isLoading, error, refetch } = useQuery<TaskCount[]>({
    queryKey: ['/api/task-counts'],
    queryFn: async () => {
      const response = await fetch('/api/task-counts');
      if (!response.ok) {
        throw new Error('Falha ao buscar contagens de tarefas');
      }
      return response.json();
    }
  });

  // Função para obter a contagem de tarefas para uma startup específica
  const getCountForStartup = (startupId: string): number => {
    if (!taskCounts) return 0;
    const taskCount = taskCounts.find(count => count.startupId === startupId);
    return taskCount ? taskCount.count : 0;
  };

  return {
    taskCounts,
    isLoading,
    error,
    refetch,
    getCountForStartup,
  };
}