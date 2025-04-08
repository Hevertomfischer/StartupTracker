import { useState } from "react";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, 
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { SectorEnum, PriorityEnum } from "@shared/schema";

type FilterOptions = {
  search: string;
  sector: string;
  priority: string;
  sort?: string;
};

type FilterToolbarProps = {
  onFilterChange: (filters: Partial<FilterOptions>) => void;
};

export function FilterToolbar({ onFilterChange }: FilterToolbarProps) {
  const [searchValue, setSearchValue] = useState("");
  
  const handleSearch = (value: string) => {
    setSearchValue(value);
    onFilterChange({ search: value });
  };
  
  const handleSectorChange = (value: string) => {
    onFilterChange({ sector: value });
  };
  
  const handlePriorityChange = (value: string) => {
    onFilterChange({ priority: value });
  };
  
  const handleSortChange = (value: string) => {
    onFilterChange({ sort: value });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 mb-6">
        <div className="md:grid md:grid-cols-4 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-700">Filter & Search</h3>
            <p className="mt-1 text-sm text-gray-500">
              Narrow down your startup view
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-3">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <div className="mt-1 relative flex rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search for startups..."
                    className="pl-10"
                    value={searchValue}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sector
                </label>
                <Select onValueChange={handleSectorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sectors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sectors</SelectItem>
                    <SelectItem value={SectorEnum.TECH}>Technology</SelectItem>
                    <SelectItem value={SectorEnum.HEALTH}>Healthcare</SelectItem>
                    <SelectItem value={SectorEnum.FINANCE}>Finance</SelectItem>
                    <SelectItem value={SectorEnum.ECOMMERCE}>E-commerce</SelectItem>
                    <SelectItem value={SectorEnum.EDUCATION}>Education</SelectItem>
                    <SelectItem value={SectorEnum.AGRITECH}>AgriTech</SelectItem>
                    <SelectItem value={SectorEnum.CLEANTECH}>CleanTech</SelectItem>
                    <SelectItem value={SectorEnum.OTHER}>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <Select onValueChange={handlePriorityChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value={PriorityEnum.HIGH}>High</SelectItem>
                    <SelectItem value={PriorityEnum.MEDIUM}>Medium</SelectItem>
                    <SelectItem value={PriorityEnum.LOW}>Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <Select onValueChange={handleSortChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="date">Date Added</SelectItem>
                    <SelectItem value="mrr">Monthly Revenue</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
