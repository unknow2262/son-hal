import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Pill, MessageCircle, MapPin, User, FileText } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { colors } from '../../src/theme';
import { useAuth } from '../../src/AuthContext';
import { t } from '../../src/i18n';

import AnimatedPressable from '../../src/components/AnimatedPressable';

const makeTabButton = (testID: string) => (props: any) => {
  return (
    <AnimatedPressable
      {...props}
      testID={testID}
      scaleTo={0.8}
      style={[props.style, { justifyContent: 'center', alignItems: 'center', height: 64 }]}
    >
      {props.children}
    </AnimatedPressable>
  );
};

export default function TabsLayout() {
  const { language } = useAuth();
  const L = t(language);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        safeAreaInsets: { bottom: 0, top: 0, left: 0, right: 0 },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          height: 64,
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: '#000000',
          bottom: 24,
          left: 24,
          right: 24,
          borderRadius: 40,
          borderTopWidth: 0,
          elevation: 10,
          height: 64,
          paddingHorizontal: 8,
          paddingBottom: 0,
          paddingTop: 0,
          shadowColor: '#A0AEC0',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: L.home,
          tabBarIcon: ({ focused }) => (
            <View style={{ backgroundColor: focused ? colors.primary : 'transparent', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 }}>
              <Home size={22} color={focused ? '#000000' : '#FFFFFF'} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarButton: makeTabButton('tab-home'),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: L.medications,
          tabBarIcon: ({ focused }) => (
            <View style={{ backgroundColor: focused ? colors.primary : 'transparent', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 }}>
              <Pill size={22} color={focused ? '#000000' : '#FFFFFF'} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarButton: makeTabButton('tab-medications'),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: L.chat,
          tabBarIcon: ({ focused }) => (
            <View style={{ backgroundColor: focused ? colors.primary : 'transparent', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 }}>
              <MessageCircle size={22} color={focused ? '#000000' : '#FFFFFF'} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarButton: makeTabButton('tab-chat'),
        }}
      />
      <Tabs.Screen
        name="lab-test"
        options={{
          title: L.scanLabTest || 'Tahlil',
          tabBarIcon: ({ focused }) => (
            <View style={{ backgroundColor: focused ? colors.primary : 'transparent', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 }}>
              <FileText size={22} color={focused ? '#000000' : '#FFFFFF'} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarButton: makeTabButton('tab-lab-test'),
        }}
      />
      <Tabs.Screen
        name="pharmacy"
        options={{
          title: L.pharmacy,
          tabBarIcon: ({ focused }) => (
            <View style={{ backgroundColor: focused ? colors.primary : 'transparent', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 }}>
              <MapPin size={22} color={focused ? '#000000' : '#FFFFFF'} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarButton: makeTabButton('tab-pharmacy'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: L.profile,
          tabBarIcon: ({ focused }) => (
            <View style={{ backgroundColor: focused ? colors.primary : 'transparent', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 }}>
              <User size={22} color={focused ? '#000000' : '#FFFFFF'} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarButton: makeTabButton('tab-profile'),
        }}
      />
    </Tabs>
  );
}
