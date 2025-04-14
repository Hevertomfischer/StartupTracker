// Mapping between type properties
declare module '@shared/schema' {
  interface WorkflowAction {
    order?: number;
    action_details?: any;
    action_name?: string;
    description?: string;
    action_type?: string;
    id?: string;
  }
}