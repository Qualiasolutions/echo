import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AnalyticsData } from '../types';

export const useAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalConversations: 0,
    totalMessages: 0,
    avgConfidence: 0,
    avgSentiment: 0,
    handoffRate: 0,
    responseTime: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch conversations count
      const { count: conversationsCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      // Fetch messages count
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      // Fetch average confidence and sentiment from messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('confidence, sentiment')
        .not('confidence', 'is', null);

      let avgConfidence = 0;
      let avgSentiment = 0;
      if (messagesData && messagesData.length > 0) {
        const validMessages = messagesData.filter(m => m.confidence !== null && m.sentiment !== null);
        if (validMessages.length > 0) {
          avgConfidence = validMessages.reduce((sum, m) => sum + (m.confidence || 0), 0) / validMessages.length;
          avgSentiment = validMessages.reduce((sum, m) => sum + (m.sentiment || 0), 0) / validMessages.length;
        }
      }

      // Fetch handoff count
      const { count: handoffCount } = await supabase
        .from('handoffs')
        .select('*', { count: 'exact', head: true });

      // Calculate handoff rate
      const handoffRate = conversationsCount ? (handoffCount || 0) / conversationsCount : 0;

      // Fetch average response time from analytics
      const { data: analyticsData } = await supabase
        .from('analytics')
        .select('metric_value')
        .eq('metric_name', 'response_time');

      let responseTime = 0;
      if (analyticsData && analyticsData.length > 0) {
        responseTime = analyticsData.reduce((sum, a) => sum + (a.metric_value || 0), 0) / analyticsData.length;
      }

      setAnalytics({
        totalConversations: conversationsCount || 0,
        totalMessages: messagesCount || 0,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        handoffRate: Math.round(handoffRate * 100) / 100,
        responseTime: Math.round(responseTime)
      });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // Subscribe to real-time updates
    const conversationsChannel = supabase
      .channel('analytics-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchAnalytics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchAnalytics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'handoffs' }, () => {
        fetchAnalytics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, []);

  return { analytics, isLoading, error, refetch: fetchAnalytics };
};
