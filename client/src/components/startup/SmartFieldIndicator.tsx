import React from "react";
import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SmartFieldIndicatorProps {
  suggestionCount: number;
  bestConfidence: number;
}

export function SmartFieldIndicator({ suggestionCount, bestConfidence }: SmartFieldIndicatorProps) {
  if (suggestionCount === 0) return null;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "bg-green-100 text-green-800 border-green-200";
    if (confidence >= 0.5) return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.7) return "Alta";
    if (confidence >= 0.5) return "Média";
    return "Baixa";
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex items-center gap-1 text-xs text-blue-600">
        <Lightbulb className="h-3 w-3" />
        <span>{suggestionCount} sugestões</span>
      </div>
      <Badge 
        variant="outline" 
        className={`text-xs ${getConfidenceColor(bestConfidence)}`}
      >
        Confiança: {getConfidenceText(bestConfidence)}
      </Badge>
    </div>
  );
}