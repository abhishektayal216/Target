import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomSheet, { BottomSheetRef } from '../../components/CustomBottomSheet';
import TaskInput from '../../components/TaskInput';
import TaskItem, { Task } from '../../components/TaskItem';
import { useTheme } from '../../context/ThemeContext';
import { storage } from '../../utils/storage';



export default function TasksScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

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
    bottom: 75,
    left: 0,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
    zIndex: 10,
  },
  completedButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 'auto',
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
