import React, { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { Dimensions, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';


import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLY = -SCREEN_HEIGHT;

export interface BottomSheetRef {
    scrollTo: (y: number) => void;
    isActive: () => boolean;
}

interface BottomSheetProps {
    children?: React.ReactNode;
}

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(({ children }, ref) => {
    const { colors, theme } = useTheme();
    const translateY = useSharedValue(0);
    const active = useSharedValue(false);
    const context = useSharedValue({ y: 0 });
    const keyboardOffset = useSharedValue(0);

    const scrollTo = useCallback((destination: number) => {
        'worklet';
        active.value = destination !== 0;
        translateY.value = withSpring(destination, { damping: 50 });
    }, []);

    const isActive = useCallback(() => {
        return active.value;
    }, []);

    useImperativeHandle(ref, () => ({ scrollTo, isActive }), [scrollTo, isActive]);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = Keyboard.addListener(showEvent, (e) => {
            if (active.value) {
                // Move up by 80% of keyboard height to be less aggressive
                keyboardOffset.value = withTiming(-e.endCoordinates.height * 0.8, { duration: 300 });
            }
        });

        const onHide = Keyboard.addListener(hideEvent, () => {
            keyboardOffset.value = withTiming(0, { duration: 300 });
        });

        return () => {
            onShow.remove();
            onHide.remove();
        };
    }, []);

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
            // Dismiss keyboard on drag start
            if (keyboardOffset.value !== 0) {
                Keyboard.dismiss();
            }
        })
        .onUpdate((event) => {
            translateY.value = event.translationY + context.value.y;
            translateY.value = Math.max(translateY.value, MAX_TRANSLY);
        })
        .onEnd(() => {
            if (translateY.value > -SCREEN_HEIGHT / 3) {
                scrollTo(0);
            } else {
                scrollTo(-SCREEN_HEIGHT / 2); // Reduced height: Snap to ~50%
            }
        });

    const rBottomSheetStyle = useAnimatedStyle(() => {
        // Clamp the final position so it doesn't fly off the top of the screen
        // -SCREEN_HEIGHT + 80 ensures there's always a gap at the top.
        const clampedTranslateY = Math.max(translateY.value + keyboardOffset.value, MAX_TRANSLY);
        return {
            transform: [{ translateY: clampedTranslateY }],
        };
    });

    return (
        <Animated.View
            style={[
                styles.bottomSheetContainer,
                rBottomSheetStyle,
                { backgroundColor: colors.card, shadowColor: colors.text },
            ]}>
            <GestureDetector gesture={gesture}>
                <View style={styles.dragHandle}>
                    <View style={styles.line} />
                </View>
            </GestureDetector>
            {children}
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    bottomSheetContainer: {
        height: SCREEN_HEIGHT,
        width: '100%',
        position: 'absolute',
        top: SCREEN_HEIGHT,
        borderRadius: 25,
        zIndex: 100,
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 50,
        padding: 2,
    },
    dragHandle: {
        width: '100%',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    line: {
        width: 75,
        height: 4,
        backgroundColor: 'grey',
        borderRadius: 2,
    },
});

export default BottomSheet;
