import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Target } from './TargetItem';

interface FocusModalProps {
    visible: boolean;
    target: Target | null;
    onStop: (elapsedSeconds: number) => void;
    onClose: () => void;
}

const { width } = Dimensions.get('window');
const HOLD_DURATION = 1500; // 1.5 seconds to stop

export default function FocusModal({ visible, target, onStop, onClose }: FocusModalProps) {
    const { colors } = useTheme();
    const [seconds, setSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Hold to stop logic
    const [isHolding, setIsHolding] = useState(false);
    const holdAnim = useRef(new Animated.Value(0)).current;
    const holdTimer = useRef<any>(null);

    useEffect(() => {
        let interval: any;
        if (visible && !isPaused) {
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [visible, isPaused]);

    useEffect(() => {
        if (!visible) {
            setSeconds(0);
            setIsPaused(false);
            setIsHolding(false);
            holdAnim.setValue(0);
        } else if (target) {
            // Resume from existing progress if needed, but for now we track session duration
            // You might want to pass 'initialSeconds' if resuming
        }
    }, [visible, target]);

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const startHold = () => {
        setIsHolding(true);
        Animated.timing(holdAnim, {
            toValue: 1,
            duration: HOLD_DURATION,
            useNativeDriver: false,
        }).start();

        holdTimer.current = setTimeout(() => {
            handleComplete();
        }, HOLD_DURATION);
    };

    const cancelHold = () => {
        setIsHolding(false);
        Animated.timing(holdAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();

        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
    };

    const handleComplete = () => {
        onStop(seconds);
        onClose();
    };

    if (!target) return null;

    const progressWidth = holdAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%']
    });

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.minimizeBtn}>
                        <Ionicons name="chevron-down" size={32} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.targetTitle, { color: colors.text }]}>{target.title}</Text>
                    <View style={{ width: 32 }} />
                </View>

                {/* Main Timer */}
                <View style={styles.timerContainer}>
                    <Text style={[styles.timerText, { color: colors.text }]}>
                        {formatTime(target.currentValue + seconds)}
                    </Text>
                    <Text style={[styles.subText, { color: colors.textSecondary }]}>
                        Target: {target.targetValue} mins
                    </Text>
                </View>

                {/* Controls */}
                <View style={styles.controls}>
                    <Pressable
                        onPressIn={startHold}
                        onPressOut={cancelHold}
                        style={[styles.stopDataButton, { borderColor: colors.primary }]}
                    >
                        <View style={[styles.stopButtonContent, { backgroundColor: colors.card }]}>
                            <Animated.View style={[
                                styles.fill,
                                {
                                    backgroundColor: colors.primary,
                                    width: progressWidth
                                }
                            ]} />
                            <Text style={[styles.stopText, { color: colors.text }]}>
                                {isHolding ? "Keep Holding..." : "Hold to Stop"}
                            </Text>
                        </View>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    minimizeBtn: {
        padding: 8,
    },
    targetTitle: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    timerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 80,
    },
    timerText: {
        fontSize: 80,
        fontWeight: '200',
        fontVariant: ['tabular-nums'],
    },
    subText: {
        fontSize: 18,
        marginTop: 16,
    },
    controls: {
        position: 'absolute',
        bottom: 80,
        width: '100%',
        alignItems: 'center',
    },
    stopDataButton: {
        width: width - 48,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 1,
    },
    stopButtonContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
    },
    stopText: {
        fontSize: 18,
        fontWeight: 'bold',
        zIndex: 1,
    }
});
