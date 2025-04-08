import { useState, useEffect } from "react";
import { Banknote, Users, ChevronRight } from "lucide-react";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { type Startup, type StartupMember } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

type StartupCardProps = {
  startup: Startup;
  onClick: () => void;
};

// Helper function for industry styling
const getIndustryStyles = (industry: string) => {
  const styles = {
    tech: { bg: "bg-blue-100", text: "text-blue-800" },
    health: { bg: "bg-red-100", text: "text-red-800" },
    finance: { bg: "bg-indigo-100", text: "text-indigo-800" },
    ecommerce: { bg: "bg-pink-100", text: "text-pink-800" },
    education: { bg: "bg-green-100", text: "text-green-800" },
    other: { bg: "bg-yellow-100", text: "text-yellow-800" },
  };
  
  return styles[industry as keyof typeof styles] || styles.other;
};

// Format funding stage
const formatFundingStage = (stage: string) => {
  const formatMap: Record<string, string> = {
    "bootstrapped": "Bootstrapped",
    "pre-seed": "Pre-seed",
    "seed": "Seed",
    "series-a": "Series A",
    "series-b": "Series B",
    "series-c": "Series C+"
  };
  
  return formatMap[stage] || stage;
};

export function StartupCard({ startup, onClick }: StartupCardProps) {
  const { id, name, description, industry, fundingStage, teamSize } = startup;
  const industryStyle = getIndustryStyles(industry);
  
  // Fetch startup members
  const { data: members = [] } = useQuery<StartupMember[]>({
    queryKey: ['/api/startups', id, 'members'],
    enabled: true
  });
  
  return (
    <div className="kanban-card bg-white p-4 rounded border border-gray-200 shadow-sm mb-3 cursor-move hover:shadow-md transition-all">
      <div className="flex justify-between items-start">
        <h4 className="text-md font-medium text-gray-700">{name}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${industryStyle.bg} ${industryStyle.text}`}>
          {industry.charAt(0).toUpperCase() + industry.slice(1)}
        </span>
      </div>
      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{description}</p>
      <div className="mt-3 flex items-center text-xs text-gray-500">
        <span className="mr-3 flex items-center">
          <Banknote className="h-4 w-4 mr-1" />
          {formatFundingStage(fundingStage)}
        </span>
        <span className="flex items-center">
          <Users className="h-4 w-4 mr-1" />
          {teamSize} members
        </span>
      </div>
      <div className="mt-3 flex justify-between items-center">
        <AvatarGroup 
          members={members.length > 0 
            ? members.map(m => ({ name: m.name, photoUrl: m.photoUrl }))
            : [{ name: "Team Member" }]} 
          size="sm"
        />
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
