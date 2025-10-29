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

    // Discover the project id needed for temporary key creation
    const projectRes = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    if (!projectRes.ok) {
      const errorBody = await projectRes.text();
      console.error('Deepgram project lookup failed:', projectRes.status, errorBody);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch Deepgram project metadata',
          details: errorBody,
          wsUrl: null,
          success: false,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const projectJson = await projectRes.json();
    const projectId =
      projectJson?.projects?.[0]?.project_id ??
      projectJson?.projects?.[0]?.id ??
      projectJson?.project_id ??
      projectJson?.id;

    if (!projectId) {
      console.error('Unable to determine Deepgram project ID from response:', projectJson);
      return new Response(
        JSON.stringify({
          error: 'Deepgram project metadata missing project_id',
          details: JSON.stringify(projectJson),
          wsUrl: null,
          success: false,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Request an ephemeral Deepgram token so the browser never sees the master API key
    const response = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'Echo browser session',
        type: 'temporary',
        ttl: 60,
        scopes: ['usage:write'],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Deepgram token request failed:', response.status, errorBody);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate Deepgram token',
          details: errorBody,
          wsUrl: null,
          success: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const tokenJson = await response.json();
    const ephemeralKey =
      tokenJson?.key ??
      tokenJson?.api_key ??
      tokenJson?.api_key?.key ??
      tokenJson?.secret ??
      null;
    const expiresAt =
      tokenJson?.expires_at ??
      tokenJson?.expiresAt ??
      tokenJson?.expiration ??
      null;

    if (!ephemeralKey) {
      console.error('Deepgram response missing ephemeral key');
      return new Response(
        JSON.stringify({ 
          error: 'Deepgram token generation returned no key',
          wsUrl: null,
          success: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const wsUrl = new URL('wss://api.deepgram.com/v1/listen');
    wsUrl.searchParams.set('model', 'nova-2');
    wsUrl.searchParams.set('punctuate', 'true');
    wsUrl.searchParams.set('smart_format', 'true');
    wsUrl.searchParams.set('interim_results', 'true');
    wsUrl.searchParams.set('encoding', 'linear16');
    wsUrl.searchParams.set('sample_rate', '16000');
    wsUrl.searchParams.set('channels', '1');

    return new Response(
      JSON.stringify({
        wsUrl: wsUrl.toString(),
        token: ephemeralKey,
        expiresAt,
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
