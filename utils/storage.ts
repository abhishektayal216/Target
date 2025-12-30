import AsyncStorage from '@react-native-async-storage/async-storage';

const TASKS_KEY = '@tasks_data';
const TARGETS_KEY = '@targets_data';
const LOGS_KEY = '@target_logs';

export interface HistoryLog {
    id: string; // unique log id
    targetId: string;
    targetTitle: string;
    timestamp: number;
    valueChange: number; // e.g. +1 or +5 minutes (in seconds if Time)
    dateStr: string; // YYYY-MM-DD for easy querying
}

export const storage = {
    async saveTasks(tasks: any[]) {
        try {
            await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        } catch (e) {
            console.error('Failed to save tasks', e);
        }
    },

    async loadTasks(): Promise<any[]> {
        try {
            const data = await AsyncStorage.getItem(TASKS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load tasks', e);
            return [];
        }
    },

    async saveTargets(targets: any[]) {
        try {
            await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
        } catch (e) {
            console.error('Failed to save targets', e);
        }
    },

    async loadTargets(): Promise<any[]> {
        try {
            const data = await AsyncStorage.getItem(TARGETS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load targets', e);
            return [];
        }
    },

    async getHistory(): Promise<HistoryLog[]> {
        try {
            const data = await AsyncStorage.getItem(LOGS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load history', e);
            return [];
        }
    },

    async logActivity(log: HistoryLog) {
        try {
            const logs = await this.getHistory();
            logs.push(log);
            await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs));
        } catch (e) {
            console.error('Failed to log activity', e);
        }
    },

    async completeTasksByTargetId(targetId: string): Promise<number> {
        try {
            const tasks = await this.loadTasks();
            let completedCount = 0;

            const updatedTasks = tasks.map(task => {
                if (task.linkedTargetId === targetId && !task.completed) {
                    completedCount++;
                    return { ...task, completed: true };
                }
                return task;
            });

            if (completedCount > 0) {
                await this.saveTasks(updatedTasks);
            }

            return completedCount;
        } catch (e) {
            console.error('Failed to complete tasks by target ID', e);
            return 0;
        }
    }
};
