import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { DragDropKanban } from "@/components/kanban/DragDropKanban";
import { FilterToolbar } from "@/components/startup/FilterToolbar";
import { AddStartupModalNew } from "@/components/startup/AddStartupModalNew";
import { StatusManagementModal } from "@/components/status/StatusManagementModal";
import { useStartups } from "@/hooks/use-startup";
import { type Startup } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus, Columns, Bot, Eye } from "lucide-react";
import { AddStartupWithAIModal } from "@/components/startup/AddStartupWithAIModal";
import { AIStartupReviewModal } from "@/components/startup/AIStartupReviewModal";

export default function Dashboard() {
  const { data: startups = [], isLoading } = useStartups();
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [showStartupModal, setShowStartupModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAIReviewModal, setShowAIReviewModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    search: "",
    sector: "",
    priority: ""
  });

  const openStartupDetails = async (startup: Startup) => {
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
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setShowAIReviewModal(true)}
                      variant="outline"
                      className="inline-flex items-center"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Revisar IA
                    </Button>
                    <Button 
                      onClick={() => setShowAIModal(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Add com IA
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
              <DragDropKanban 
                startups={filteredStartups} 
                onCardClick={openStartupDetails} 
              />
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {selectedStartup && (
        <AddStartupModalNew
          open={showStartupModal} 
          startup={selectedStartup} 
          onClose={closeStartupDetails} 
          isEditing={true}
        />
      )}
      <AddStartupModalNew
        open={showAddModal} 
        onClose={closeAddStartup} 
      />
      <StatusManagementModal
        open={showStatusModal}
        onClose={closeStatusManagement}
      />
      <AddStartupWithAIModal 
        open={showAIModal} 
        onClose={() => setShowAIModal(false)} 
      />
      <AIStartupReviewModal 
        open={showAIReviewModal} 
        onClose={() => setShowAIReviewModal(false)} 
      />
    </div>
  );
}