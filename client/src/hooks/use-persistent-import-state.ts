import { useState, useCallback, useEffect, useRef } from "react";

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
  const [, forceUpdate] = useState({});
  const componentId = useRef(Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    console.log(`=== ImportPage ${componentId.current} - Component Mounted with Global State ===`, globalImportState);
    
    const listener = () => forceUpdate({});
    listeners.add(listener);
    
    return () => {
      console.log(`=== ImportPage ${componentId.current} - Component Unmounted ===`);
      listeners.delete(listener);
    };
  }, []);

  const updateState = useCallback((updates: Partial<ImportState>) => {
    console.log(`=== ImportPage ${componentId.current} - Global State Update ===`, updates);
    globalImportState = { ...globalImportState, ...updates };
    console.log(`=== ImportPage ${componentId.current} - New Global State ===`, globalImportState);
    notifyListeners();
  }, []);

  const resetState = useCallback(() => {
    console.log(`=== ImportPage ${componentId.current} - Resetting Global State ===`);
    globalImportState = {
      currentStep: 'upload',
      selectedFile: null,
      isAnalyzing: false,
      isImporting: false,
      fileAnalysis: null,
      columnMapping: {},
      importResult: null,
    };
    notifyListeners();
  }, []);

  return {
    state: globalImportState,
    updateState,
    resetState,
    componentId: componentId.current
  };
}