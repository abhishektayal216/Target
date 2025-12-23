import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true, // Added missing property
        shouldShowList: true    // Added missing property
    }),
});

export const registerForPushNotificationsAsync = async () => {
    let token;
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            // alert('Failed to get push token for push notification!');
            return;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }
    } catch (e) {
        console.warn("Notification registration failed (likely Expo Go limitation):", e);
    }

    return token;
};

export const scheduleReminder = async (target: any) => {
    if (!target.reminderTime) return null;

    const triggerDate = new Date(target.reminderTime);

    let trigger: Notifications.NotificationTriggerInput = null;

    if (target.frequency === 'Once') {
        const now = new Date();
        // If trigger date is in past, add 24h? Or just dont schedule? 
        // For 'Once', it implies a specific date. If specific date is past, we can't schedule.
        // But if we just picked "Time", we might assume "Next occurrence".
        // Let's assume if it's 'Once' and date is passed, it won't fire. 
        // However, standard date picker returns today's date with set time. 
        if (triggerDate <= now) {
            // If time is earlier today, maybe schedule for tomorrow? 
            // Without full date picker, this is ambiguous. 
            // Let's treat it as a DateTrigger.
        }
        trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate
        };
    } else if (target.frequency === 'Daily' || target.frequency === 'Custom') {
        // For Custom, we treat as daily for now as per plan
        trigger = {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: triggerDate.getHours(),
            minute: triggerDate.getMinutes(),
            repeats: true
        };
    }

    if (trigger) {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: "Target Reminder",
                body: `Time for: ${target.title}`,
                sound: true,
            },
            trigger,
        });
        return id;
    }
    return null;
};

export const cancelReminder = async (notificationId: string) => {
    if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
};
