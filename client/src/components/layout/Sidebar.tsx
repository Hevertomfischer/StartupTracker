import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Rocket,
  Users,
  Calendar,
  BarChart,
  Settings
} from "lucide-react";

export function Sidebar() {
  const links = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, current: window.location.pathname === '/' },
    { name: 'Startups', href: '#', icon: Rocket, current: false },
    { name: 'Times', href: '/teams', icon: Users, current: window.location.pathname === '/teams' },
    { name: 'Calendar', href: '#', icon: Calendar, current: false },
    { name: 'Analytics', href: '#', icon: BarChart, current: false },
    { name: 'Settings', href: '#', icon: Settings, current: false },
  ];

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
              <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="User" />
              <AvatarFallback>TC</AvatarFallback>
            </Avatar>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700">Tom Cook</p>
            <p className="text-xs font-medium text-gray-500">Product Manager</p>
          </div>
        </div>
      </div>
    </div>
  );
}
