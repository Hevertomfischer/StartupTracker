import { useState, useEffect } from "react";
import { Users, MapPin, Trash2 } from "lucide-react";
import { type Startup, type StartupMember } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type StartupCardProps = {
  startup: Startup;
  onClick: () => void;
  onDelete: () => void;
};

function getSectorStyles(sector: string | null) {
  const styles = {
    tech: { bg: "bg-blue-100", text: "text-blue-800" },
    health: { bg: "bg-green-100", text: "text-green-800" },
    finance: { bg: "bg-purple-100", text: "text-purple-800" },
    ecommerce: { bg: "bg-yellow-100", text: "text-yellow-800" },
    education: { bg: "bg-pink-100", text: "text-pink-800" },
    default: { bg: "bg-gray-100", text: "text-gray-800" }
  };

  return styles[sector as keyof typeof styles] || styles.default;
}

export function StartupCard({ startup, onClick, onDelete }: StartupCardProps) {
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

  const { data: members = [] } = useQuery<StartupMember[]>({
    queryKey: ['/api/startups', id, 'members'],
    enabled: true
  });

  return (
    <div className="kanban-card bg-white p-4 rounded border border-gray-200 shadow-sm mb-3 cursor-pointer hover:shadow-md transition-all" onClick={onClick}>
      <div className="flex justify-between items-start">
        <h4 className="text-md font-medium text-gray-700">{name}</h4>
        <div className="flex items-center gap-2">
          {sector && (
            <span className={`text-xs px-2 py-1 rounded-full ${sectorStyle.bg} ${sectorStyle.text}`}>
              {sector.charAt(0).toUpperCase() + sector.slice(1)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
    </div>
  );
}