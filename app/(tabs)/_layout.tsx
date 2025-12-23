import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const { colors, toggleTheme, theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.card,
          shadowOpacity: 0.3,
          elevation: 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border
        },
        headerRight: () => (
          <TouchableOpacity onPress={toggleTheme} style={{ marginRight: 16 }}>
            <Ionicons name={theme === 'dark' ? 'sunny' : 'moon'} size={24} color={colors.text} />
          </TouchableOpacity>
        ),
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          ...Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="targets"
        options={({ navigation }) => ({
          title: 'Targets',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'rocket' : 'rocket-outline'} size={24} color={color} />
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 16 }}>
              <TouchableOpacity onPress={toggleTheme}>
                <Ionicons name={theme === 'dark' ? 'sunny' : 'moon'} size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('analytics')}
              >
                <Ionicons name="stats-chart" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          )
        })}
      />
      <Tabs.Screen
        name="analytics"
        options={({ navigation }) => ({
          title: 'Analytics',
          href: null,
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate('targets')} style={{ marginLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        })}
      />
    </Tabs>
  );
}
