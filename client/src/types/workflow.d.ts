// Mapping between type properties
declare module '@shared/schema' {
  interface WorkflowAction {
    execution_order?: number;
    config_json?: any;
  }
}