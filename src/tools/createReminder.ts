import {
  RegisteredTool,
  ReminderItem,
  SchemaPropertyType,
  ToolExecutionResult,
} from '../types/tools';

const REMINDERS_STORAGE_KEY = 'myraa_reminders_v1';

export function loadStoredReminders(): ReminderItem[] {
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReminderItem[];
  } catch {
    return [];
  }
}

export function saveStoredReminders(items: ReminderItem[]): void {
  try {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('myraa:reminders-updated'));
  } catch {
    // Ignore storage errors
  }
}

export function toggleReminderCompleted(id: string): ReminderItem[] {
  const current = loadStoredReminders();
  const updated = current.map((item) =>
    item.id === id ? { ...item, completed: !item.completed } : item
  );
  saveStoredReminders(updated);
  return updated;
}

export function deleteStoredReminder(id: string): ReminderItem[] {
  const current = loadStoredReminders();
  const updated = current.filter((item) => item.id !== id);
  saveStoredReminders(updated);
  return updated;
}

export const createReminderTool: RegisteredTool = {
  name: 'createReminder',
  description:
    'Creates and saves a persistent reminder or task for the user in their browser storage.',
  parameters: {
    type: SchemaPropertyType.OBJECT,
    properties: {
      title: {
        type: SchemaPropertyType.STRING,
        description: 'The reminder content or task description.',
      },
      scheduledFor: {
        type: SchemaPropertyType.STRING,
        description:
          'When the reminder is for (e.g., "in 10 minutes", "Today at 5:00 PM", "Tomorrow morning").',
      },
      priority: {
        type: SchemaPropertyType.STRING,
        description: 'Priority level: "normal" or "high".',
        enum: ['normal', 'high'],
      },
    },
    required: ['title'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    const scheduledFor =
      typeof args.scheduledFor === 'string' && args.scheduledFor.trim() !== ''
        ? args.scheduledFor.trim()
        : 'Upcoming';
    const priority = args.priority === 'high' ? 'high' : 'normal';

    if (!title) {
      return {
        success: false,
        toolName: 'createReminder',
        summary: 'Cannot create an empty reminder.',
        error: 'Missing required parameter: title',
      };
    }

    const newReminder: ReminderItem = {
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      scheduledFor,
      priority,
      createdAt: Date.now(),
      completed: false,
    };

    const existing = loadStoredReminders();
    const updated = [newReminder, ...existing].slice(0, 30);
    saveStoredReminders(updated);

    return {
      success: true,
      toolName: 'createReminder',
      summary: `Created reminder: "${title}" scheduled for ${scheduledFor} (${priority} priority).`,
      data: {
        id: newReminder.id,
        title: newReminder.title,
        scheduledFor: newReminder.scheduledFor,
        priority: newReminder.priority,
        totalActiveReminders: updated.filter((r) => !r.completed).length,
      },
      actionCard: {
        id: newReminder.id,
        type: 'reminder',
        title: `Reminder: ${title}`,
        subtitle: `${scheduledFor} · ${priority === 'high' ? 'High Priority' : 'Standard'}`,
        timestamp: Date.now(),
        meta: {
          scheduledFor,
          priority,
        },
      },
    };
  },
};
