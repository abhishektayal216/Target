import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, format } from 'date-fns';
import { Task } from '../components/TaskItem';

const AI_API_KEY = '@ai_api_key';
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
            const model = await AsyncStorage.getItem('@ai_model_name');
            return model || 'gemini-2.5-flash';
        } catch {
            return 'gemini-2.5-flash';
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

    async generateTargetsFromTasks(tasks: Task[]): Promise<AIGeneratedTarget[]> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('API key not configured. Please add your Gemini API key in Settings.');
        }

        const modelName = await this.getModelName();
        const userPrefs = await this.getUserPrefs();
        const incompleteTasks = tasks.filter(t => !t.completed);

        if (incompleteTasks.length === 0) {
            return [];
        }

        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

        const prompt = `You are a productivity AI assistant for a task management app called "Target". 
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

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 10000,
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API request failed');
            }

            const data = await response.json();
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textContent) {
                throw new Error('No response from AI');
            }

            // Parse the JSON response (may have markdown code blocks)
            let jsonStr = textContent.trim();
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

            const targets: AIGeneratedTarget[] = JSON.parse(jsonStr);
            return targets;
        } catch (error: any) {
            console.error('AI API Error:', error);
            throw new Error(error.message || 'Failed to generate targets');
        }
    },

    async suggestUnnecessaryTasks(tasks: Task[]): Promise<string[]> {
        const apiKey = await this.getApiKey();
        if (!apiKey) throw new Error('API Key is missing');

        const modelName = await this.getModelName();
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

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 10000 }
                    })
                }
            );

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `API Error: ${response.status}`);
            }

            const data = await response.json();
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

            console.log('AI Cleanup Raw Response:', textContent); // Debug log

            if (!textContent) return [];

            let jsonStr = textContent.trim();

            // Extract JSON array if embedded in text
            const firstBracket = jsonStr.indexOf('[');
            const lastBracket = jsonStr.lastIndexOf(']');

            if (firstBracket !== -1 && lastBracket !== -1) {
                jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
            } else {
                console.warn('AI Cleanup: No JSON array found in response');
                return [];
            }

            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                console.warn('AI Cleanup: Failed to parse JSON:', jsonStr);
                return [];
            }
        } catch (error: any) {
            console.error('AI Cleanup Error:', error);
            throw error; // Propagate error to UI
        }
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
