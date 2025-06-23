import React, { createContext, useContext, useState, useCallback } from 'react';

interface SmartFormData {
  [key: string]: any;
}

interface SmartFormContextType {
  formData: SmartFormData;
  updateField: (field: string, value: any) => void;
  getContext: () => SmartFormData;
  resetForm: () => void;
}

const SmartFormContext = createContext<SmartFormContextType | undefined>(undefined);

export function SmartFormProvider({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = useState<SmartFormData>({});

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const getContext = useCallback(() => formData, [formData]);

  const resetForm = useCallback(() => {
    setFormData({});
  }, []);

  return (
    <SmartFormContext.Provider value={{ formData, updateField, getContext, resetForm }}>
      {children}
    </SmartFormContext.Provider>
  );
}

export function useSmartForm() {
  const context = useContext(SmartFormContext);
  if (!context) {
    throw new Error('useSmartForm must be used within a SmartFormProvider');
  }
  return context;
}