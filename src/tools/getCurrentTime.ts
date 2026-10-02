import {
  RegisteredTool,
  SchemaPropertyType,
  ToolExecutionResult,
} from '../types/tools';

export const getCurrentTimeTool: RegisteredTool = {
  name: 'getCurrentTime',
  description:
    'Returns the exact current time, date, day of the week, and timezone for the user or for a requested city/timezone.',
  parameters: {
    type: SchemaPropertyType.OBJECT,
    properties: {
      timezone: {
        type: SchemaPropertyType.STRING,
        description:
          'Optional IANA timezone identifier (e.g., "America/New_York", "Europe/London", "Asia/Tokyo", "Asia/Kolkata"). Leave empty to use the user\'s local timezone.',
      },
    },
  },
  execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const requestedTz =
      typeof args.timezone === 'string' && args.timezone.trim() !== ''
        ? args.timezone.trim()
        : Intl.DateTimeFormat().resolvedOptions().timeZone;

    const now = new Date();
    let effectiveTz = requestedTz;

    let formattedTime: string;
    let formattedDate: string;

    try {
      formattedTime = new Intl.DateTimeFormat('en-US', {
        timeZone: effectiveTz,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      }).format(now);

      formattedDate = new Intl.DateTimeFormat('en-US', {
        timeZone: effectiveTz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(now);
    } catch {
      effectiveTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      formattedTime = now.toLocaleTimeString();
      formattedDate = now.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    return {
      success: true,
      toolName: 'getCurrentTime',
      summary: `Current time in ${effectiveTz} is ${formattedTime} on ${formattedDate}.`,
      data: {
        timezone: effectiveTz,
        time: formattedTime,
        date: formattedDate,
        isoTimestamp: now.toISOString(),
      },
      actionCard: {
        id: `time-${Date.now()}`,
        type: 'time',
        title: formattedTime,
        subtitle: `${formattedDate} · ${effectiveTz}`,
        timestamp: Date.now(),
        meta: {
          timezone: effectiveTz,
        },
      },
    };
  },
};
