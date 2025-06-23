import React, { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SmartFieldIndicator } from "./SmartFieldIndicator";

interface SmartAutoCompleteFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fieldType: 'sector' | 'business_model' | 'city' | 'state' | 'website' | 'description';
  disabled?: boolean;
  context?: Record<string, any>; // Other form values for context
}

interface AutoCompleteSuggestion {
  value: string;
  confidence: number;
  reason: string;
}

export function SmartAutoCompleteField({
  label,
  value,
  onChange,
  placeholder,
  fieldType,
  disabled,
  context = {}
}: SmartAutoCompleteFieldProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Fetch existing startup data for pattern analysis
  const { data: existingStartups = [] } = useQuery({
    queryKey: ['/api/startups'],
    select: (data: any[]) => data.map(startup => ({
      sector: startup.sector,
      business_model: startup.business_model,
      city: startup.city,
      state: startup.state,
      website: startup.website,
      description: startup.description,
      nome: startup.nome
    }))
  });

  // Generate smart suggestions based on existing data patterns
  const generateSuggestions = useCallback((): AutoCompleteSuggestion[] => {
    if (!existingStartups.length) return [];

    const suggestions: AutoCompleteSuggestion[] = [];
    
    switch (fieldType) {
      case 'sector': {
        const sectorCounts = existingStartups.reduce((acc, startup) => {
          if (startup.sector) {
            acc[startup.sector] = (acc[startup.sector] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        const sortedSectors = Object.entries(sectorCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5);
          
        sortedSectors.forEach(([sector, count]) => {
          suggestions.push({
            value: sector,
            confidence: Math.min(count / existingStartups.length, 0.9),
            reason: `Setor comum (${count} startups)`
          });
        });
        break;
      }
      
      case 'business_model': {
        const modelCounts = existingStartups.reduce((acc, startup) => {
          if (startup.business_model) {
            acc[startup.business_model] = (acc[startup.business_model] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(modelCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 4)
          .forEach(([model, count]) => {
            suggestions.push({
              value: model,
              confidence: Math.min(count / existingStartups.length, 0.8),
              reason: `Modelo frequente (${count} casos)`
            });
          });
        break;
      }
      
      case 'city': {
        if (context.state) {
          const citiesInState = existingStartups
            .filter(s => s.state === context.state && s.city)
            .map(s => s.city);
          
          const cityCounts = citiesInState.reduce((acc, city) => {
            acc[city] = (acc[city] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          Object.entries(cityCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .forEach(([city, count]) => {
              suggestions.push({
                value: city,
                confidence: 0.7,
                reason: `Cidade comum em ${context.state}`
              });
            });
        }
        break;
      }
      
      case 'state': {
        const stateCounts = existingStartups.reduce((acc, startup) => {
          if (startup.state) {
            acc[startup.state] = (acc[startup.state] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(stateCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .forEach(([state, count]) => {
            suggestions.push({
              value: state,
              confidence: Math.min(count / existingStartups.length, 0.8),
              reason: `Estado frequente (${count} startups)`
            });
          });
        break;
      }
      
      case 'website': {
        if (context.nome || context.name) {
          const name = (context.nome || context.name || '').toLowerCase().replace(/\s+/g, '');
          suggestions.push(
            {
              value: `https://${name}.com`,
              confidence: 0.6,
              reason: 'Baseado no nome da startup'
            },
            {
              value: `https://${name}.com.br`,
              confidence: 0.5,
              reason: 'Domínio brasileiro comum'
            }
          );
        }
        break;
      }
      
      case 'description': {
        if (context.sector && context.business_model) {
          const similar = existingStartups.filter(s => 
            s.sector === context.sector || s.business_model === context.business_model
          );
          
          if (similar.length > 0) {
            const commonTerms = similar
              .map(s => s.description || '')
              .join(' ')
              .toLowerCase()
              .split(/\s+/)
              .filter(word => word.length > 4)
              .reduce((acc, word) => {
                acc[word] = (acc[word] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
            
            const topTerms = Object.entries(commonTerms)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 3)
              .map(([term]) => term);
            
            if (topTerms.length > 0) {
              suggestions.push({
                value: `Uma startup de ${context.sector} focada em ${topTerms.join(', ')}`,
                confidence: 0.4,
                reason: 'Baseado em startups similares'
              });
            }
          }
        }
        break;
      }
    }
    
    return suggestions.filter(s => s.confidence > 0.3);
  }, [existingStartups, fieldType, context]);

  const suggestions = generateSuggestions();

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  const shouldShowSuggestions = inputFocused && suggestions.length > 0 && !value;

  useEffect(() => {
    setShowSuggestions(shouldShowSuggestions);
  }, [shouldShowSuggestions]);

  return (
    <div className="relative space-y-2">
      <Label htmlFor={fieldType}>{label}</Label>
      <div className="relative">
        <Input
          id={fieldType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setInputFocused(true)}
          onBlur={() => {
            // Delay hiding suggestions to allow clicks
            setTimeout(() => setInputFocused(false), 200);
          }}
          className={suggestions.length > 0 && !value ? 'border-blue-300 bg-blue-50' : ''}
        />
        
        {suggestions.length > 0 && !value && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Lightbulb className="h-4 w-4 text-blue-500 animate-pulse" />
          </div>
        )}
      </div>
      
      {showSuggestions && (
        <Card className="absolute z-10 w-full mt-1 p-2 border border-blue-200 bg-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-600 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Sugestões Inteligentes
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSuggestions(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="p-2 hover:bg-blue-50 rounded cursor-pointer border border-transparent hover:border-blue-200 transition-colors"
                onClick={() => handleSuggestionClick(suggestion.value)}
              >
                <div className="font-medium text-sm text-gray-800">
                  {suggestion.value}
                </div>
                <div className="text-xs text-gray-500 flex items-center justify-between">
                  <span>{suggestion.reason}</span>
                  <span className="text-blue-600">
                    {Math.round(suggestion.confidence * 100)}% confiança
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Baseado em {existingStartups.length} startups do sistema
            </p>
          </div>
        </Card>
      )}
      
      {/* Smart field indicator - shows when field is empty but has suggestions */}
      {!value && suggestions.length > 0 && (
        <SmartFieldIndicator 
          suggestionCount={suggestions.length}
          bestConfidence={Math.max(...suggestions.map(s => s.confidence))}
        />
      )}
    </div>
  );
}