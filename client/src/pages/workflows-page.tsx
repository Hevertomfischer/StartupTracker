import React from 'react';
import { Helmet } from 'react-helmet';
import { WorkflowList } from '@/components/workflow/WorkflowList';
import { PageHeader } from '@/components/PageHeader';

const WorkflowsPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Fluxos de Trabalho | Startup Management</title>
      </Helmet>
      
      <div className="container py-6 max-w-7xl mx-auto">
        <PageHeader 
          title="Fluxos de Trabalho"
          description="Gerencie automações e fluxos de trabalho para ações em startups e tarefas"
        />
        
        <div className="mt-8">
          <WorkflowList />
        </div>
      </div>
    </>
  );
};

export default WorkflowsPage;