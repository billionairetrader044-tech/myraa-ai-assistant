export enum SchemaPropertyType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  INTEGER = 'INTEGER',
  BOOLEAN = 'BOOLEAN',
  ARRAY = 'ARRAY',
  OBJECT = 'OBJECT',
}

export interface ToolParameterProperty {
  type: SchemaPropertyType | string;
  description: string;
  enum?: string[];
  items?: ToolParameterProperty;
}

export interface ToolParameterSchema {
  type: SchemaPropertyType.OBJECT | 'OBJECT';
  description?: string;
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolFunctionDeclaration {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  summary: string;
  data?: Record<string, unknown>;
  actionCard?: ActionCardPayload;
  error?: string;
}

export interface ActionCardPayload {
  id: string;
  type: 'website' | 'search' | 'time' | 'reminder' | 'application';
  title: string;
  subtitle: string;
  url?: string;
  timestamp: number;
  meta?: Record<string, string>;
}

export interface RegisteredTool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute: (args: Record<string, unknown>) => Promise<ToolExecutionResult>;
}

export interface IncomingFunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

export interface OutgoingFunctionResponse {
  id?: string;
  name: string;
  response: Record<string, unknown>;
}

export interface ReminderItem {
  id: string;
  title: string;
  scheduledFor: string;
  priority: 'normal' | 'high';
  createdAt: number;
  completed: boolean;
  dueTimestamp?: number;
}
