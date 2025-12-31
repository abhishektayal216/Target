import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, format } from 'date-fns';
import { Task } from '../components/TaskItem';

const AI_API_KEY = '@ai_api_key';
const AI_MODEL_KEY = '@ai_model_name';
const USER_PREFS_KEY = '@user_prefs';

export interface UserPrefs {
    workStartTime: string; // e.g. "09:00"
    breakDuration: number; // in minutes
    totalWorkTime: number; // in hours
    prefsCompleted: boolean;
}

export interface AIGeneratedTarget {
    title: string;
    type: 'Quantity' | 'Time';
    targetValue: number;
    notes?: string;
    reminderTime?: string;
    linkedTaskIds: string[];
    priority: number;
}

const DEFAULT_USER_PREFS: UserPrefs = {
    workStartTime: '09:00',
    breakDuration: 15,
    totalWorkTime: 8,
    prefsCompleted: false,
};

export const aiService = {
    async getModelName(): Promise<string> {
        try {
            const model = await AsyncStorage.getItem(AI_MODEL_KEY);
            return model || 'gemini-2.5-flash';
        } catch {
            return 'gemini-2.5-flash';
        }
    },

    async setModelName(name: string): Promise<void> {
        try {
            await AsyncStorage.setItem(AI_MODEL_KEY, name);
        } catch (e) {
            console.error('Failed to save model', e);
        }
    },

    async getApiKey(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(AI_API_KEY);
        } catch {
            return null;
        }
    },

    async getUserPrefs(): Promise<UserPrefs> {
        try {
            const data = await AsyncStorage.getItem(USER_PREFS_KEY);
            return data ? JSON.parse(data) : DEFAULT_USER_PREFS;
        } catch {
            return DEFAULT_USER_PREFS;
        }
    },

    async saveUserPrefs(prefs: UserPrefs): Promise<void> {
        try {
            await AsyncStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.error('Failed to save user prefs', e);
        }
    },

    // Valid output is either AIGeneratedTarget[] or string[] (task IDs)
    async executeWithFallback<T>(
        operationName: string,
        prompt: string,
        parser: (text: string) => T
    ): Promise<T> {
        const apiKey = await this.getApiKey();
        if (!apiKey) throw new Error('API Key is missing');

        let currentModel = await this.getModelName();
        const models = [
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-1.0-pro'
        ];

        // Ensure current model is tried first
        const modelQueue = [currentModel, ...models.filter(m => m !== currentModel)];

        let lastError: any = null;

        for (const model of modelQueue) {
            try {
                console.log(`AI Service: Attempting ${operationName} with model ${model}...`);

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 10000
                            }
                        })
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json();
                    const errorMessage = errorData.error?.message || `Status ${response.status}`;

                    // Check for Rate Limit (429) or Service Unavailable (503)
                    if (response.status === 429 || errorMessage.includes('Resource has been exhausted')) {
                        console.warn(`AI Service: Rate limit hit on ${model}. Switching...`);
                        continue; // Try next model
                    }

                    throw new Error(errorMessage);
                }

                const data = await response.json();
                const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!textContent) throw new Error('Empty response from AI');

                // If successful, update the default model if we switched
                if (model !== currentModel) {
                    console.log(`AI Service: Successfully switched prompt to ${model}`);
                    await this.setModelName(model);
                }

                return parser(textContent);

            } catch (error: any) {
                console.error(`AI Service: Error with ${model}:`, error);
                lastError = error;
                // If it's not a connection/rate error, maybe we shouldn't retry? 
                // For now, let's simple retry everything to be safe.
            }
        }

        throw lastError || new Error(`All models failed for ${operationName}`);
    },

    async generateTargetsFromTasks(tasks: Task[]): Promise<AIGeneratedTarget[]> {
        const userPrefs = await this.getUserPrefs();
        const incompleteTasks = tasks.filter(t => !t.completed);

        if (incompleteTasks.length === 0) return [];

        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

        const prompt = `You are a productivity AI assistant for a task management app called "Target". 
        // ... (Prompt content truncated for brevity, use same prompt as before)
Your job is to analyze tasks and convert them into focused targets for the next day.

USER'S WORK PREFERENCES:
- Work starts at: ${userPrefs.workStartTime}
- Usual break duration: ${userPrefs.breakDuration} minutes
- Total work time: ${userPrefs.totalWorkTime} hours

TASKS TO ANALYZE:
${incompleteTasks.map((t, i) => `${i + 1}. [ID: ${t.id}] ${t.text}`).join('\n')}

RULES:
1. STRICTLY classify targets types:
   - "Quantity": for distinct actions (e.g., "Send email", "Call mom", "Submit report"). Value should be 1.
   - "Time": for continuous activities (e.g., "Study", "Read book", "Write code", "Workout"). Value should be duration in minutes (max 60).
2. If a task is too big, split it into multiple targets
3. If tasks are related, you can merge them into one target
4. Prioritize tasks by importance (1 = highest priority)
5. Skip tasks that seem unnecessary or can be marked complete without action
6. ONLY add "notes" if absolutely necessary (e.g., specific instructions, links, or critical reminders). Do not add casual or obvious notes.
7. Set reminder times based on user's work schedule

OUTPUT FORMAT (JSON array only, no markdown):
[
  {
    "title": "Target title",
    "type": "Time" or "Quantity",
    "targetValue": number (minutes if Time, generally 1 if Quantity),
    "notes": "Optional notes if critical",
    "reminderTime": "HH:MM format or null",
    "linkedTaskIds": ["task_id_1", "task_id_2"],
    "priority": 1
  }
]

Generate targets for tomorrow (${tomorrow}). Return ONLY the JSON array, no explanation.`;

        return this.executeWithFallback<AIGeneratedTarget[]>('generateTargets', prompt, (text) => {
            // Parse the JSON response (may have markdown code blocks)
            let jsonStr = text.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.slice(7);
            }
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.slice(3);
            }
            if (jsonStr.endsWith('```')) {
                jsonStr = jsonStr.slice(0, -3);
            }
            jsonStr = jsonStr.trim();

            return JSON.parse(jsonStr);
        });
    },

    async suggestUnnecessaryTasks(tasks: Task[]): Promise<string[]> {
        const incompleteTasks = tasks.filter(t => !t.completed);
        if (incompleteTasks.length === 0) return [];

        const prompt = `You are a strict task manager. Analyze this task list and identify tasks that are:
1. Gibberish or random letters (e.g., "xff", "asdf", "test")
2. Default tutorial tasks (e.g., "Welcome to your tasks", "Drag to reorder")
3. Vague or empty (e.g., "thing", ".")

TASKS:
${incompleteTasks.map((t, i) => `${i + 1}. [ID: ${t.id}] ${t.text}`).join('\n')}

Return ONLY a JSON array of the IDs of these unnecessary tasks. If all tasks look real and valid, return an empty array [].
Example Response: ["123", "456"]`;

        return this.executeWithFallback<string[]>('cleanupTasks', prompt, (text) => {
            console.log('AI Cleanup Raw Response:', text); // Debug log

            if (!text) return [];

            let jsonStr = text.trim();
            // Extract JSON array if embedded in text
            const firstBracket = jsonStr.indexOf('[');
            const lastBracket = jsonStr.lastIndexOf(']');

            if (firstBracket !== -1 && lastBracket !== -1) {
                jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
            } else {
                return [];
            }

            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                console.warn('AI Cleanup: Failed to parse JSON:', jsonStr);
                return [];
            }
        });
    },

    async testConnection(apiKey: string, modelName: string): Promise<boolean> {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "Hello" }] }],
                        generationConfig: { maxOutputTokens: 1 }
                    })
                }
            );
            return response.ok;
        } catch {
            return false;
        }
    }
};
