import React from 'react';
import { WorkflowList } from '@/components/workflow/WorkflowList';

const WorkflowsPage: React.FC = () => {
  return (
    <div className="container py-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Fluxos de Trabalho</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie automações e fluxos de trabalho para ações em startups e tarefas
        </p>
      </div>
      
      <div className="mt-8">
        <WorkflowList />
      </div>
    </div>
  );
};

export default WorkflowsPage;