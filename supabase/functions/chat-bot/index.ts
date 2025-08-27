import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();
    
    console.log('Received chat request:', { message, userId });

    if (!message || !userId) {
      throw new Error('Message and userId are required');
    }

    // إنشاء عميل Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // جلب السياق من المحادثات السابقة (آخر 10 رسائل)
    const { data: chatHistory } = await supabase
      .from('chat_history')
      .select('message, response, message_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // بناء السياق للذكاء الاصطناعي
    let context = '';
    if (chatHistory && chatHistory.length > 0) {
      context = chatHistory.reverse().map(chat => {
        if (chat.message_type === 'user') {
          return `Student: ${chat.message}`;
        } else {
          return `Assistant: ${chat.response}`;
        }
      }).join('\n');
    }

    // إعداد الرسالة للـ Gemini API
    const systemPrompt = `أنت مساعد ذكي متخصص في تعليم البرمجة للطلاب في الصف الثالث المتوسط. 
    تحدث باللغة العربية الفصحى بطريقة بسيطة ومفهومة. 
    اختصاصك هو شرح مفاهيم البرمجة بلغة Python وحل المشاكل البرمجية.
    
    المنهج يشمل:
    1. القوائم وصفوف البيانات
    2. المكتبات البرمجية
    3. بناء الواجهات الرسومية بلغة بايثون
    4. القواميس
    5. القوائم المتداخلة
    6. الملفات
    
    قدم شروحات واضحة مع أمثلة عملية. إذا سأل الطالب سؤالاً خارج نطاق البرمجة، وجهه بلطف للتركيز على دروس البرمجة.`;

    const fullPrompt = context ? 
      `${systemPrompt}\n\nسياق المحادثة السابقة:\n${context}\n\nالسؤال الحالي: ${message}` :
      `${systemPrompt}\n\nالسؤال: ${message}`;

    // إرسال الطلب إلى Gemini API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);

    const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      'عذراً، لم أتمكن من فهم سؤالك. هل يمكنك إعادة صياغته؟';

    // حفظ رسالة المستخدم
    await supabase
      .from('chat_history')
      .insert({
        user_id: userId,
        message: message,
        message_type: 'user'
      });

    // حفظ رد الذكاء الاصطناعي
    await supabase
      .from('chat_history')
      .insert({
        user_id: userId,
        message: message,
        response: botResponse,
        // DB migration enforces message_type IN ('user', 'bot')
        message_type: 'bot'
      });

    return new Response(JSON.stringify({ 
      response: botResponse,
      // keep legacy `message` field for clients expecting it
      message: botResponse,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-bot function:', error);
    
    const fallbackResponse = 'عذراً، حدث خطأ تقني. الرجاء المحاولة مرة أخرى أو طرح سؤالك بطريقة مختلفة.';
    
    return new Response(JSON.stringify({ 
      response: fallbackResponse,
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});