import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';

export interface Task {
    id: string;
    text: string;
    completed: boolean;
}

interface TaskItemProps {
    task: Task;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (id: string, newText: string) => void;
    drag?: () => void;
    isActive?: boolean;
}

export default function TaskItem({ task, onToggle, onDelete, onEdit, drag, isActive }: TaskItemProps) {
    const { colors } = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(task.text);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
        }
    }, [isEditing]);

    const handleFinishEdit = () => {
        setIsEditing(false);
        if (editText.trim() !== task.text) {
            onEdit(task.id, editText.trim());
        }
    };

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: isActive ? colors.border : colors.card,
                    borderColor: colors.border
                }
            ]}
        >
            <TouchableOpacity onPress={() => onToggle(task.id)} style={styles.checkContainer}>
                <Ionicons
                    name={task.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={task.completed ? colors.primary : colors.textSecondary}
                />
            </TouchableOpacity>

            {isEditing ? (
                <TextInput
                    ref={inputRef}
                    style={[styles.input, { color: colors.text }]}
                    value={editText}
                    onChangeText={setEditText}
                    onBlur={handleFinishEdit}
                    onSubmitEditing={handleFinishEdit}
                />
            ) : (
                <TouchableOpacity style={styles.textContainer} onPress={() => setIsEditing(true)}>
                    <Text
                        style={[
                            styles.text,
                            {
                                color: task.completed ? colors.textSecondary : colors.text,
                                textDecorationLine: task.completed ? 'line-through' : 'none',
                            },
                        ]}>
                        {task.text}
                    </Text>
                </TouchableOpacity>
            )}

            {drag && !isEditing && (
                <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
                    <Ionicons name="reorder-two" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => onDelete(task.id)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    checkContainer: {
        marginRight: 10,
    },
    textContainer: {
        flex: 1,
    },
    text: {
        fontSize: 14,
    },
    input: {
        flex: 1,
        fontSize: 14,
        padding: 0,
    },
    dragHandle: {
        padding: 6,
    },
    deleteButton: {
        padding: 6,
        marginLeft: 2
    }
});
