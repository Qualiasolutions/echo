# Echo AI Voice Agent - Technical Documentation

## System Architecture

### Overview
```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
│  ┌────────────────┐    ┌──────────────┐   ┌──────────────┐ │
│  │  React UI      │◄──►│ Web Speech   │   │ Supabase JS  │ │
│  │  Components    │    │ API          │   │ Client       │ │
│  └────────────────┘    └──────────────┘   └──────┬───────┘ │
└─────────────────────────────────────────────────┬───────────┘
                                                  │
                                                  │ HTTPS
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Backend                        │
│  ┌────────────────┐    ┌──────────────┐   ┌──────────────┐ │
│  │  PostgreSQL    │◄──►│ Edge         │   │ Row Level    │ │
│  │  Database      │    │ Functions    │   │ Security     │ │
│  └────────────────┘    └──────────────┘   └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Voice Interaction Flow:**
```
1. User clicks microphone
2. Web Speech API starts listening
3. User speaks → Browser transcribes to text
4. Text sent to Supabase Edge Function
5. Edge Function:
   - Analyzes intent and sentiment
   - Generates AI response
   - Stores messages in database
   - Returns response
6. Frontend receives response
7. Updates UI with text
8. Triggers Text-to-Speech
9. Browser speaks response
```

**Text Interaction Flow:**
```
1. User types message
2. Frontend validates input
3. Message sent to Supabase Edge Function
4. Edge Function processes (same as voice)
5. Response returned to frontend
6. UI updated with text
7. TTS speaks response (optional)
```

## Frontend Architecture

### Technology Stack
- **React 18.3**: UI framework
- **TypeScript 5.6**: Type safety
- **Vite 6.2**: Build tool and dev server
- **Tailwind CSS 3.4**: Utility-first styling
- **Lucide React**: SVG icons
- **Supabase JS 2.77**: Backend client

### Project Structure
```
echo-voice-agent/
├── public/
│   └── images/          # Echo branding assets
├── src/
│   ├── components/      # React components
│   │   ├── Header.tsx
│   │   ├── VoiceInterface.tsx
│   │   ├── ConversationView.tsx
│   │   └── ControlPanel.tsx
│   ├── hooks/          # Custom React hooks
│   │   ├── useVoice.ts
│   │   └── useConversation.ts
│   ├── lib/            # Utilities
│   │   └── supabase.ts
│   ├── types/          # TypeScript definitions
│   │   ├── index.ts
│   │   └── speech.d.ts
│   ├── App.tsx         # Main application
│   └── main.tsx        # Entry point
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── vercel.json         # Deployment config
```

### Key Components

#### VoiceInterface Component
**Purpose**: Central microphone button with visual feedback

**State Management**:
- `isListening`: User is speaking
- `isSpeaking`: Echo is speaking
- `isProcessing`: Waiting for AI response

**Visual States**:
- Idle: Blue-violet gradient
- Listening: Blue with pulse animation
- Processing: Purple with loading spinner
- Speaking: Green with pulse animation

**Props**:
```typescript
interface VoiceInterfaceProps {
  voiceState: VoiceState;
  onMicClick: () => void;
  onStopClick: () => void;
}
```

#### ConversationView Component
**Purpose**: Display chat history

**Features**:
- Auto-scroll to latest message
- Different styling for user vs AI
- Timestamp display
- Loading indicator
- Empty state message

**Props**:
```typescript
interface ConversationViewProps {
  messages: Message[];
  isLoading: boolean;
}
```

#### ControlPanel Component
**Purpose**: Settings and controls

**Features**:
- Volume slider
- Settings dropdown (language, speech rate)
- Human handoff button
- Status indicators

**Props**:
```typescript
interface ControlPanelProps {
  onHandoffRequest: () => void;
  handoffRequested: boolean;
}
```

### Custom Hooks

#### useVoice Hook
**Purpose**: Manage Web Speech API

**Functions**:
```typescript
{
  voiceState: VoiceState;           // Current state
  isSupported: boolean;              // Browser support
  startListening: (callback) => void; // Start STT
  stopListening: () => void;         // Stop STT
  speak: (text: string) => void;     // TTS
  stopSpeaking: () => void;          // Stop TTS
  setProcessing: (bool) => void;     // Update state
}
```

**Implementation Details**:
- Initializes SpeechRecognition (with webkit prefix fallback)
- Configures continuous: false, interimResults: false
- Handles browser compatibility
- Manages event listeners (onstart, onresult, onerror, onend)

#### useConversation Hook
**Purpose**: Manage conversation state and API calls

**Functions**:
```typescript
{
  messages: Message[];                   // Conversation history
  isLoading: boolean;                   // API call in progress
  error: string | null;                 // Error state
  sendMessage: (content) => Promise;    // Send to AI
  clearMessages: () => void;            // Reset conversation
}
```

**Implementation Details**:
- Calls Supabase Edge Function
- Updates local state immediately (optimistic UI)
- Handles errors gracefully
- Returns ChatResponse for further processing

### Type Definitions

```typescript
// Core types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  confidence?: number;
  sentiment?: number;
  timestamp: Date;
}

interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error?: string;
}

interface ChatResponse {
  response: string;
  intent: string;
  confidence: number;
  sentiment: number;
  handoffNeeded: boolean;
  suggestions: string[];
}
```

## Backend Architecture

### Database Schema

#### conversations
**Purpose**: Track conversation sessions

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  channel TEXT DEFAULT 'voice',
  language TEXT DEFAULT 'en',
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**: session_id (unique)
**RLS**: Public read/write (demo mode)

#### messages
**Purpose**: Store individual messages with analysis

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  intent TEXT,
  confidence NUMERIC,
  sentiment NUMERIC,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
```

**Indexes**: session_id, timestamp
**RLS**: Public read/write

#### analytics
**Purpose**: Store performance metrics

```sql
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
```

**Common Metrics**:
- response_time
- intent_detected
- confidence_score
- sentiment_score

#### handoffs
**Purpose**: Track human escalations

```sql
CREATE TABLE handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  context_summary TEXT,
  collected_data JSONB DEFAULT '{}'::jsonb,
  sentiment_score NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

**Status Values**: pending, in_progress, resolved

#### agent_settings
**Purpose**: Configuration storage

```sql
CREATE TABLE agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Edge Functions

#### chat-response Function
**Location**: `/supabase/functions/chat-response/index.ts`

**Endpoint**: `POST /functions/v1/chat-response`

**Request Body**:
```typescript
{
  message: string;           // User's message
  sessionId: string;         // Conversation session ID
  conversationHistory?: Message[]; // Previous messages
}
```

**Response**:
```typescript
{
  data: {
    response: string;        // AI response text
    intent: string;          // Detected intent
    confidence: number;      // Confidence score (0-1)
    sentiment: number;       // Sentiment score (0-1)
    handoffNeeded: boolean;  // Should escalate?
    suggestions: string[];   // Action suggestions
  }
}
```

**Intent Detection Logic**:
```typescript
const intents = {
  greeting: /^(hi|hello|hey|good morning)/i,
  help: /(help|support|assist|need|problem|issue)/i,
  refund: /(refund|money back|return|reimburse)/i,
  billing: /(bill|invoice|charge|payment|cost|price)/i,
  account: /(account|login|password|access|profile)/i,
  technical: /(not working|broken|error|bug|crash|fix)/i,
  feedback: /(feedback|complaint|suggestion|review)/i,
  farewell: /(bye|goodbye|thanks|thank you|that's all)/i
};
```

**Sentiment Analysis**:
```typescript
const positiveWords = /(great|good|thanks|thank|excellent|happy|love|appreciate)/i;
const negativeWords = /(bad|terrible|awful|hate|angry|frustrated|disappointed|poor|worst)/i;

// Scoring:
// 0.2 = negative
// 0.5 = neutral
// 0.8 = positive
```

**Handoff Triggers**:
1. User explicitly requests human (`/(speak to|talk to|human|agent|person)/i`)
2. Negative sentiment < 0.3
3. Low confidence < 0.4
4. Urgent keywords detected

**Database Operations**:
- Stores user message
- Stores AI response
- Records analytics
- Creates handoff record if needed

## Web Speech API Integration

### SpeechRecognition (STT)

**Browser Support**:
- ✅ Chrome/Edge: Full support
- ⚠️ Safari: Inconsistent, varies by version
- ❌ Firefox: No production support

**Configuration**:
```typescript
const recognition = new SpeechRecognition();
recognition.continuous = false;      // Stop after one utterance
recognition.interimResults = false;  // Only final results
recognition.lang = 'en-US';          // Language
```

**Event Handlers**:
```typescript
recognition.onstart = () => {
  // Update UI: show listening state
};

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Send transcript to AI
};

recognition.onerror = (event) => {
  // Handle errors: no-speech, audio-capture, not-allowed
};

recognition.onend = () => {
  // Update UI: stop listening state
};
```

**Common Errors**:
- `no-speech`: Timeout, no input detected
- `audio-capture`: Microphone access denied
- `not-allowed`: User denied permission
- `network`: Network connectivity issues

### SpeechSynthesis (TTS)

**Browser Support**:
- ✅ All modern browsers

**Configuration**:
```typescript
const utterance = new SpeechSynthesisUtterance(text);
utterance.lang = 'en-US';
utterance.rate = 1.0;    // Speech rate (0.1 - 10)
utterance.pitch = 1.0;   // Voice pitch (0 - 2)
utterance.volume = 1.0;  // Volume (0 - 1)
```

**Event Handlers**:
```typescript
utterance.onstart = () => {
  // Update UI: show speaking state
};

utterance.onend = () => {
  // Update UI: stop speaking state
};

utterance.onerror = (event) => {
  // Handle synthesis errors
};
```

**Best Practices**:
- Cancel previous speech before starting new
- Check `window.speechSynthesis` availability
- Provide text fallback always
- Handle pause/resume for long text

## Deployment

### Build Process
```bash
# Install dependencies
pnpm install

# Build for production
pnpm run build

# Output: /dist directory
```

### Vercel Deployment
1. Builds automatically from `/dist`
2. SPA routing handled by `vercel.json` rewrite
3. Security headers applied
4. HTTPS enforced
5. CDN distribution

### Environment Variables
- Hardcoded in source (public keys only)
- No .env files needed
- Supabase credentials embedded in `src/lib/supabase.ts`

### Post-Deployment
- URL provided by deployment tool
- Instant propagation via CDN
- SSL certificate auto-configured

## Development Workflow

### Local Development
```bash
cd /workspace/echo-voice-agent
pnpm install
pnpm run dev
```

Access at: `http://localhost:5173`

### Testing Edge Functions Locally
```bash
# Deploy updated function
batch_deploy_edge_functions(...)

# Test with sample data
test_edge_function(
  function_url="https://.../functions/v1/chat-response",
  test_data={...}
)
```

### Database Changes
```bash
# Create migration
apply_migration(
  name="add_new_column",
  query="ALTER TABLE..."
)

# Verify in Supabase Dashboard
```

### Code Style
- TypeScript strict mode
- ESLint + React rules
- Prettier formatting
- Tailwind for all styling

## Performance Optimization

### Frontend
- Code splitting via Vite
- Lazy component loading
- Image optimization (WebP format)
- Minimal bundle size (~374KB JS)
- CSS tree-shaking via Tailwind

### Backend
- Database indexes on session_id
- Connection pooling (Supabase default)
- Edge function cold start: ~200ms
- Edge function warm: ~50-100ms

### Network
- CDN distribution (Vercel)
- GZIP compression enabled
- HTTP/2 support
- Asset caching

## Security

### Implemented
- HTTPS enforced
- Security headers (XSS, CSRF protection)
- Row Level Security on all tables
- Input validation in edge functions
- CORS properly configured

### Considerations
- No authentication (public demo)
- No rate limiting (free tier)
- No DDoS protection (Vercel default)
- Supabase keys are public (anon key)

### Recommendations for Production
1. Add user authentication
2. Implement rate limiting
3. Add CAPTCHA for bot protection
4. Use service role key only server-side
5. Add monitoring and alerting
6. Implement data retention policies

## Monitoring

### Current Implementation
- Basic analytics in database
- No real-time monitoring
- No alerting system
- Manual log review

### Recommended Tools
- Supabase Dashboard for DB metrics
- Vercel Analytics for web metrics
- Sentry for error tracking
- LogRocket for session replay

## Common Issues and Solutions

### Issue: Voice not working
**Cause**: Browser compatibility or permissions
**Solution**: 
- Check browser (use Chrome/Edge)
- Grant microphone permission
- Fall back to text input

### Issue: Slow response times
**Cause**: Edge function cold start or database query
**Solution**:
- Optimize database queries
- Add indexes
- Consider connection pooling

### Issue: TTS not speaking
**Cause**: Browser tab muted or volume at 0
**Solution**:
- Check browser tab audio icon
- Verify volume slider not at 0
- Check system volume

### Issue: Messages not saving
**Cause**: RLS policy or network error
**Solution**:
- Check Supabase connection
- Verify RLS policies allow inserts
- Check browser console for errors

## API Reference

### Supabase Client
```typescript
import { supabase } from './lib/supabase';

// Invoke edge function
const { data, error } = await supabase.functions.invoke('chat-response', {
  body: { message, sessionId, conversationHistory }
});

// Query database
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('session_id', sessionId)
  .order('timestamp', { ascending: true });

// Insert data
const { data, error } = await supabase
  .from('conversations')
  .insert({ session_id: sessionId, status: 'active' });
```

### Web Speech API
```typescript
// Start recognition
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.start();

// Speak text
const utterance = new SpeechSynthesisUtterance(text);
window.speechSynthesis.speak(utterance);

// Stop speaking
window.speechSynthesis.cancel();
```

## Maintenance Checklist

### Weekly
- [ ] Check Supabase dashboard for errors
- [ ] Review handoff requests
- [ ] Monitor database size (500MB limit)

### Monthly
- [ ] Update dependencies (`pnpm update`)
- [ ] Review analytics trends
- [ ] Clean old conversation data
- [ ] Check Vercel bandwidth usage

### Quarterly
- [ ] Security audit
- [ ] Performance review
- [ ] User feedback analysis
- [ ] Feature prioritization

## Support

For technical questions:
- Review this documentation
- Check `/workspace/DEPLOYMENT_SUMMARY.md`
- Review `/workspace/USER_GUIDE.md`
- Inspect browser console for errors
- Check Supabase logs

---

**Version**: 1.0.0  
**Last Updated**: October 29, 2025  
**Maintainer**: Echo Development Team
