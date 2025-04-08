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
import { IndustryEnum, FundingStageEnum } from "@shared/schema";

type FilterOptions = {
  search: string;
  industry: string;
  funding: string;
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
  
  const handleIndustryChange = (value: string) => {
    onFilterChange({ industry: value });
  };
  
  const handleFundingChange = (value: string) => {
    onFilterChange({ funding: value });
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
                  Industry
                </label>
                <Select onValueChange={handleIndustryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    <SelectItem value={IndustryEnum.TECH}>Technology</SelectItem>
                    <SelectItem value={IndustryEnum.HEALTH}>Healthcare</SelectItem>
                    <SelectItem value={IndustryEnum.FINANCE}>FinTech</SelectItem>
                    <SelectItem value={IndustryEnum.ECOMMERCE}>E-commerce</SelectItem>
                    <SelectItem value={IndustryEnum.EDUCATION}>Education</SelectItem>
                    <SelectItem value={IndustryEnum.OTHER}>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funding Stage
                </label>
                <Select onValueChange={handleFundingChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value={FundingStageEnum.PRE_SEED}>Pre-seed</SelectItem>
                    <SelectItem value={FundingStageEnum.SEED}>Seed</SelectItem>
                    <SelectItem value={FundingStageEnum.SERIES_A}>Series A</SelectItem>
                    <SelectItem value={FundingStageEnum.SERIES_B}>Series B</SelectItem>
                    <SelectItem value={FundingStageEnum.SERIES_C}>Series C+</SelectItem>
                    <SelectItem value={FundingStageEnum.BOOTSTRAPPED}>Bootstrapped</SelectItem>
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
                    <SelectItem value="funding">Funding Amount</SelectItem>
                    <SelectItem value="team">Team Size</SelectItem>
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
