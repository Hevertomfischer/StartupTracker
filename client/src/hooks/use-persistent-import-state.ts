import { useState, useCallback, useEffect, useRef, useMemo } from "react";

interface FileAnalysis {
  success: boolean;
  headers: string[];
  preview: any[];
  total_rows: number;
  filename: string;
  available_fields: Record<string, { label: string; required: boolean; type: string }>;
  message?: string;
}

interface ImportError {
  row: number;
  field: string;
  value: any;
  error: string;
}

interface ImportWarning {
  row: number;
  field: string;
  value: any;
  warning: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  imported_count: number;
  total_rows: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

type ImportStep = 'upload' | 'mapping' | 'processing' | 'results';

interface ImportState {
  currentStep: ImportStep;
  selectedFile: File | null;
  isAnalyzing: boolean;
  isImporting: boolean;
  fileAnalysis: FileAnalysis | null;
  columnMapping: Record<string, string>;
  importResult: ImportResult | null;
}

// Global state to persist across component remounts
let globalImportState: ImportState = {
  currentStep: 'upload',
  selectedFile: null,
  isAnalyzing: false,
  isImporting: false,
  fileAnalysis: null,
  columnMapping: {},
  importResult: null,
};

// Listeners for state changes
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function usePersistentImportState() {
  const [state, setState] = useState<ImportState>(globalImportState);
  const componentId = useRef(Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    console.log(`=== ImportPage ${componentId.current} - Component Mounted with Global State ===`, state);

    const listener = () => setState(globalImportState);
    listeners.add(listener);

    return () => {
      console.log(`=== ImportPage ${componentId.current} - Component Unmounted ===`);
      listeners.delete(listener);
    };
  }, []);

  const updateState = useCallback((updates: Partial<ImportState>) => {
    console.log(`=== Atualizando estado (${componentId.current}) ===`, updates);
    setState(prev => {
      const newState = { ...prev, ...updates };
      console.log('Estado anterior:', prev);
      console.log('Novo estado:', newState);
      return newState;
    });
  }, [componentId]);

  const resetState = useCallback(() => {
    console.log(`=== ImportPage ${componentId.current} - Resetting Global State ===`);
    setState({
      currentStep: 'upload',
      selectedFile: null,
      isAnalyzing: false,
      isImporting: false,
      fileAnalysis: null,
      columnMapping: {},
      importResult: null,
    });
  }, []);

  return useMemo(() => ({
    state,
    updateState,
    resetState,
    componentId: componentId.current
  }), [state, updateState, resetState]);
}