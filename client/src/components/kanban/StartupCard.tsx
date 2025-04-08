import { useState, useEffect } from "react";
import { Banknote, Users, ChevronRight, Building2, MapPin } from "lucide-react";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { type Startup, type StartupMember } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

type StartupCardProps = {
  startup: Startup;
  onClick: () => void;
};

// Helper function for sector styling
const getSectorStyles = (sector: string | null) => {
  const styles = {
    tech: { bg: "bg-blue-100", text: "text-blue-800" },
    health: { bg: "bg-red-100", text: "text-red-800" },
    finance: { bg: "bg-indigo-100", text: "text-indigo-800" },
    ecommerce: { bg: "bg-pink-100", text: "text-pink-800" },
    education: { bg: "bg-green-100", text: "text-green-800" },
    agritech: { bg: "bg-emerald-100", text: "text-emerald-800" },
    cleantech: { bg: "bg-teal-100", text: "text-teal-800" },
    other: { bg: "bg-yellow-100", text: "text-yellow-800" },
  };
  
  if (!sector) return styles.other;
  return styles[sector as keyof typeof styles] || styles.other;
};

export function StartupCard({ startup, onClick }: StartupCardProps) {
  const { 
    id, 
    name, 
    description, 
    sector,
    ceo_name,
    city,
    state,
  } = startup;
  
  const sectorStyle = getSectorStyles(sector);
  
  // Fetch startup members
  const { data: members = [] } = useQuery<StartupMember[]>({
    queryKey: ['/api/startups', id, 'members'],
    enabled: true
  });
  
  return (
    <div className="kanban-card bg-white p-4 rounded border border-gray-200 shadow-sm mb-3 cursor-move hover:shadow-md transition-all">
      <div className="flex justify-between items-start">
        <h4 className="text-md font-medium text-gray-700">{name}</h4>
        {sector && (
          <span className={`text-xs px-2 py-1 rounded-full ${sectorStyle.bg} ${sectorStyle.text}`}>
            {sector.charAt(0).toUpperCase() + sector.slice(1)}
          </span>
        )}
      </div>
      
      {description && (
        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{description}</p>
      )}
      
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
        {ceo_name && (
          <span className="flex items-center">
            <Users className="h-4 w-4 mr-1 text-gray-400" />
            {ceo_name}
          </span>
        )}
        
        {(city || state) && (
          <span className="flex items-center">
            <MapPin className="h-4 w-4 mr-1 text-gray-400" />
            {[city, state].filter(Boolean).join(", ")}
          </span>
        )}
      </div>
      
      <div className="mt-3 flex justify-between items-center">
        {members.length > 0 ? (
          <AvatarGroup 
            members={members.map(m => ({ 
              name: m.name, 
              photoUrl: m.photo_url || undefined
            }))} 
            size="sm"
          />
        ) : (
          <div className="text-xs text-gray-400">No team members</div>
        )}
        
        <button 
          className="text-gray-500 hover:text-blue-600"
          onClick={onClick}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
