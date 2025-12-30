import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';

interface TaskInputProps {
    onAddTask: (text: string) => void;
}

export default function TaskInput({ onAddTask }: TaskInputProps) {
    const { colors, theme } = useTheme();
    const [text, setText] = useState('');

    const handleAdd = () => {
        if (text.trim()) {
            onAddTask(text.trim());
            setText('');
            Keyboard.dismiss();
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.card }]}>
            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: theme === 'dark' ? '#2C2C2E' : '#F0F0F5',
                        color: colors.text,
                    },
                ]}
                placeholder="Add a new task..."
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
            />
            <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary, opacity: text.trim() ? 1 : 0.5 }]}
                onPress={handleAdd}
                disabled={!text.trim()}>
                <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
        gap: 12,
    },
    input: {
        minHeight: 80,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    saveButton: {
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'flex-end',
        width: '100%',
    },
    saveText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
