import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, MessageSquare, Users, Phone, Clock, Activity } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';

interface IntentData {
  intent: string;
  count: number;
}

interface SentimentData {
  name: string;
  value: number;
  color: string;
}

export const AnalyticsDashboard = () => {
  const { analytics, isLoading, error } = useAnalytics();
  const [intentData, setIntentData] = useState<IntentData[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchIntentDistribution();
    fetchSentimentDistribution();
    fetchRecentActivity();

    // Real-time subscription for recent activity
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setRecentActivity(prev => [payload.new, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchIntentDistribution = async () => {
    const { data } = await supabase
      .from('messages')
      .select('intent')
      .not('intent', 'is', null);

    if (data) {
      const intentCounts = data.reduce((acc: any, msg) => {
        const intent = msg.intent || 'unknown';
        acc[intent] = (acc[intent] || 0) + 1;
        return acc;
      }, {});

      const formattedData = Object.entries(intentCounts).map(([intent, count]) => ({
        intent: intent.charAt(0).toUpperCase() + intent.slice(1).replace(/_/g, ' '),
        count: count as number
      }));

      setIntentData(formattedData);
    }
  };

  const fetchSentimentDistribution = async () => {
    const { data } = await supabase
      .from('messages')
      .select('sentiment')
      .not('sentiment', 'is', null);

    if (data) {
      const positive = data.filter(m => m.sentiment > 0.6).length;
      const neutral = data.filter(m => m.sentiment >= 0.4 && m.sentiment <= 0.6).length;
      const negative = data.filter(m => m.sentiment < 0.4).length;

      setSentimentData([
        { name: 'Positive', value: positive, color: '#10B981' },
        { name: 'Neutral', value: neutral, color: '#3B82F6' },
        { name: 'Negative', value: negative, color: '#EF4444' }
      ]);
    }
  };

  const fetchRecentActivity = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (data) {
      setRecentActivity(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading analytics: {error}
      </div>
    );
  }

  // Calculate max for intent chart scaling
  const maxIntentCount = Math.max(...intentData.map(d => d.count), 1);

  // Calculate total for sentiment percentages
  const totalSentiment = sentimentData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Activity className="w-4 h-4 animate-pulse text-green-500" />
          <span>Live Updates</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Conversations */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Conversations</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{analytics.totalConversations}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Total Messages */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Messages</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{analytics.totalMessages}</p>
            </div>
            <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-violet-500" />
            </div>
          </div>
        </div>

        {/* Handoff Rate */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Handoff Rate</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{(analytics.handoffRate * 100).toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-amber-500" />
            </div>
          </div>
        </div>

        {/* Avg Confidence */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Confidence</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{(analytics.avgConfidence * 100).toFixed(0)}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        {/* Avg Sentiment */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Sentiment</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{analytics.avgSentiment.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.avgSentiment > 0.6 ? 'Positive' : analytics.avgSentiment > 0.4 ? 'Neutral' : 'Negative'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              analytics.avgSentiment > 0.6 ? 'bg-green-100' : analytics.avgSentiment > 0.4 ? 'bg-blue-100' : 'bg-red-100'
            }`}>
              <Activity className={`w-6 h-6 ${
                analytics.avgSentiment > 0.6 ? 'text-green-500' : analytics.avgSentiment > 0.4 ? 'text-blue-500' : 'text-red-500'
              }`} />
            </div>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{analytics.responseTime}ms</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intent Distribution - CSS Bar Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Intent Distribution</h3>
          {intentData.length > 0 ? (
            <div className="space-y-4">
              {intentData.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.intent}</span>
                    <span className="text-sm text-gray-600">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-violet-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / maxIntentCount) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data available yet
            </div>
          )}
        </div>

        {/* Sentiment Distribution - CSS Donut Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Sentiment Distribution</h3>
          {totalSentiment > 0 ? (
            <div className="flex flex-col items-center">
              {/* Donut Chart */}
              <div className="relative w-48 h-48 mb-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {(() => {
                    let cumulativePercent = 0;
                    return sentimentData.map((item, index) => {
                      const percent = item.value / totalSentiment;
                      const dashArray = `${percent * 283} 283`; // 283 is circumference of circle with r=45
                      const rotation = cumulativePercent * 360;
                      cumulativePercent += percent;
                      
                      return (
                        <circle
                          key={index}
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke={item.color}
                          strokeWidth="10"
                          strokeDasharray={dashArray}
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            transformOrigin: '50% 50%',
                            transition: 'all 0.5s ease'
                          }}
                        />
                      );
                    });
                  })()}
                  {/* Center circle for donut effect */}
                  <circle cx="50" cy="50" r="35" fill="white" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{totalSentiment}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="grid grid-cols-3 gap-4 w-full">
                {sentimentData.map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    </div>
                    <p className="text-lg font-bold text-gray-800">{item.value}</p>
                    <p className="text-xs text-gray-500">
                      {totalSentiment > 0 ? ((item.value / totalSentiment) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No data available yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity (Live)</h3>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div key={activity.id || index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.role === 'user' ? 'bg-blue-100' : 'bg-violet-100'
                }`}>
                  {activity.role === 'user' ? (
                    <Users className="w-4 h-4 text-blue-500" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-violet-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {activity.role === 'user' ? 'User' : 'Echo'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{activity.content}</p>
                  {activity.intent && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {activity.intent}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-400 py-8">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
