import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Rocket,
  Users,
  Calendar,
  BarChart,
  Settings,
  UserCog,
  CheckSquare,
  ShieldCheck,
  GitMerge,
  FormInput,
  Copy
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Sidebar() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('Administrador');
  
  // Link base
  const links = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, current: window.location.pathname === '/' },
    { name: 'Startups', href: '#', icon: Rocket, current: false },
    { name: 'Times', href: '/teams', icon: Users, current: window.location.pathname === '/teams' },
    { name: 'Tarefas', href: '/tasks', icon: CheckSquare, current: window.location.pathname === '/tasks' },
    { name: 'Formulário Externo', href: '/external-form', icon: FormInput, current: window.location.pathname === '/external-form' },
    { name: 'Código de Embed', href: '/embed-code', icon: Copy, current: window.location.pathname === '/embed-code' },
    { name: 'Calendar', href: '#', icon: Calendar, current: false },
    { name: 'Analytics', href: '#', icon: BarChart, current: false },
    { name: 'Settings', href: '#', icon: Settings, current: false },
  ];
  
  // Adiciona os links de gestão para administradores
  if (isAdmin) {
    links.push({ 
      name: 'Usuários', 
      href: '/users', 
      icon: UserCog, 
      current: window.location.pathname === '/users' 
    });
    
    links.push({ 
      name: 'Perfis', 
      href: '/roles', 
      icon: ShieldCheck, 
      current: window.location.pathname === '/roles' 
    });
    
    links.push({ 
      name: 'Workflows', 
      href: '/workflows', 
      icon: GitMerge, 
      current: window.location.pathname === '/workflows' 
    });
  }

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-800">StartupBoard</h1>
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex-1 px-2 py-4 space-y-1">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className={`flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                link.current
                  ? 'text-white bg-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <link.icon className={`w-6 h-6 mr-3 ${
                link.current ? 'text-white' : 'text-gray-500'
              }`} />
              {link.name}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src="" alt="User" />
              <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700">{user?.name || 'Usuário'}</p>
            <p className="text-xs font-medium text-gray-500">
              {userRoles.length > 0 ? userRoles.join(', ') : 'Sem perfil atribuído'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
