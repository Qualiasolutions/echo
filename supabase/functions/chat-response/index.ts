Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { message, sessionId, conversationHistory } = await req.json();

        if (!message || !sessionId) {
            throw new Error('Message and sessionId are required');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase configuration missing');
        }

        // Analyze user intent and sentiment
        const analysis = analyzeMessage(message, conversationHistory || []);
        
        // Generate AI response based on intent
        const aiResponse = generateResponse(analysis, message, conversationHistory || []);

        // Check if handoff is needed
        const handoffNeeded = shouldHandoff(analysis);

        // Store user message
        await storeMessage(supabaseUrl, serviceRoleKey, {
            session_id: sessionId,
            role: 'user',
            content: message,
            intent: analysis.intent,
            confidence: analysis.confidence,
            sentiment: analysis.sentiment
        });

        // Store AI response
        await storeMessage(supabaseUrl, serviceRoleKey, {
            session_id: sessionId,
            role: 'assistant',
            content: aiResponse.content,
            intent: 'response',
            confidence: 1.0,
            sentiment: 0.5
        });

        // Store analytics
        await storeAnalytics(supabaseUrl, serviceRoleKey, sessionId, {
            response_time: Date.now(),
            intent_detected: analysis.intent,
            confidence_score: analysis.confidence,
            sentiment_score: analysis.sentiment
        });

        // Create handoff if needed
        if (handoffNeeded) {
            await createHandoff(supabaseUrl, serviceRoleKey, sessionId, {
                reason: analysis.handoffReason || 'Low confidence or negative sentiment',
                context_summary: aiResponse.contextSummary,
                sentiment_score: analysis.sentiment
            });
        }

        return new Response(JSON.stringify({
            data: {
                response: aiResponse.content,
                intent: analysis.intent,
                confidence: analysis.confidence,
                sentiment: analysis.sentiment,
                handoffNeeded,
                suggestions: aiResponse.suggestions || []
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Chat response error:', error);

        return new Response(JSON.stringify({
            error: {
                code: 'CHAT_RESPONSE_FAILED',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Analyze user message for intent, sentiment, and confidence
function analyzeMessage(message, history) {
    const lowerMessage = message.toLowerCase();
    
    // Intent detection patterns
    const intents = {
        greeting: /^(hi|hello|hey|good morning|good afternoon)/i,
        help: /(help|support|assist|need|problem|issue)/i,
        refund: /(refund|money back|return|reimburse)/i,
        billing: /(bill|invoice|charge|payment|cost|price)/i,
        account: /(account|login|password|access|profile)/i,
        technical: /(not working|broken|error|bug|crash|fix)/i,
        feedback: /(feedback|complaint|suggestion|review)/i,
        farewell: /(bye|goodbye|thanks|thank you|that\'s all)/i
    };

    let detectedIntent = 'general_inquiry';
    let confidence = 0.5;

    // Detect intent
    for (const [intent, pattern] of Object.entries(intents)) {
        if (pattern.test(lowerMessage)) {
            detectedIntent = intent;
            confidence = 0.85;
            break;
        }
    }

    // Sentiment analysis (basic)
    const positiveWords = /(great|good|thanks|thank|excellent|happy|love|appreciate)/i;
    const negativeWords = /(bad|terrible|awful|hate|angry|frustrated|disappointed|poor|worst)/i;
    
    let sentiment = 0.5; // neutral
    if (negativeWords.test(lowerMessage)) {
        sentiment = 0.2; // negative
    } else if (positiveWords.test(lowerMessage)) {
        sentiment = 0.8; // positive
    }

    // Check for urgency indicators
    const urgentWords = /(urgent|immediately|asap|emergency|critical|now)/i;
    const isUrgent = urgentWords.test(lowerMessage);

    // Check for human request
    const humanRequest = /(speak to|talk to|human|agent|person|representative)/i;
    const requestsHuman = humanRequest.test(lowerMessage);

    return {
        intent: detectedIntent,
        confidence,
        sentiment,
        isUrgent,
        requestsHuman,
        handoffReason: requestsHuman ? 'User requested human agent' : 
                       (sentiment < 0.3 ? 'Negative sentiment detected' : null)
    };
}

// Generate appropriate response based on analysis
function generateResponse(analysis, message, history) {
    const responses = {
        greeting: {
            content: "Hello! I'm Echo, your AI customer support assistant. How can I help you today?",
            suggestions: ["Account issues", "Billing questions", "Technical support", "General inquiry"]
        },
        help: {
            content: "I'm here to help! I can assist with account issues, billing questions, technical problems, and general inquiries. What would you like help with?",
            suggestions: ["Account access", "Billing inquiry", "Technical issue", "Product information"]
        },
        refund: {
            content: "I understand you're inquiring about a refund. To help you best, I'll need some information. Could you please provide your order number or describe the issue you're experiencing?",
            suggestions: ["Provide order number", "Describe the issue", "Speak to billing specialist"]
        },
        billing: {
            content: "I can help with billing questions. What specific billing issue are you experiencing? This could include invoices, payment methods, charges, or subscription details.",
            suggestions: ["View invoice", "Update payment method", "Question about charges", "Cancel subscription"]
        },
        account: {
            content: "I can assist with account-related issues. Are you having trouble logging in, need to update your profile, or have questions about account settings?",
            suggestions: ["Reset password", "Update email", "Account settings", "Delete account"]
        },
        technical: {
            content: "I'm sorry you're experiencing technical difficulties. Can you describe the problem in more detail? What were you trying to do when the issue occurred?",
            suggestions: ["Describe the problem", "Provide error message", "Connect with tech support"]
        },
        feedback: {
            content: "Thank you for sharing your feedback! Your input is valuable to us. Please tell me more about your experience so I can make sure your feedback reaches the right team.",
            suggestions: ["Share positive feedback", "Report an issue", "Suggest improvement"]
        },
        farewell: {
            content: "You're welcome! Is there anything else I can help you with today? If not, have a great day!",
            suggestions: ["Ask another question", "No, I'm all set", "Speak to human agent"]
        },
        general_inquiry: {
            content: "I'm here to help! Could you please provide more details about what you need assistance with? I can help with accounts, billing, technical issues, and general questions about our services.",
            suggestions: ["Account help", "Billing question", "Technical support", "Product info"]
        }
    };

    const response = responses[analysis.intent] || responses.general_inquiry;

    // Add handoff message if needed
    if (analysis.requestsHuman) {
        response.content = "I understand you'd like to speak with a human agent. I'm connecting you now with one of our customer support specialists who can provide personalized assistance. They'll have access to our conversation history.";
        response.suggestions = ["Wait for agent", "Continue with AI", "Leave a message"];
    } else if (analysis.sentiment < 0.3) {
        response.content = "I sense you may be frustrated, and I sincerely apologize for any inconvenience. " + response.content + " If you'd prefer, I can connect you with a human agent for more personalized support.";
        response.suggestions = [...(response.suggestions || []), "Speak to human agent"];
    }

    // Generate context summary for handoff
    const contextSummary = history.length > 0 
        ? `User has discussed: ${history.map(m => m.intent || 'general').join(', ')}. Current intent: ${analysis.intent}.`
        : `New conversation. User intent: ${analysis.intent}.`;

    return {
        content: response.content,
        suggestions: response.suggestions,
        contextSummary
    };
}

// Check if handoff to human is needed
function shouldHandoff(analysis) {
    return analysis.requestsHuman || 
           analysis.sentiment < 0.3 || 
           analysis.confidence < 0.4 ||
           analysis.isUrgent;
}

// Store message in database
async function storeMessage(supabaseUrl, serviceRoleKey, messageData) {
    const response = await fetch(`${supabaseUrl}/rest/v1/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(messageData)
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Failed to store message:', error);
    }
}

// Store analytics data
async function storeAnalytics(supabaseUrl, serviceRoleKey, sessionId, metrics) {
    const analyticsData = Object.entries(metrics).map(([name, value]) => ({
        session_id: sessionId,
        metric_name: name,
        metric_value: typeof value === 'number' ? value : 0,
        metadata: typeof value !== 'number' ? { value } : {}
    }));

    const response = await fetch(`${supabaseUrl}/rest/v1/analytics`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(analyticsData)
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Failed to store analytics:', error);
    }
}

// Create handoff request
async function createHandoff(supabaseUrl, serviceRoleKey, sessionId, handoffData) {
    const response = await fetch(`${supabaseUrl}/rest/v1/handoffs`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
            session_id: sessionId,
            ...handoffData
        })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Failed to create handoff:', error);
    }
}
