import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, RouteComponentProps } from "wouter";
import { ReactNode } from "react";
import { UserRoleEnum } from "@shared/schema";

export function ProtectedRoute({
  path,
  component: Component,
  allowedRoles,
}: {
  path: string;
  component: React.ComponentType<any>;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();

  // Componente de wrapper para passar os parâmetros do router
  const ComponentWrapper = (props: RouteComponentProps) => {
    return <Component {...props} />;
  };

  if (isLoading) {
    return (
      <Route path={path}>
        {() => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        )}
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        {() => <Redirect to="/auth" />}
      </Route>
    );
  }

  // Se houver roles definidas, verifica se o usuário tem permissão
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Route path={path}>
        {() => (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
            <p className="text-center text-muted-foreground mb-6">
              Você não tem permissão para acessar esta página.
            </p>
            <Redirect to="/" />
          </div>
        )}
      </Route>
    );
  }

  return <Route path={path} component={ComponentWrapper} />;
}

// Componente para rotas que só podem ser acessadas por administradores
export function AdminRoute({
  path,
  component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  return (
    <ProtectedRoute 
      path={path} 
      component={component} 
      allowedRoles={["admin"]} 
    />
  );
}

// Componente para rotas que podem ser acessadas por administradores e investidores
export function InvestorRoute({
  path,
  component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  return (
    <ProtectedRoute 
      path={path} 
      component={component} 
      allowedRoles={["admin", "investor"]} 
    />
  );
}