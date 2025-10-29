import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!DEEPGRAM_API_KEY) {
      console.error('DEEPGRAM_API_KEY environment variable not set');
      return new Response(
        JSON.stringify({ 
          error: 'DEEPGRAM_API_KEY environment variable not configured',
          wsUrl: null,
          success: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build WebSocket URL for Deepgram streaming
    const wsUrl = `wss://api.deepgram.com/v1/listen?` +
      `model=nova-2&` +
      `punctuate=true&` +
      `smart_format=true&` +
      `interim_results=true&` +
      `encoding=linear16&` +
      `sample_rate=16000&` +
      `channels=1`;

    // Return URL with authentication header
    return new Response(
      JSON.stringify({
        wsUrl: `${wsUrl}&token=${DEEPGRAM_API_KEY}`,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating WebSocket URL:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        wsUrl: null,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
