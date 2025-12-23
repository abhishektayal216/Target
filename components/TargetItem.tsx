import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';

export interface Target {
    id: string;
    title: string;
    type: 'Quantity' | 'Time';
    targetValue: number;
    currentValue: number;
    startTime?: number | null;
    frequency: 'Once' | 'Daily' | 'Custom';
    assignedDate?: string;
    customDays?: number[];
    notes?: string;
    reminderTime?: string; // ISO string
    notificationId?: string;
}

interface TargetItemProps {
    target: Target;
    onUpdate: (id: string, newValue: number) => void;
    onToggleTimer: (target: Target) => void; // Renamed from onStartFocus
    onDelete: (id: string) => void;
    onEdit: (target: Target) => void;
}

export default function TargetItem({ target, onUpdate, onToggleTimer, onDelete, onEdit }: TargetItemProps) {
    const { colors } = useTheme();

    const [displayValue, setDisplayValue] = useState(target.currentValue);

    useEffect(() => {
        let interval: any;
        if (target.type === 'Time' && target.startTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const session = (now - target.startTime!) / 1000;
                const totalSeconds = target.currentValue + session;
                const targetSeconds = target.targetValue * 60;

                // Auto-stop when target is reached
                if (totalSeconds >= targetSeconds) {
                    setDisplayValue(targetSeconds);
                    onToggleTimer(target); // This will stop the timer
                } else {
                    setDisplayValue(totalSeconds);
                }
            }, 1000);
        } else {
            setDisplayValue(target.currentValue);
        }
        return () => clearInterval(interval);
    }, [target.currentValue, target.startTime, target.type, target.targetValue, onToggleTimer]);


    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (n: number) => n.toString().padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${pad(m)}:${pad(s)}`;
    };

    const getProgress = () => {
        const targetSecs = target.type === 'Time' ? target.targetValue * 60 : target.targetValue;
        return Math.min((displayValue / targetSecs) * 100, 100);
    };

    const progress = getProgress();

    const handleAction = () => {
        if (target.type === 'Time') {
            onToggleTimer(target);
        } else {
            // Cap at targetValue
            if (target.currentValue < target.targetValue) {
                onUpdate(target.id, target.currentValue + 1);
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Top Row */}
            <View style={styles.topRow}>
                <View style={[styles.iconBox, { backgroundColor: target.type === 'Time' ? colors.primary + '20' : colors.secondary + '20' }]}>
                    <Ionicons
                        name={target.type === 'Time' ? "timer-outline" : "stats-chart-outline"}
                        size={20}
                        color={target.type === 'Time' ? colors.primary : colors.secondary}
                    />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {target.title}
                        {target.reminderTime && (
                            <Ionicons name="notifications" size={12} color={colors.primary} style={{ marginLeft: 6 }} />
                        )}
                        {target.notes && (
                            <Ionicons name="document-text" size={12} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                        )}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>{target.frequency}</Text>
                </View>

                <View style={styles.menuActions}>
                    <TouchableOpacity onPress={() => onEdit(target)} style={styles.iconHitArea}>
                        <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(target.id)} style={styles.iconHitArea}>
                        <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Middle: Notes & Progress */}
            <View style={styles.progressContainer}>
                {target.notes ? (
                    <Text style={[styles.notesText, { color: colors.textSecondary }]}>{target.notes}</Text>
                ) : null}

                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: target.type === 'Time' ? colors.primary : colors.secondary }]} />
                </View>
            </View>

            {/* Bottom: Stats + Action Button */}
            <View style={styles.bottomRow}>
                <View>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                        {target.type === 'Time' ? formatTime(displayValue) : Math.floor(displayValue)}
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 'normal' }}> / {target.type === 'Time' ? `${target.targetValue}m` : target.targetValue}</Text>
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        {
                            backgroundColor: target.type === 'Time' ? (target.startTime ? colors.card : colors.primary) : (progress >= 100 ? colors.border : colors.secondary),
                            borderColor: target.type === 'Time' ? colors.primary : (progress >= 100 ? colors.border : colors.secondary),
                            borderWidth: target.type === 'Time' && target.startTime ? 1 : 0,
                            opacity: (target.type !== 'Time' && progress >= 100) ? 0.6 : 1
                        }
                    ]}
                    onPress={handleAction}
                    disabled={target.type !== 'Time' && progress >= 100}
                >
                    {target.type === 'Time' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons
                                name={target.startTime ? "pause" : "play"}
                                size={16}
                                color={target.startTime ? colors.primary : "#FFF"}
                            />
                            <Text style={[styles.btnText, { color: target.startTime ? colors.primary : '#FFF' }]}>
                                {target.startTime ? "Pause" : "Start"}
                            </Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {progress >= 100 && <Ionicons name="checkmark" size={16} color="#FFF" />}
                            <Text style={styles.btnText}>{progress >= 100 ? "Done" : "+1 Log"}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
    },
    menuActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconHitArea: {
        padding: 6,
    },
    progressContainer: {
        marginBottom: 12,
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    actionButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notesText: {
        fontSize: 12,
        marginBottom: 8,
        fontStyle: 'italic',
    },
    btnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 12,
    },
});
