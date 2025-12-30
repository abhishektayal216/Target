import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { aiService, UserPrefs } from '../utils/aiService';

interface UserPrefsModalProps {
    visible: boolean;
    onClose: () => void;
    onComplete: (prefs: UserPrefs) => void;
}

export default function UserPrefsModal({ visible, onClose, onComplete }: UserPrefsModalProps) {
    const { colors } = useTheme();
    const [workStartTime, setWorkStartTime] = useState('09:00');
    const [breakDuration, setBreakDuration] = useState('15');
    const [totalWorkTime, setTotalWorkTime] = useState('8');

    useEffect(() => {
        loadExistingPrefs();
    }, [visible]);

    const loadExistingPrefs = async () => {
        const prefs = await aiService.getUserPrefs();
        setWorkStartTime(prefs.workStartTime);
        setBreakDuration(prefs.breakDuration.toString());
        setTotalWorkTime(prefs.totalWorkTime.toString());
    };

    const handleSave = async () => {
        const prefs: UserPrefs = {
            workStartTime,
            breakDuration: parseInt(breakDuration) || 15,
            totalWorkTime: parseInt(totalWorkTime) || 8,
            prefsCompleted: true,
        };
        await aiService.saveUserPrefs(prefs);
        onComplete(prefs);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modal, { backgroundColor: colors.card }]}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>
                                <Ionicons name="person-circle-outline" size={24} color={colors.primary} /> Work Preferences
                            </Text>
                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                Help AI understand your work patterns to create better targets
                            </Text>
                        </View>

                        {/* Work Start Time */}
                        <View style={styles.field}>
                            <Text style={[styles.label, { color: colors.text }]}>
                                <Ionicons name="time-outline" size={16} color={colors.primary} /> When do you usually start working?
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="e.g., 09:00"
                                placeholderTextColor={colors.textSecondary}
                                value={workStartTime}
                                onChangeText={setWorkStartTime}
                            />
                        </View>

                        {/* Break Duration */}
                        <View style={styles.field}>
                            <Text style={[styles.label, { color: colors.text }]}>
                                <Ionicons name="cafe-outline" size={16} color={colors.primary} /> Usual break duration (minutes)?
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="e.g., 15"
                                placeholderTextColor={colors.textSecondary}
                                value={breakDuration}
                                onChangeText={setBreakDuration}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Total Work Time */}
                        <View style={styles.field}>
                            <Text style={[styles.label, { color: colors.text }]}>
                                <Ionicons name="hourglass-outline" size={16} color={colors.primary} /> Total work hours per day?
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="e.g., 8"
                                placeholderTextColor={colors.textSecondary}
                                value={totalWorkTime}
                                onChangeText={setTotalWorkTime}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.skipButton, { borderColor: colors.border }]}
                                onPress={onClose}
                            >
                                <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                onPress={handleSave}
                            >
                                <Text style={styles.saveText}>Save Preferences</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        width: '100%',
        maxHeight: '80%',
        borderRadius: 16,
        padding: 20,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    field: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    skipButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    skipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
