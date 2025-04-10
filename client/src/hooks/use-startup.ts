import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  type Startup, 
  type InsertStartup, 
  type StartupMember,
  type InsertStartupMember,
  type StartupHistory,
  type StartupStatusHistory
} from "@shared/schema";

// Get all startups
export function useStartups() {
  return useQuery<Startup[]>({ 
    queryKey: ['/api/startups'] 
  });
}

// Get a specific startup
export function useStartup(id: number | undefined) {
  return useQuery<Startup>({ 
    queryKey: ['/api/startups', id],
    enabled: !!id
  });
}

// Get startup members
export function useStartupMembers(startupId: number | undefined) {
  return useQuery<StartupMember[]>({ 
    queryKey: ['/api/startups', startupId, 'members'],
    enabled: !!startupId
  });
}

// Create a new startup
export function useCreateStartup() {
  return useMutation({
    mutationFn: async (data: InsertStartup) => {
      const response = await apiRequest("POST", "/api/startups", data);
      return response.json() as Promise<Startup>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
    }
  });
}

// Update a startup
export function useUpdateStartup() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<InsertStartup> }) => {
      const response = await apiRequest("PATCH", `/api/startups/${id}`, data);
      return response.json() as Promise<Startup>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/startups', variables.id] });
    }
  });
}

// Update a startup's status (for drag and drop)
export function useUpdateStartupStatus() {
  return useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await apiRequest("PATCH", `/api/startups/${id}/status`, { status });
      return response.json() as Promise<Startup>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
    }
  });
}

// Delete a startup
export function useDeleteStartup() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/startups/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
    }
  });
}

// Add a team member to a startup
export function useAddTeamMember() {
  return useMutation({
    mutationFn: async ({ 
      startupId, 
      member 
    }: { 
      startupId: number, 
      member: Omit<InsertStartupMember, 'startupId'> 
    }) => {
      const response = await apiRequest(
        "POST", 
        `/api/startups/${startupId}/members`, 
        member
      );
      return response.json() as Promise<StartupMember>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/startups', variables.startupId, 'members'] 
      });
    }
  });
}

// Get startup history
export function useStartupHistory(startupId: string | undefined) {
  const endpoint = startupId ? `/api/startups/${startupId}/history` : null;
  console.log("Endpoint história:", endpoint);
  
  return useQuery<StartupHistory[]>({ 
    queryKey: ['/api/startups', startupId, 'history'],
    queryFn: async ({ queryKey }) => {
      if (!startupId) return [];
      return await apiRequest('GET', `/api/startups/${startupId}/history`);
    },
    enabled: !!startupId,
    retry: 1
  });
}

// Get startup status history
export function useStartupStatusHistory(startupId: string | undefined) {
  const endpoint = startupId ? `/api/startups/${startupId}/status-history` : null;
  console.log("Endpoint histórico de status:", endpoint);
  
  return useQuery<StartupStatusHistory[]>({ 
    queryKey: ['/api/startups', startupId, 'status-history'],
    queryFn: async ({ queryKey }) => {
      if (!startupId) return [];
      return await apiRequest(`/api/startups/${startupId}/status-history`, { method: 'GET' });
    },
    enabled: !!startupId,
    retry: 1
  });
}
