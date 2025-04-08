import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { FilterToolbar } from "@/components/startup/FilterToolbar";
import { StartupDetailsModal } from "@/components/startup/StartupDetailsModal";
import { AddStartupModal } from "@/components/startup/AddStartupModal";
import { StatusManagementModal } from "@/components/status/StatusManagementModal";
import { useStartups } from "@/hooks/use-startup";
import { type Startup } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus, Columns } from "lucide-react";

export default function Dashboard() {
  const { data: startups = [], isLoading } = useStartups();
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [showStartupModal, setShowStartupModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    search: "",
    sector: "",
    priority: ""
  });
  
  const openStartupDetails = (startup: Startup) => {
    setSelectedStartup(startup);
    setShowStartupModal(true);
  };

  const closeStartupDetails = () => {
    setShowStartupModal(false);
    setSelectedStartup(null);
  };

  const openAddStartup = () => {
    setShowAddModal(true);
  };

  const closeAddStartup = () => {
    setShowAddModal(false);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };
  
  const openStatusManagement = () => {
    setShowStatusModal(true);
  };

  const closeStatusManagement = () => {
    setShowStatusModal(false);
  };

  const handleFilterChange = (
    newFilters: Partial<typeof filterOptions>
  ) => {
    setFilterOptions(prev => ({ ...prev, ...newFilters }));
  };

  // Apply filters to the startups
  const filteredStartups = startups.filter(startup => {
    // Search filter
    const matchesSearch =
      !filterOptions.search ||
      startup.name.toLowerCase().includes(filterOptions.search.toLowerCase()) ||
      (startup.description?.toLowerCase().includes(filterOptions.search.toLowerCase()) ?? false) ||
      (startup.ceo_name?.toLowerCase().includes(filterOptions.search.toLowerCase()) ?? false);

    // Sector filter
    const matchesSector =
      !filterOptions.sector || 
      filterOptions.sector === "all" ||
      startup.sector === filterOptions.sector;

    // Priority filter
    const matchesPriority =
      !filterOptions.priority || 
      filterOptions.priority === "all" ||
      startup.priority === filterOptions.priority;

    return matchesSearch && matchesSector && matchesPriority;
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for larger screens, hidden on mobile */}
      <div className={`${showSidebar ? 'block' : 'hidden'} md:flex md:flex-shrink-0`}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Mobile top navigation */}
        <TopNavigation onToggleSidebar={toggleSidebar} />

        {/* Main area */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-gray-50">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="md:flex md:items-center md:justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-800 sm:text-3xl sm:truncate">
                    Startup Management
                  </h2>
                </div>
                <div className="mt-4 flex gap-2 md:mt-0 md:ml-4">
                  <Button 
                    onClick={openStatusManagement}
                    variant="outline"
                    className="inline-flex items-center"
                  >
                    <Columns className="-ml-1 mr-2 h-5 w-5" />
                    Manage Columns
                  </Button>
                  <Button 
                    onClick={openAddStartup} 
                    className="inline-flex items-center"
                  >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Add Startup
                  </Button>
                </div>
              </div>
            </div>

            {/* Filter toolbar */}
            <FilterToolbar onFilterChange={handleFilterChange} />

            {/* Kanban board */}
            {isLoading ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                <div className="text-center">
                  <div className="animate-pulse h-6 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
                  <div className="animate-pulse h-40 bg-gray-200 rounded w-full mb-4"></div>
                  <div className="animate-pulse h-40 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            ) : (
              <KanbanBoard 
                startups={filteredStartups} 
                onCardClick={openStartupDetails} 
              />
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {selectedStartup && (
        <StartupDetailsModal 
          open={showStartupModal} 
          startup={selectedStartup} 
          onClose={closeStartupDetails} 
        />
      )}
      <AddStartupModal 
        open={showAddModal} 
        onClose={closeAddStartup} 
      />
      <StatusManagementModal
        open={showStatusModal}
        onClose={closeStatusManagement}
      />
    </div>
  );
}
