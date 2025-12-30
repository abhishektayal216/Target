import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomSheet, { BottomSheetRef } from '../../components/CustomBottomSheet';
import FocusModal from '../../components/FocusModal';
import TargetItem, { Target } from '../../components/TargetItem';
import WeekCalendar from '../../components/WeekCalendar';
import { useTheme } from '../../context/ThemeContext';
import { cancelReminder, registerForPushNotificationsAsync, scheduleReminder } from '../../utils/notifications';
import { storage } from '../../utils/storage';

export default function TargetsScreen() {
    const { colors } = useTheme();

    // -- State --
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [targets, setTargets] = useState<Target[]>([]);

    useFocusEffect(
        useCallback(() => {
            loadInitialData();
        }, [])
    );

    const loadInitialData = async () => {
        const savedTargets = await storage.loadTargets();
        setTargets(savedTargets);
    };

    useEffect(() => {
        if (targets.length > 0) {
            storage.saveTargets(targets);
        }
    }, [targets]);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'Quantity' | 'Time'>('Quantity');
    const [quantity, setQuantity] = useState('');
    const [frequency, setFrequency] = useState<'Once' | 'Daily' | 'Custom'>('Once');
    const [customDays, setCustomDays] = useState<number[]>([]);
    const [notes, setNotes] = useState('');
    const [reminderTime, setReminderTime] = useState<Date | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [enableReminder, setEnableReminder] = useState(false);

    useEffect(() => {
        registerForPushNotificationsAsync();
    }, []);

    const bottomSheetRef = useRef<BottomSheetRef>(null);

    // -- Filtering --
    const filteredTargets = useMemo(() => {
        const sDateStr = format(selectedDate, 'yyyy-MM-dd');
        return targets.filter(target => {
            if (target.frequency === 'Daily') return true;
            if (target.frequency === 'Once') {
                return target.assignedDate === sDateStr;
            }
            if (target.frequency === 'Custom') {
                return target.customDays?.includes(selectedDate.getDay());
            }
            return false;
        });
    }, [targets, selectedDate]);


    const openBottomSheet = (targetToEdit?: Target) => {
        if (targetToEdit) {
            setEditingId(targetToEdit.id);
            setTitle(targetToEdit.title);
            setType(targetToEdit.type);
            setQuantity(targetToEdit.targetValue.toString());
            setFrequency(targetToEdit.frequency);
            setCustomDays(targetToEdit.customDays || []);
            setNotes(targetToEdit.notes || '');
            setReminderTime(targetToEdit.reminderTime ? new Date(targetToEdit.reminderTime) : null);
            setEnableReminder(!!targetToEdit.reminderTime);
        } else {
            setEditingId(null);
            setTitle('');
            setType('Quantity');
            setQuantity('');
            setFrequency('Once');
            setCustomDays([]);
            setNotes('');
            setReminderTime(null);
            setEnableReminder(false);
        }
        const { height: SCREEN_HEIGHT } = Dimensions.get('window');
        bottomSheetRef.current?.scrollTo(-SCREEN_HEIGHT / 1.3);
    };

    const closeBottomSheet = () => {
        bottomSheetRef.current?.scrollTo(0);
    };

    const saveTarget = async () => {
        if (!title || !quantity) return;
        const val = parseFloat(quantity) || 0;

        // Cancel old reminder if editing
        if (editingId) {
            const existing = targets.find(t => t.id === editingId);
            if (existing?.notificationId) {
                await cancelReminder(existing.notificationId);
            }
        }

        const newTargetBase = {
            title,
            type,
            targetValue: val,
            frequency,
            customDays: frequency === 'Custom' ? customDays : undefined,
            assignedDate: frequency === 'Once' ? format(selectedDate, 'yyyy-MM-dd') : undefined,
            notes,
            reminderTime: enableReminder && reminderTime ? reminderTime.toISOString() : undefined,
        };

        // Schedule new reminder
        const notifId = await scheduleReminder(newTargetBase);

        if (editingId) {
            setTargets(prev => prev.map(t => {
                if (t.id === editingId) {
                    return {
                        ...t,
                        ...newTargetBase,
                        notificationId: notifId || undefined,
                        reminderTime: newTargetBase.reminderTime // Ensure types match
                    };
                }
                return t;
            }));
        } else {
            const newTarget: Target = {
                id: Date.now().toString(),
                ...newTargetBase,
                currentValue: 0,
                startTime: null,
                notificationId: notifId || undefined,
            };
            setTargets(prev => [...prev, newTarget]);
        }
        closeBottomSheet();
    };

    const toggleCustomDay = (dayIndex: number) => {
        setCustomDays(prev => {
            if (prev.includes(dayIndex)) return prev.filter(d => d !== dayIndex);
            return [...prev, dayIndex];
        });
    };

    // Actions
    const updateTargetValue = async (id: string, newVal: number) => {
        const target = targets.find(t => t.id === id);
        if (!target) return;

        const diff = newVal - target.currentValue;

        if (diff > 0) {
            await storage.logActivity({
                id: Date.now().toString(),
                targetId: id,
                targetTitle: target.title,
                timestamp: Date.now(),
                valueChange: diff,
                dateStr: format(new Date(), 'yyyy-MM-dd')
            });
        }

        // Check if target is completed
        if (newVal >= target.targetValue) {
            await storage.completeTasksByTargetId(id);
        }

        setTargets(prev => prev.map(t => t.id === id ? { ...t, currentValue: newVal } : t));
    };

    const [focusedTarget, setFocusedTarget] = useState<Target | null>(null);
    const [isFocusModalVisible, setIsFocusModalVisible] = useState(false);

    const handleToggleTimer = async (target: Target) => {
        // Whether starting or resuming, just open the modal.
        // We set the startTime if it's not set.
        if (!target.startTime) {
            const updated = targets.map(t =>
                t.id === target.id ? { ...t, startTime: Date.now() } : t
            );
            setTargets(updated);
            // storage.saveTargets(updated); // Effect will handle save
        }
        setFocusedTarget(target);
        setIsFocusModalVisible(true);
    };

    const handleStopFocus = async (sessionSeconds: number) => {
        if (!focusedTarget) return;

        // 1. Calculate new values
        const newValue = focusedTarget.currentValue + sessionSeconds;

        // 2. Log activity (using our existing update logic which logs if diff > 0)
        // We can manually call updateTargetValue or replicate logic.
        // Let's reuse updateTargetValue for consistency.
        await updateTargetValue(focusedTarget.id, newValue);

        // 3. Clear start time
        setTargets(prev => prev.map(t =>
            t.id === focusedTarget.id ? { ...t, startTime: null } : t
        ));

        setIsFocusModalVisible(false);
        setFocusedTarget(null);
    };

    const deleteTarget = async (id: string) => {
        const t = targets.find(i => i.id === id);
        if (t?.notificationId) {
            await cancelReminder(t.notificationId);
        }
        setTargets(prev => prev.filter(t => t.id !== id));
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>


            <View style={styles.calendarContainer}>
                <WeekCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </View>

            <View style={styles.content}>
                {filteredTargets.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No targets for {format(selectedDate, 'MMM d')}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredTargets}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <TargetItem
                                target={item}
                                onUpdate={updateTargetValue}
                                onToggleTimer={handleToggleTimer}
                                onDelete={deleteTarget}
                                onEdit={openBottomSheet}
                            />
                        )}
                    />
                )}
            </View>

            <View style={styles.footerContainer}>
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={() => openBottomSheet()}
                >
                    <Ionicons name="add" size={32} color="#FFF" />
                </TouchableOpacity>
            </View>

            <BottomSheet ref={bottomSheetRef}>
                <ScrollView
                    style={styles.sheetContent}
                    contentContainerStyle={{ paddingBottom: Dimensions.get('window').height * 0.5 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>
                        {editingId ? 'Edit Target' : 'New Target'}
                    </Text>

                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        placeholder="Target Title"
                        placeholderTextColor={colors.textSecondary}
                        value={title}
                        onChangeText={setTitle}
                    />

                    <View style={styles.row}>
                        {['Quantity', 'Time'].map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: type === t ? colors.primary : colors.background,
                                        borderColor: colors.border,
                                        borderWidth: 1
                                    }
                                ]}
                                onPress={() => {
                                    setType(t as 'Quantity' | 'Time');
                                    if (!editingId) setQuantity('');
                                }}
                            >
                                <Text style={[styles.chipText, { color: type === t ? '#FFF' : colors.text }]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        placeholder={type === 'Time' ? "Duration (mins)" : "Quantity"}
                        placeholderTextColor={colors.textSecondary}
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                    />

                    <View style={[styles.row, { marginBottom: 8 }]}>
                        <Text style={{ color: colors.textSecondary, marginRight: 8, fontSize: 12 }}>Freq:</Text>
                        {['Once', 'Daily', 'Custom'].map((f) => {
                            let label = f === 'Once' ? `Today (${format(selectedDate, 'MMM d')})` : f;
                            if (editingId && f === 'Once' && frequency === 'Once') label = "Single Date";
                            return (
                                <TouchableOpacity
                                    key={f}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: frequency === f ? colors.secondary : colors.background,
                                            borderColor: colors.border,
                                            borderWidth: 1
                                        }
                                    ]}
                                    onPress={() => setFrequency(f as any)}
                                >
                                    <Text style={[styles.chipText, { color: frequency === f ? '#FFF' : colors.text }]}>{label}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>

                    {frequency === 'Custom' && (
                        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 16 }]}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                                const isSelected = customDays.includes(idx);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[
                                            styles.dayCircle,
                                            {
                                                backgroundColor: isSelected ? colors.primary : colors.background,
                                                borderColor: isSelected ? colors.primary : colors.border
                                            }
                                        ]}
                                        onPress={() => toggleCustomDay(idx)}
                                    >
                                        <Text style={{ color: isSelected ? '#FFF' : colors.text, fontSize: 12 }}>{day}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    )}

                    <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 12 }}>Notes</Text>
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        placeholder="Add extra details..."
                        placeholderTextColor={colors.textSecondary}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                    />

                    <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 20 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="notifications-outline" size={20} color={colors.text} style={{ marginRight: 8 }} />
                            <Text style={{ color: colors.text }}>Set Reminder</Text>
                        </View>
                        <TouchableOpacity onPress={() => setEnableReminder(!enableReminder)}>
                            <Ionicons name={enableReminder ? "checkbox" : "square-outline"} size={24} color={enableReminder ? colors.primary : colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {enableReminder && (
                        <View style={{ marginBottom: 20 }}>
                            <TouchableOpacity
                                onPress={() => setShowTimePicker(true)}
                                style={{
                                    padding: 12,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 8,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: colors.text }}>
                                    {reminderTime ? format(reminderTime, 'h:mm a') : 'Pick Time'}
                                </Text>
                            </TouchableOpacity>
                            {showTimePicker && (
                                <DateTimePicker
                                    value={reminderTime || new Date()}
                                    mode="time"
                                    display="default"
                                    onChange={(event, selected) => {
                                        setShowTimePicker(false);
                                        if (selected) setReminderTime(selected);
                                    }}
                                />
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: colors.primary, opacity: title && quantity ? 1 : 0.5 }]}
                        onPress={saveTarget}
                        disabled={!title || !quantity}
                    >
                        <Text style={styles.saveButtonText}>{editingId ? 'Update Target' : 'Save Target'}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </BottomSheet>

            <FocusModal
                visible={isFocusModalVisible}
                target={focusedTarget}
                onStop={handleStopFocus}
                onClose={() => setIsFocusModalVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    calendarContainer: {
        paddingVertical: 10,
    },
    content: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 80,
    },
    emptyText: {
        fontSize: 14,
    },
    footerContainer: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 24,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'box-none',
        zIndex: 10,
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
    sheetContent: {
        paddingHorizontal: 16,
        flex: 1,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        fontSize: 14,
        height: 40,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        minWidth: 60,
        alignItems: 'center'
    },
    chipText: {
        fontSize: 12,
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButton: {
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    }
});
