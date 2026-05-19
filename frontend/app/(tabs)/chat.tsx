import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Platform,
  Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView
} from 'react-native';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, MessageCircle } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, radius, spacing, shadows } from '../../src/theme';
import { t } from '../../src/i18n';
import AnimatedPressable from '../../src/components/AnimatedPressable';


type Msg = { id: string; role: 'user' | 'assistant'; content: string; timestamp: string };

export default function ChatScreen() {
  const { language } = useAuth();
  const L = t(language);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading: initialLoading } = useQuery({
    queryKey: ['chatHistory'],
    queryFn: async () => {
      const r = await api.get('/chat/history');
      return r.data.messages as Msg[];
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const keyboard = useAnimatedKeyboard();

  const inputAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(-keyboard.height.value + 20, {
            damping: 18,
            stiffness: 160,
          }),
        },
        {
          scale: withSpring(keyboard.height.value > 0 ? 1.03 : 1),
        },
      ],
    };
  });

  useEffect(() => {
    const s1 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbVisible(true));
    const s2 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbVisible(false));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, loading]);

  const send = async () => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { id: 'tmp-' + Date.now(), role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    
    queryClient.setQueryData(['chatHistory'], (old: Msg[] = []) => [...old, userMsg]);
    
    const payload = text.trim();
    setText('');
    setLoading(true);
    try {
      const r = await api.post('/chat/send', { message: payload, language });
      queryClient.setQueryData(['chatHistory'], (old: Msg[] = []) => [
        ...old.filter((x) => x.id !== userMsg.id),
        r.data.user_message, r.data.ai_message,
      ]);
    } catch (e: any) {
      Alert.alert(L.error, e?.response?.data?.detail || 'AI error');
      queryClient.setQueryData(['chatHistory'], (old: Msg[] = []) => old.filter((x) => x.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    Alert.alert(L.clearChat, L.confirmClear, [
      { text: L.cancel, style: 'cancel' },
      {
        text: L.yes, style: 'destructive', onPress: async () => {
          try { 
            await api.delete('/chat/history'); 
            queryClient.setQueryData(['chatHistory'], []);
          } catch { }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{L.chatTitle}</Text>
          <Text style={styles.subtitle}>{language === 'tr' ? 'Sağlık asistanın 7/24 yanında' : 'Your health assistant 24/7'}</Text>
        </View>
        {messages.length > 0 && (
          <AnimatedPressable testID="clear-chat-button" style={styles.clearBtn} onPress={clearHistory}>
            <Trash2 size={18} color={colors.error} />
          </AnimatedPressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={120}
      >
        <View style={{ flex: 1 }}>
          {initialLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} />
          ) : messages.length === 0 ? (
            <View testID="chat-empty" style={styles.empty}>
              <View style={styles.emptyIcon}><MessageCircle size={36} color={colors.primary} /></View>
              <Text style={styles.emptyText}>{L.chatEmpty}</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: 20 }}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <View
                  testID={`msg-${item.role}-${index}`}
                  style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}
                >
                  {item.role === 'user' ? (
                    <Text style={styles.userText}>{item.content}</Text>
                  ) : (
                    <Markdown style={markdownStyles}>
                      {item.content}
                    </Markdown>
                  )}
                  <Text style={[styles.time, item.role === 'user' && { color: 'rgba(0,0,0,0.5)' }]}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
              ListFooterComponent={
                loading ? (
                  <View testID="typing-indicator" style={[styles.bubble, styles.bubbleAi]}>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <View style={styles.dot} />
                      <View style={styles.dot} />
                      <View style={styles.dot} />
                    </View>
                  </View>
                ) : null
              }
            />
          )}

          <Animated.View style={[styles.inputRow, inputAnimStyle]}>
            <TextInput
              testID="chat-input"
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={L.chatPlaceholder}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />
            <AnimatedPressable testID="chat-send-button" style={[styles.sendBtn, (!text.trim() || loading) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || loading}>
              <Send size={18} color={colors.textMain} />
            </AnimatedPressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.textMain },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
  clearBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FCEAEA', justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8F5FA', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '600' },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 20, marginBottom: 12 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadows.card },
  userText: { color: colors.textMain, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  aiText: { color: colors.textMain, fontSize: 15, lineHeight: 21 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end', fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: colors.base,
    shadowColor: '#60C7E8',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: 14, fontSize: 15, color: colors.textMain,
    maxHeight: 120, ...shadows.card,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadows.card },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
});

const markdownStyles = {
  body: { color: colors.textMain, fontSize: 15, lineHeight: 21 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  list_item: { marginBottom: 4 },
  strong: { fontWeight: 'bold' as const },
};
