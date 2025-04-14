import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AuthPage from "@/pages/auth-page";
import TeamManagement from "@/pages/TeamManagement";
import UserManagement from "@/pages/UserManagement";
import TaskManagement from "@/pages/TaskManagement";
import SimpleRoleManagement from "@/pages/SimpleRoleManagement";
import WorkflowsPage from "@/pages/workflows-page";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute, AdminRoute, InvestorRoute } from "@/lib/protected-route";
import { UserRoleEnum } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/teams" component={TeamManagement} />
      <ProtectedRoute path="/tasks" component={TaskManagement} />
      <AdminRoute path="/users" component={UserManagement} />
      <AdminRoute path="/roles" component={SimpleRoleManagement} />
      <AdminRoute path="/workflows" component={WorkflowsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
