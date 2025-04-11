import { Startup } from "@shared/schema";
import { CalendarIcon, Trash2, LinkIcon, Building2, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

type StartupCardProps = {
  startup: Startup;
  onClick: () => void;
  onDelete: () => void;
};

export function StartupCard({ startup, onClick, onDelete }: StartupCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Impedir que o evento de clique interfira no drag
    if (e.currentTarget === e.target || 
        e.target instanceof HTMLDivElement ||
        e.target instanceof HTMLHeadingElement ||
        e.target instanceof HTMLParagraphElement ||
        e.target instanceof HTMLSpanElement) {
      onClick();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  // Determinar a cor de fundo com base na prioridade
  const getPriorityColor = () => {
    switch (startup.priority) {
      case 'high':
        return 'bg-red-50 border-red-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      case 'low':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Determinar a cor do badge com base no setor
  const getSectorBadgeColor = () => {
    switch (startup.sector) {
      case 'tech':
        return 'bg-blue-100 text-blue-800';
      case 'health':
        return 'bg-green-100 text-green-800';
      case 'finance':
        return 'bg-purple-100 text-purple-800';
      case 'education':
        return 'bg-yellow-100 text-yellow-800';
      case 'retail':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Não precisamos mais desta função
  // convertemos diretamente na renderização

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer p-3 rounded-md border shadow-sm ${getPriorityColor()} hover:shadow-md transition-shadow duration-200`}
    >
      {/* Cabeçalho do card */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">
          {startup.name}
        </h3>
        <button
          onClick={handleDeleteClick}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Descrição */}
      {startup.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2" title={startup.description}>
          {startup.description}
        </p>
      )}

      {/* Informações principais */}
      <div className="grid grid-cols-2 gap-2 my-2">
        {/* CEO */}
        {startup.ceo_name && (
          <div className="flex items-center text-xs text-gray-600">
            <Building2 className="h-3 w-3 mr-1 text-gray-400" />
            <span className="truncate" title={startup.ceo_name}>
              {startup.ceo_name}
            </span>
          </div>
        )}

        {/* MRR */}
        {startup.mrr && (
          <div className="flex items-center text-xs text-gray-600">
            <CircleDollarSign className="h-3 w-3 mr-1 text-gray-400" />
            <span className="truncate">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(parseFloat(startup.mrr))}
            </span>
          </div>
        )}

        {/* Founding Date */}
        {startup.founding_date && (
          <div className="flex items-center text-xs text-gray-600">
            <CalendarIcon className="h-3 w-3 mr-1 text-gray-400" />
            <span className="truncate">
              {new Date(startup.founding_date).toLocaleDateString('pt-BR')}
            </span>
          </div>
        )}

        {/* Location */}
        {(startup.city || startup.state) && (
          <div className="flex items-center text-xs text-gray-600">
            <LinkIcon className="h-3 w-3 mr-1 text-gray-400" />
            <span className="truncate">
              {startup.city && startup.state 
                ? `${startup.city}, ${startup.state}`
                : startup.city || startup.state}
            </span>
          </div>
        )}
      </div>

      {/* Footer com badges */}
      <div className="flex flex-wrap justify-between items-center mt-3">
        {/* Setor */}
        {startup.sector && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSectorBadgeColor()}`}>
            {startup.sector}
          </span>
        )}

        {/* Modelo de negócio */}
        {startup.business_model && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {startup.business_model}
          </span>
        )}
      </div>
    </div>
  );
}