import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { type Startup, type StartupMember, StatusEnum } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

type StartupDetailsModalProps = {
  open: boolean;
  startup: Startup;
  onClose: () => void;
};

// Helper for industry styling
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

// Helper for status display
const getStatusDisplay = (status: string) => {
  const statusMap = {
    [StatusEnum.IDEA]: { label: "Idea Stage", style: "bg-blue-100 text-blue-800" },
    [StatusEnum.MVP]: { label: "MVP Stage", style: "bg-purple-100 text-purple-800" },
    [StatusEnum.TRACTION]: { label: "Traction Stage", style: "bg-green-100 text-green-800" },
    [StatusEnum.SCALING]: { label: "Scaling Stage", style: "bg-yellow-100 text-yellow-800" },
  };
  
  return statusMap[status as keyof typeof statusMap] || 
    { label: status, style: "bg-gray-100 text-gray-800" };
};

// Helper for funding stage format
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

export function StartupDetailsModal({ 
  open, 
  startup, 
  onClose 
}: StartupDetailsModalProps) {
  const industryStyle = getIndustryStyles(startup.industry);
  const statusDisplay = getStatusDisplay(startup.status);
  
  // Fetch startup members
  const { data: members = [] } = useQuery<StartupMember[]>({
    queryKey: ['/api/startups', startup.id, 'members'],
    enabled: open
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-6 w-6 rounded-full"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-medium text-gray-700">
              {startup.name}
            </DialogTitle>
            <span className={`text-xs px-2 py-1 rounded-full ${industryStyle.bg} ${industryStyle.text}`}>
              {startup.industry.charAt(0).toUpperCase() + startup.industry.slice(1)}
            </span>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="border-t border-gray-200 pt-4">
            <dl className="divide-y divide-gray-200">
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="text-sm text-gray-700">
                  <span className={`px-2 py-1 text-xs rounded-full ${statusDisplay.style}`}>
                    {statusDisplay.label}
                  </span>
                </dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Funding Stage</dt>
                <dd className="text-sm text-gray-700">{formatFundingStage(startup.fundingStage)}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Team Size</dt>
                <dd className="text-sm text-gray-700">{startup.teamSize} members</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Founded</dt>
                <dd className="text-sm text-gray-700">{startup.foundedDate || "Not specified"}</dd>
              </div>
              <div className="py-3 flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Location</dt>
                <dd className="text-sm text-gray-700">{startup.location || "Not specified"}</dd>
              </div>
            </dl>
          </div>
          
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
            <p className="text-sm text-gray-700">
              {startup.description}
            </p>
          </div>
          
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Team</h4>
            <div className="flow-root mt-2">
              <ul className="-my-4 divide-y divide-gray-200">
                {members.length > 0 ? (
                  members.map((member) => (
                    <li key={member.id} className="py-4 flex items-center">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.photoUrl} alt={member.name} />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-700">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.role}</p>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="py-4 text-sm text-gray-500">No team members listed</li>
                )}
              </ul>
            </div>
          </div>
        </div>
        
        <DialogFooter className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <Button variant="default" className="w-full sm:w-auto">
            Edit Details
          </Button>
          <Button variant="outline" onClick={onClose} className="mt-3 sm:mt-0 sm:mr-3 w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
