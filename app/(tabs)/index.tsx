import { Ionicons } from '@expo/vector-icons';
import { addDays, format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomSheet, { BottomSheetRef } from '../../components/CustomBottomSheet';
import { Target } from '../../components/TargetItem';
import TaskInput from '../../components/TaskInput';
import TaskItem, { Task } from '../../components/TaskItem';
import UserPrefsModal from '../../components/UserPrefsModal';
import { useTheme } from '../../context/ThemeContext';
import { aiService } from '../../utils/aiService';
import { storage } from '../../utils/storage';



export default function TasksScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  const loadInitialData = async () => {
    const savedTasks = await storage.loadTasks();
    if (savedTasks.length > 0) {
      setTasks(savedTasks);
    } else {
      // Fallback for first time users
      setTasks([
        { id: '1', text: 'Welcome to your tasks', completed: false },
        { id: '2', text: 'Drag me to reorder', completed: false },
      ]);
    }
  };

  useEffect(() => {
    if (tasks.length > 0) {
      storage.saveTasks(tasks);
    }
  }, [tasks]);

  const addTaskSheetRef = useRef<BottomSheetRef>(null);

  const addTask = (text: string) => {
    setTasks((prev) => [
      { id: Date.now().toString(), text, completed: false },
      ...prev,
    ]);
    addTaskSheetRef.current?.scrollTo(0); // Close on save
    Keyboard.dismiss();
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const editTask = (id: string, newText: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: newText } : t))
    );
  }

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const activeTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks]);

  const navigateToCompleted = () => {
    router.push({
      pathname: '/completed',
      params: { tasks: JSON.stringify(completedTasks) }
    });
  };

  const openAddSheet = () => {
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');
    addTaskSheetRef.current?.scrollTo(-SCREEN_HEIGHT / 2); // Larger sheet for text area
  };

  const handlePrefsComplete = () => {
    handleAutoAIWorkflow();
  };

  const handleAutoAIWorkflow = async () => {
    // 1. Validation
    const apiKey = await aiService.getApiKey();
    if (!apiKey) {
      Alert.alert('API Key Required', 'Please add your Gemini API key in Settings.');
      return;
    }

    const userPrefs = await aiService.getUserPrefs();
    if (!userPrefs.prefsCompleted) {
      setShowPrefsModal(true);
      return;
    }

    if (activeTasks.length === 0) {
      Alert.alert('No Tasks', 'Add some tasks first!');
      return;
    }

    setIsLoading(true);
    try {
      // 2. Auto Cleanup
      let currentTasks = [...tasks];
      let tasksToProcess = [...activeTasks];
      let cleanedCount = 0;

      try {
        const unnecessaryIds = await aiService.suggestUnnecessaryTasks(tasksToProcess);
        if (unnecessaryIds.length > 0) {
          cleanedCount = unnecessaryIds.length;
          // Update local state for processing
          currentTasks = currentTasks.map(t =>
            unnecessaryIds.includes(t.id) ? { ...t, completed: true, aiSuggested: true } : t
          );
          // Filter out the ones we just cleaned
          tasksToProcess = tasksToProcess.filter(t => !unnecessaryIds.includes(t.id));
        }
      } catch (e) {
        console.warn('Cleanup failed, proceeding to generation', e);
      }

      // 3. Generate Targets
      if (tasksToProcess.length === 0) {
        setTasks(currentTasks); // Save cleanup if any
        Alert.alert('Finished', `Cleaned ${cleanedCount} tasks. No remaining tasks to create targets.`);
        return;
      }

      const aiTargets = await aiService.generateTargetsFromTasks(tasksToProcess);

      if (aiTargets.length === 0 && cleanedCount === 0) {
        Alert.alert('AI Analysis', 'No targets generated and no cleanup needed.');
        return;
      }

      // 4. Persistence
      const existingTargets = await storage.loadTargets();
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const newTargets: Target[] = aiTargets.map((at, index) => ({
        id: `${Date.now()}-${index}`,
        title: at.title,
        type: at.type,
        targetValue: at.targetValue,
        currentValue: 0,
        startTime: null,
        frequency: 'Once' as const,
        assignedDate: tomorrow,
        notes: at.notes,
        reminderTime: at.reminderTime ? `${tomorrow}T${at.reminderTime}:00` : undefined,
        linkedTaskIds: at.linkedTaskIds,
        priority: at.priority,
      }));

      // Link tasks to targets
      const finalTasks = currentTasks.map(task => {
        const linkedTarget = newTargets.find(t => t.linkedTaskIds?.includes(task.id));
        if (linkedTarget) {
          return { ...task, linkedTargetId: linkedTarget.id };
        }
        return task;
      });

      await storage.saveTargets([...existingTargets, ...newTargets]);
      setTasks(finalTasks); // This saves tasks via useEffect

      // 5. Success Message
      let msg = '';
      if (cleanedCount > 0) msg += `Marked ${cleanedCount} tasks as unnecessary.\n`;
      if (newTargets.length > 0) msg += `Created ${newTargets.length} targets for tomorrow.`;

      Alert.alert(
        'AI Workflow Complete ⚡',
        msg,
        [
          { text: 'View Targets', onPress: () => router.push('/targets') },
          { text: 'OK' }
        ]
      );

    } catch (error: any) {
      console.error('AI Workflow Error:', error);
      Alert.alert('Error', error.message || 'AI processing failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Task>) => {
    return (
      <ScaleDecorator>
        <TaskItem
          task={item}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onEdit={editTask}
          drag={drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>

      <GestureHandlerRootView style={{ flex: 1 }}>
        <DraggableFlatList
          data={activeTasks}
          onDragEnd={({ data }) => {
            setTasks([...data, ...completedTasks]);
          }}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      </GestureHandlerRootView>

      <View style={styles.footerContainer}>
        {completedTasks.length > 0 && (
          <TouchableOpacity
            style={[styles.completedButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={navigateToCompleted}
          >
            <Text style={[styles.footerText, { color: colors.primary }]}>
              {completedTasks.length} Completed
            </Text>
          </TouchableOpacity>
        )}

        {/* AI Convert Button */}
        <TouchableOpacity
          style={[styles.aiButton, { backgroundColor: colors.secondary }]}
          onPress={handleAutoAIWorkflow}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#FFF" />
              <Text style={styles.aiButtonText}>AI</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={openAddSheet}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      </View>

      <BottomSheet ref={addTaskSheetRef}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 10 }}>New Task</Text>
            <TaskInput onAddTask={addTask} />
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* User Preferences Modal */}
      <UserPrefsModal
        visible={showPrefsModal}
        onClose={() => setShowPrefsModal(false)}
        onComplete={handlePrefsComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
    zIndex: 10,
    gap: 12,
  },
  completedButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 'auto',
  },
  aiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  aiButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600'
  }
});
