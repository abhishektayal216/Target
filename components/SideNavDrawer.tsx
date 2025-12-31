import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { aiService } from '../utils/aiService';

import { useTheme } from '../context/ThemeContext';
import UserPrefsModal from './UserPrefsModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.8;

const AI_API_KEY = '@ai_api_key';
const AI_MODEL_KEY = '@ai_model_name';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface SideNavRef {
    open: () => void;
    close: () => void;
}

interface SideNavDrawerProps {
    onClose?: () => void;
}

const SideNavDrawer = forwardRef<SideNavRef, SideNavDrawerProps>(({ onClose }, ref) => {
    const { colors, theme } = useTheme();
    const [apiKey, setApiKey] = useState('');
    const [modelName, setModelName] = useState(DEFAULT_MODEL);
    const [showApiKey, setShowApiKey] = useState(false);
    const [storageSize, setStorageSize] = useState('Calculating...');
    const [isVisible, setIsVisible] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [showPrefsModal, setShowPrefsModal] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    const translateX = useSharedValue(-DRAWER_WIDTH);

    useImperativeHandle(ref, () => ({
        open: () => {
            setIsVisible(true);
            translateX.value = withTiming(0, { duration: 300 });
        },
        close: () => {
            translateX.value = withTiming(-DRAWER_WIDTH, { duration: 300 }, () => {
                runOnJS(setIsVisible)(false);
            });
        }
    }));

    useEffect(() => {
        loadSettings();
        calculateStorageSize();
    }, []);

    const loadSettings = async () => {
        try {
            const key = await AsyncStorage.getItem(AI_API_KEY);
            if (key) {
                setApiKey(key);
                // Auto-test on load if key exists
                // testKeyConnection(key, DEFAULT_MODEL); // Optional: avoid testing on every load to save quota
            }

            const model = await AsyncStorage.getItem(AI_MODEL_KEY);
            if (model) setModelName(model);
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const testKeyConnection = async (key: string, model: string) => {
        if (!key) {
            setTestStatus('idle');
            return;
        }
        setTestStatus('testing');
        const isValid = await aiService.testConnection(key, model);
        setTestStatus(isValid ? 'success' : 'error');
    };

    const saveApiKey = async (key: string) => {
        try {
            setApiKey(key);
            setTestStatus('idle');
            await AsyncStorage.setItem(AI_API_KEY, key);
        } catch (e) {
            console.error('Failed to save API key', e);
        }
    };

    const saveModelName = async (name: string) => {
        try {
            setModelName(name);
            await AsyncStorage.setItem(AI_MODEL_KEY, name);
        } catch (e) {
            console.error('Failed to save model name', e);
        }
    };

    const calculateStorageSize = async () => {
        try {
            const keys = await AsyncStorage.getAllKeys();
            let totalSize = 0;
            for (const key of keys) {
                const value = await AsyncStorage.getItem(key);
                if (value) {
                    totalSize += new Blob([value]).size;
                }
            }
            // Format size
            if (totalSize < 1024) {
                setStorageSize(`${totalSize} B`);
            } else if (totalSize < 1024 * 1024) {
                setStorageSize(`${(totalSize / 1024).toFixed(2)} KB`);
            } else {
                setStorageSize(`${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
            }
        } catch (e) {
            setStorageSize('Error calculating');
            console.error('Failed to calculate storage size', e);
        }
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    const handleClose = () => {
        translateX.value = withTiming(-DRAWER_WIDTH, { duration: 300 }, () => {
            runOnJS(setIsVisible)(false);
            if (onClose) runOnJS(onClose)();
        });
    };

    if (!isVisible) return null;

    if (!isVisible) return null;

    // ... (existing code) ...

    return (
        <View style={styles.overlay}>
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={handleClose}
            />
            <Animated.View style={[styles.drawer, { backgroundColor: colors.card }, animatedStyle]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                    <TouchableOpacity onPress={handleClose}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* AI API Key Section */}
                {/* ... (existing AI API Key section) ... */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        <Ionicons name="key-outline" size={16} color={colors.primary} /> AI Model Key
                    </Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: testStatus === 'error' ? 'red' : (testStatus === 'success' ? 'green' : colors.border)
                            }]}
                            placeholder="Enter Gemini API Key"
                            placeholderTextColor={colors.textSecondary}
                            value={apiKey}
                            onChangeText={saveApiKey}
                            onEndEditing={() => testKeyConnection(apiKey, modelName)}
                            secureTextEntry={!showApiKey}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowApiKey(!showApiKey)}
                        >
                            <Ionicons
                                name={showApiKey ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <Text style={[styles.hint, { color: colors.textSecondary, flex: 1 }]}>
                            {testStatus === 'testing' ? 'Checking key...' :
                                testStatus === 'success' ? '✅ Key is valid' :
                                    testStatus === 'error' ? '❌ Invalid key' : 'Get key from Google AI Studio'}
                        </Text>

                        <TouchableOpacity
                            style={{
                                backgroundColor: colors.primary,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16,
                                opacity: apiKey ? 1 : 0.5
                            }}
                            onPress={() => testKeyConnection(apiKey, modelName)}
                            disabled={!apiKey}
                        >
                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Test Key</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* AI Model Name Section */}
                {/* AI Model Name Section */}
                <View style={[styles.section, { paddingTop: 0 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} /> AI Model Name
                    </Text>

                    <TouchableOpacity
                        style={[styles.dropdownButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                        onPress={() => setShowModelDropdown(!showModelDropdown)}
                    >
                        <Text style={{ color: colors.text }}>{modelName}</Text>
                        <Ionicons name={showModelDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {showModelDropdown && (
                        <View style={[styles.dropdownList, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            {['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash'].map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.dropdownItem, {
                                        backgroundColor: modelName === m ? colors.primary + '20' : 'transparent',
                                        borderBottomColor: colors.border,
                                        borderBottomWidth: 1
                                    }]}
                                    onPress={() => {
                                        saveModelName(m);
                                        setShowModelDropdown(false);
                                    }}
                                >
                                    <Text style={{
                                        color: modelName === m ? colors.primary : colors.text,
                                        fontWeight: modelName === m ? 'bold' : 'normal'
                                    }}>
                                        {m}
                                    </Text>
                                    {modelName === m && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Work Preferences Section */}
                <View style={[styles.section, { paddingTop: 0 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        <Ionicons name="person-circle-outline" size={16} color={colors.primary} /> Personalization
                    </Text>
                    <TouchableOpacity
                        style={[styles.prefButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                        onPress={() => setShowPrefsModal(true)}
                    >
                        <Text style={{ color: colors.text }}>Edit Work Patterns</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Storage Size Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        <Ionicons name="folder-outline" size={16} color={colors.primary} /> Storage Used
                    </Text>
                    <View style={[styles.storageCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Ionicons name="server-outline" size={24} color={colors.primary} />
                        <Text style={[styles.storageSize, { color: colors.text }]}>{storageSize}</Text>
                    </View>
                    <TouchableOpacity onPress={calculateStorageSize}>
                        <Text style={[styles.refreshLink, { color: colors.primary }]}>Refresh</Text>
                    </TouchableOpacity>
                </View>

                {/* App Info */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.appName, { color: colors.textSecondary }]}>Target - Saathi</Text>
                    <Text style={[styles.version, { color: colors.textSecondary }]}>v1.0.0</Text>
                </View>
            </Animated.View>

            <UserPrefsModal
                visible={showPrefsModal}
                onClose={() => setShowPrefsModal(false)}
                onComplete={() => setShowPrefsModal(false)}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    // ... (existing styles) ...
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingTop: 50,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    inputContainer: {
        position: 'relative',
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        paddingRight: 44,
        fontSize: 14,
    },
    eyeButton: {
        position: 'absolute',
        right: 12,
        top: 12,
    },
    hint: {
        fontSize: 12,
        marginTop: 8,
    },
    prefButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    storageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    storageSize: {
        fontSize: 18,
        fontWeight: '600',
    },
    refreshLink: {
        fontSize: 12,
        marginTop: 8,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    appName: {
        fontSize: 14,
        fontWeight: '600',
    },
    version: {
        fontSize: 12,
        marginTop: 4,
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
    },
    dropdownList: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    dropdownItem: {
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});

export default SideNavDrawer;
