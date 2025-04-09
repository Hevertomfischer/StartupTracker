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
import { type Startup, type StartupMember, type Status, SectorEnum, PriorityEnum, insertStartupSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { X, Calendar, MapPin, Users, BarChart3, TrendingUp, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

type StartupDetailsModalProps = {
  open: boolean;
  startup: Startup;
  onClose: () => void;
};

// Helper for sector styling
const getSectorStyles = (sector: string | null) => {
  if (!sector) return { bg: "bg-gray-100", text: "text-gray-800" };
  
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
  
  return styles[sector as keyof typeof styles] || styles.other;
};

// Helper for priority styling
const getPriorityStyles = (priority: string | null) => {
  if (!priority) return { bg: "bg-gray-100", text: "text-gray-800" };
  
  const styles = {
    high: { bg: "bg-red-100", text: "text-red-800" },
    medium: { bg: "bg-yellow-100", text: "text-yellow-800" },
    low: { bg: "bg-green-100", text: "text-green-800" },
  };
  
  return styles[priority as keyof typeof styles] || styles.medium;
};

export function StartupDetailsModal({ open, startup, onClose }: StartupDetailsModalProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(insertStartupSchema),
    defaultValues: startup
  });

  const onSubmit = async (data: Startup) => {
    try {
      await apiRequest("PATCH", `/api/startups/${startup.id}`, data);
      await queryClient.invalidateQueries({ queryKey: ["/api/startups"] });
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error("Failed to update startup:", error);
    }
  };
  const sectorStyle = getSectorStyles(startup.sector);
  const priorityStyle = getPriorityStyles(startup.priority);
  
  // Fetch startup status
  const { data: status } = useQuery<Status>({
    queryKey: ['/api/statuses', startup.status_id],
    enabled: open && !!startup.status_id,
    retry: false
  });
  
  // Fetch startup members
  const { data: members = [] } = useQuery<StartupMember[]>({
    queryKey: ['/api/startups', startup.id, 'members'],
    enabled: open
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        {!isEditing ? (
          <>
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
                {startup.sector && (
                  <Badge variant="outline" className={`${sectorStyle.bg} ${sectorStyle.text} border-0`}>
                    {startup.sector.charAt(0).toUpperCase() + startup.sector.slice(1)}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-sm text-gray-500 mt-1">
                {status?.name && (
                  <Badge 
                    variant="outline" 
                    className="mr-2 bg-gray-100 text-gray-800 border-0"
                  >
                    {status.name}
                  </Badge>
                )}
                {startup.priority && (
                  <Badge 
                    variant="outline" 
                    className={`${priorityStyle.bg} ${priorityStyle.text} border-0`}
                  >
                    {`${startup.priority.charAt(0).toUpperCase() + startup.priority.slice(1)} Priority`}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4">
              <div className="border-t border-gray-200 pt-4">
                <dl className="divide-y divide-gray-200">
                  {startup.ceo_name && (
                    <div className="py-3 flex justify-between items-center">
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        CEO
                      </dt>
                      <dd className="text-sm text-gray-700">{startup.ceo_name}</dd>
                    </div>
                  )}
                  
                  {(startup.city || startup.state) && (
                    <div className="py-3 flex justify-between items-center">
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        Location
                      </dt>
                      <dd className="text-sm text-gray-700">
                        {[startup.city, startup.state].filter(Boolean).join(", ")}
                      </dd>
                    </div>
                  )}
                  
                  {startup.mrr && (
                    <div className="py-3 flex justify-between items-center">
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        MRR
                      </dt>
                      <dd className="text-sm text-gray-700">
                        ${Number(startup.mrr).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  
                  {startup.total_revenue_last_year && (
                    <div className="py-3 flex justify-between items-center">
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Last Year Revenue
                      </dt>
                      <dd className="text-sm text-gray-700">
                        ${Number(startup.total_revenue_last_year).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  
                  {startup.tam && (
                    <div className="py-3 flex justify-between items-center">
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Total Addressable Market
                      </dt>
                      <dd className="text-sm text-gray-700">
                        ${Number(startup.tam).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
                <p className="text-sm text-gray-700">
                  {startup.description || "No description available"}
                </p>
              </div>
              
              {startup.observations && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Observations</h4>
                  <p className="text-sm text-gray-700">
                    {startup.observations}
                  </p>
                </div>
              )}
              
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Team</h4>
                <div className="flow-root mt-2">
                  <ul className="-my-4 divide-y divide-gray-200">
                    {members.length > 0 ? (
                      members.map((member) => (
                        <li key={member.id} className="py-4 flex items-center">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.photo_url || undefined} alt={member.name} />
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
              <Button onClick={() => setIsEditing(true)} className="ml-2">
                Edit
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Edit Startup</DialogTitle>
              <DialogDescription>
                Make changes to the startup information
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sector</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sector" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SectorEnum).map(([key, value]) => (
                              <SelectItem key={key} value={value}>
                                {key}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(PriorityEnum).map(([key, value]) => (
                              <SelectItem key={key} value={value}>
                                {key}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
            
            <DialogFooter className="mt-5">
              <Button onClick={form.handleSubmit(onSubmit)} className="ml-2">
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}