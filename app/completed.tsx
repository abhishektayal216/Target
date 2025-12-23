import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Task } from '../components/TaskItem'; // We can reuse TaskItem but disable features
import { useTheme } from '../context/ThemeContext';

export default function CompletedTasksScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse tasks from params (naive approach for this demo, better to use Context/Store)
    // Since we don't have a global store yet, we will pass data or mock it.
    // Actually, for proper state sync, we should move Tasks to Context.
    // BUT, to keep it simple and clean as requested, I will implement a text message or a simple list if passed.
    // Given the complexity of passing large list via params, I'll recommend creating a TaskContext later.
    // For now, I'll parse the stringified tasks if available, or just show a placeholder if this was real app without store.
    // Wait, I can pass them via a simple global store or just Context.
    // Let's create a simple TaskContext to solve this properly, otherwise "Deleted" tasks logic is hard.

    // Actually, I'll just accept that this screen might need to be connected to a Context.
    // To avoid refactoring EVERYTHING into Context right this second (risky), I will assume data is passed or I'll implement a context in next step if needed.
    // For now, let's use a context approach for Tasks is best, but I will stick to the plan:
    // "Screen to display only completed tasks"
    // user said: "new screen should show all that task"

    // To update `index.tsx` and this screen efficiently, I should probably hoist state.
    // BUT, for now, I will use `useLocalSearchParams` with a JSON string. It's dirty but fast for small lists.
    // If list is large, context is needed. I'll implement TaskContext in next step if this fails or feels too hacky.
    // Better: I will create a simple TasksContext now? No, that's a big refactor.
    // I will assume I can pass data via params for now.

    const tasksString = params.tasks as string;
    const tasks: Task[] = tasksString ? JSON.parse(tasksString) : [];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'Completed Tasks', headerBackTitle: 'Back' }} />

            {tasks.length === 0 ? (
                <View style={styles.center}>
                    <Text style={{ color: colors.textSecondary }}>No completed tasks found.</Text>
                </View>
            ) : (
                <FlatList
                    data={tasks}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                            <Text style={[styles.text, { color: colors.textSecondary, textDecorationLine: 'line-through' }]}>{item.text}</Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContent: {
        padding: 16,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        opacity: 0.8
    },
    text: {
        fontSize: 16,
        marginLeft: 12,
    }
});
