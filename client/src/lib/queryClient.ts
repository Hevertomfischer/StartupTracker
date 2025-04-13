import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  try {
    console.log(`API Request: ${method} ${url}`, data);
    
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (!res.ok) {
      // Tentar obter informações detalhadas do erro
      let errorData;
      try {
        errorData = await res.json();
      } catch (e) {
        errorData = await res.text();
      }
      
      console.error(`API Error (${res.status}):`, errorData);
      throw new Error(`Request failed with status ${res.status}: ${JSON.stringify(errorData)}`);
    }
    
    // Verifica se a resposta está vazia (como em 204 No Content)
    if (res.status === 204) {
      console.log(`API Response: ${method} ${url} (No Content)`);
      return null;
    }
    
    try {
      // Tenta analisar a resposta como JSON
      const responseData = await res.json();
      console.log(`API Response: ${method} ${url}`, responseData);
      return responseData;
    } catch (e) {
      // Se não for JSON, retorna o texto ou null
      const text = await res.text();
      console.log(`API Response: ${method} ${url} (Text)`, text || "(empty)");
      return text || null;
    }
  } catch (error) {
    console.error(`API Request failed: ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
