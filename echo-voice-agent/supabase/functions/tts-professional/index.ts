import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, conversationId, voiceId = 'en-US-AriaNeural' } = await req.json();

    if (!text) {
      throw new Error('No text provided');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use Azure TTS API for professional voice synthesis
    // This is a production-ready TTS service with "SereneWoman" quality voices
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY') || 'demo-key';
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION') || 'eastus';

    // For production: Replace with actual Azure TTS API call
    // For now, we'll generate audio using a text-to-speech service
    
    // Build SSML for better voice control
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="en-US-AriaNeural">
          <prosody rate="0.9" pitch="0%">
            ${text}
          </prosody>
        </voice>
      </speak>
    `;

    // Call Azure Cognitive Services TTS API
    let audioData: ArrayBuffer;
    let audioFormat = 'audio/mpeg';

    try {
      const ttsResponse = await fetch(
        `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          },
          body: ssml,
        }
      );

      if (!ttsResponse.ok) {
        throw new Error(`TTS API error: ${ttsResponse.status}`);
      }

      audioData = await ttsResponse.arrayBuffer();
    } catch (error) {
      console.error('TTS generation error:', error);
      // Fallback: Return text for client-side TTS
      return new Response(
        JSON.stringify({
          success: true,
          text,
          useClientTTS: true,
          voiceId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Store audio in Supabase Storage
    const audioFileName = `conversation_${conversationId}_${Date.now()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('audio-recordings')
      .upload(audioFileName, audioData, {
        contentType: audioFormat,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
    }

    // Get public URL for the audio
    const { data: urlData } = supabase
      .storage
      .from('audio-recordings')
      .getPublicUrl(audioFileName);

    // Store message in database
    if (conversationId) {
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: text,
          audio_url: urlData?.publicUrl || null,
          created_at: new Date().toISOString(),
        });
    }

    // Return audio data directly
    return new Response(audioData, {
      headers: {
        ...corsHeaders,
        'Content-Type': audioFormat,
        'X-Audio-URL': urlData?.publicUrl || '',
      },
    });
  } catch (error) {
    console.error('Error in tts-professional:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
