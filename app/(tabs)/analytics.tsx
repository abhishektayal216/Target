import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { addDays, format, startOfWeek, startOfYear, subDays } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target } from '../../components/TargetItem';
import { useTheme } from '../../context/ThemeContext';
import { HistoryLog, storage } from '../../utils/storage';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AnalyticsScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const [targets, setTargets] = useState<Target[]>([]);
    const [history, setHistory] = useState<HistoryLog[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        const [savedTargets, savedHistory] = await Promise.all([
            storage.loadTargets(),
            storage.getHistory()
        ]);
        setTargets(savedTargets);
        setHistory(savedHistory);
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    // --- Analytics Logic ---

    const stats = useMemo(() => {
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const todayDayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...

        // 1. Today's Snapshot - filter targets same as targets.tsx
        const todaysTargets = targets.filter(target => {
            if (target.frequency === 'Daily') return true;
            if (target.frequency === 'Once') {
                return target.assignedDate === todayStr;
            }
            if (target.frequency === 'Custom') {
                return target.customDays?.includes(todayDayOfWeek);
            }
            return false;
        });

        const completedToday = todaysTargets.filter(t => {
            const max = t.type === 'Time' ? t.targetValue * 60 : t.targetValue;
            return t.currentValue >= max;
        });

        // 2. Month/Year Progress (how much of the period has elapsed)
        const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const getDaysInYear = (date: Date) => {
            const year = date.getFullYear();
            return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
        };

        const dayOfMonth = now.getDate();
        const totalDaysInMonth = getDaysInMonth(now);
        const monthProgress = Math.round((dayOfMonth / totalDaysInMonth) * 100);

        const startOfYearDate = startOfYear(now);
        const dayOfYear = Math.floor((now.getTime() - startOfYearDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalDaysInYear = getDaysInYear(now);
        const yearProgress = Math.round((dayOfYear / totalDaysInYear) * 100);

        // 3. Weekly Activity - start from Monday (weekStartsOn: 1)
        // Show completed/total for each day
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekDays = Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(weekStart, i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayOfWeek = d.getDay();

            // Get targets applicable to this day
            const dayTargets = targets.filter(target => {
                if (target.frequency === 'Daily') return true;
                if (target.frequency === 'Once') return target.assignedDate === dateStr;
                if (target.frequency === 'Custom') return target.customDays?.includes(dayOfWeek);
                return false;
            });

            // Count completed logs for this day
            const completedCount = history.filter(h => h.dateStr === dateStr).length;

            return {
                dateStr,
                label: format(d, 'EEE'),
                dayNum: format(d, 'd'),
                completed: Math.min(completedCount, dayTargets.length),
                total: dayTargets.length
            };
        });

        // Weekly totals
        const weeklyCompleted = weekDays.reduce((sum, d) => sum + d.completed, 0);
        const weeklyTotal = weekDays.reduce((sum, d) => sum + d.total, 0);

        // 4. Streak
        let streak = 0;
        if (history.some(h => h.dateStr === todayStr)) {
            streak++;
        }
        for (let i = 1; i < 365; i++) {
            const dStr = format(subDays(now, i), 'yyyy-MM-dd');
            if (history.some(h => h.dateStr === dStr)) {
                streak++;
            } else {
                if (i === 1 && streak === 0) continue;
                break;
            }
        }

        return {
            completedToday: completedToday.length,
            totalToday: todaysTargets.length,
            monthProgress,
            yearProgress,
            monthName: format(now, 'MMMM'),
            yearName: format(now, 'yyyy'),
            weeklyData: weekDays,
            weeklyCompleted,
            weeklyTotal,
            streak
        };
    }, [targets, history]);

    // Set header with streak badge
    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={[{ backgroundColor: colors.primary + '20', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, marginRight: 16 }]}>
                    <Ionicons name="flame" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary }}>{stats.streak} Day Streak</Text>
                </View>
            ),
        });
    }, [navigation, stats.streak, colors]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Top Widgets: Month & Year - Simple Text */}
                <View style={styles.widgetsRow}>
                    <View style={[styles.widget, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.widgetValue, { color: colors.primary }]}>{stats.monthProgress}%</Text>
                        <Text style={[styles.widgetLabel, { color: colors.textSecondary }]}>{stats.monthName}</Text>
                    </View>
                    <View style={[styles.widget, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.widgetValue, { color: colors.secondary }]}>{stats.yearProgress}%</Text>
                        <Text style={[styles.widgetLabel, { color: colors.textSecondary }]}>{stats.yearName}</Text>
                    </View>
                </View>

                {/* Today Breakdown */}
                <View style={[styles.todayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View>
                        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Today's Success</Text>
                        <Text style={[styles.cardValue, { color: colors.text }]}>
                            {stats.completedToday}/{stats.totalToday}
                        </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={40} color={stats.completedToday === stats.totalToday && stats.totalToday > 0 ? colors.primary : colors.border} />
                </View>

                {/* Weekly - Simple List */}
                <View style={[styles.weeklyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>This Week</Text>
                    {stats.weeklyData.map((day, index) => (
                        <View key={index} style={styles.weeklyRow}>
                            <Text style={[styles.weeklyDay, { color: colors.textSecondary }]}>{day.label} {day.dayNum}</Text>
                            <Text style={[styles.weeklyCount, { color: day.completed > 0 ? colors.primary : colors.textSecondary }]}>
                                {day.total > 0 ? `${day.completed}/${day.total}` : '-'}
                            </Text>
                        </View>
                    ))}
                    <View style={[styles.weeklyRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Text style={[styles.weeklyDay, { color: colors.text, fontWeight: 'bold' }]}>Total</Text>
                        <Text style={[styles.weeklyCount, { color: colors.primary, fontWeight: 'bold' }]}>{stats.weeklyCompleted}/{stats.weeklyTotal}</Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    streakContainer: {
        alignItems: 'flex-end',
        marginBottom: 20,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    streakText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    widgetsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    widget: {
        flex: 1,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 1,
    },
    widgetValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    widgetLabel: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
    },
    todayCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    weeklyCard: {
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    weeklyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    weeklyDay: {
        fontSize: 14,
    },
    weeklyCount: {
        fontSize: 16,
        fontWeight: '600',
    },
});
