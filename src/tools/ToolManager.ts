import {
  IncomingFunctionCall,
  OutgoingFunctionResponse,
  RegisteredTool,
  ToolExecutionResult,
  ToolFunctionDeclaration,
} from '../types/tools';
import { airaBridgeTools } from './airaBridgeTools';
import { createReminderTool } from './createReminder';
import { getCurrentTimeTool } from './getCurrentTime';
import { openApplicationTool } from './openApplication';
import { openWebsiteTool } from './openWebsite';
import { searchWebTool } from './searchWeb';

/**
 * Modular ToolManager registry for AIRA.
 * Registers all Voice + PC + File + Browser + Screenshot + WhatsApp tools.
 */
export class ToolManager {
  private registry: Map<string, RegisteredTool> = new Map();

  constructor() {
    this.registerTool(openWebsiteTool);
    this.registerTool(searchWebTool);
    this.registerTool(getCurrentTimeTool);
    this.registerTool(openApplicationTool);
    this.registerTool(createReminderTool);
    for (const tool of airaBridgeTools) {
      this.registerTool(tool);
    }
  }

  public registerTool(tool: RegisteredTool): void {
    this.registry.set(tool.name, tool);
  }

  public getTool(name: string): RegisteredTool | undefined {
    return this.registry.get(name);
  }

  public getAllTools(): RegisteredTool[] {
    return Array.from(this.registry.values());
  }

  public getFunctionDeclarations(): ToolFunctionDeclaration[] {
    return this.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  public async executeFunctionCall(
    call: IncomingFunctionCall
  ): Promise<{
    result: ToolExecutionResult;
    functionResponse: OutgoingFunctionResponse;
  }> {
    const tool = this.registry.get(call.name);

    if (!tool) {
      const fallbackResult: ToolExecutionResult = {
        success: false,
        toolName: call.name,
        summary: `I can't perform "${call.name}" with the current agent configuration.`,
        error: `Unregistered tool: ${call.name}`,
      };
      return {
        result: fallbackResult,
        functionResponse: {
          id: call.id,
          name: call.name,
          response: {
            error: fallbackResult.error,
            summary: fallbackResult.summary,
          },
        },
      };
    }

    try {
      const executionResult = await tool.execute(call.args || {});
      return {
        result: executionResult,
        functionResponse: {
          id: call.id,
          name: call.name,
          response: {
            success: executionResult.success,
            summary: executionResult.summary,
            ...(executionResult.data || {}),
            ...(executionResult.error ? { error: executionResult.error } : {}),
          },
        },
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unexpected tool execution error';
      const failedResult: ToolExecutionResult = {
        success: false,
        toolName: call.name,
        summary: `Tool "${call.name}" encountered an error: ${errorMessage}`,
        error: errorMessage,
      };
      return {
        result: failedResult,
        functionResponse: {
          id: call.id,
          name: call.name,
          response: {
            success: false,
            error: errorMessage,
            summary: failedResult.summary,
          },
        },
      };
    }
  }
}

export const toolManager = new ToolManager();
