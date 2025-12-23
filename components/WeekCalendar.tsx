import { Ionicons } from '@expo/vector-icons';
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';

interface WeekCalendarProps {
    onDateSelect: (date: Date) => void;
    selectedDate: Date;
}

export default function WeekCalendar({ onDateSelect, selectedDate }: WeekCalendarProps) {
    const { colors } = useTheme();
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [weekDays, setWeekDays] = useState<Date[]>([]);

    useEffect(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(currentWeekStart, i));
        }
        setWeekDays(days);
    }, [currentWeekStart]);

    const nextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
    const prevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={prevWeek} style={styles.navButton}>
                    <Ionicons name="chevron-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.monthText, { color: colors.text }]}>
                    {format(currentWeekStart, 'MMMM yyyy')}
                </Text>
                <TouchableOpacity onPress={nextWeek} style={styles.navButton}>
                    <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {weekDays.map((date, index) => {
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                        <TouchableOpacity
                            key={index}
                            onPress={() => onDateSelect(date)}
                            style={[
                                styles.dayButton,
                                {
                                    backgroundColor: isSelected ? colors.primary : colors.card,
                                    borderColor: isSelected ? colors.primary : colors.border,
                                },
                            ]}>
                            <Text
                                style={[
                                    styles.dayName,
                                    { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                                ]}>
                                {format(date, 'EEE')}
                            </Text>
                            <Text
                                style={[
                                    styles.dayNumber,
                                    { color: isSelected ? '#FFFFFF' : colors.text },
                                ]}>
                                {format(date, 'd')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    monthText: {
        fontSize: 14,
        fontWeight: '600',
    },
    navButton: {
        padding: 4,
    },
    scrollContent: {
        paddingHorizontal: 12,
        gap: 8,
    },
    dayButton: {
        width: 48,
        height: 64,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    dayName: {
        fontSize: 10,
        marginBottom: 4,
        fontWeight: '600',
    },
    dayNumber: {
        fontSize: 16,
        fontWeight: '700',
    },
});
