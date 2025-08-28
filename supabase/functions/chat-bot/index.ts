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
    const body = await req.json();
    const message = body.message
    const userId = body.userId
  const isContinue = !!body.continue
  const startCursor = typeof body.cursor === 'number' ? body.cursor : 0

  console.log('Received chat request:', { message, userId, isContinue, startCursor });

    if (!userId) {
      throw new Error('userId is required');
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

    // Helper: cut a text at a sentence boundary before maxLen characters.
    const cutAtSentence = (text: string, maxLen: number) => {
      if (!text) return { head: '', tail: '' }
      if (text.length <= maxLen) return { head: text, tail: '' }
      const slice = text.slice(0, maxLen)
      // try to find last terminal punctuation before maxLen
      const m = slice.match(/[.؟!…]\s*([^\s]*)?$/u)
      if (m && m.index != null) {
        const idx = m.index + (m[0] ? m[0].length - (m[1] ? m[1].length : 0) : 0)
        if (idx > 0) return { head: text.slice(0, idx), tail: text.slice(idx) }
      }
      // fallback: find last newline
      const nl = slice.lastIndexOf('\n')
      if (nl > 0) return { head: text.slice(0, nl+1), tail: text.slice(nl+1) }
      // fallback: find last space
      const sp = slice.lastIndexOf(' ')
      if (sp > 0) return { head: text.slice(0, sp), tail: text.slice(sp) }
      // as last resort, hard cut
      return { head: slice, tail: text.slice(slice.length) }
    }

    // If this is a continuation request, fetch the latest bot row and return
    // the next chunk starting from cursor.
    if (isContinue) {
      // find latest bot row for user
      const { data: lastRows } = await supabase
        .from('chat_history')
        .select('id, message, response, created_at')
        .eq('user_id', userId)
        .eq('message_type', 'bot')
        .order('created_at', { ascending: false })
        .limit(1)

      const last = (lastRows && lastRows[0]) || null
      if (!last) {
        return new Response(JSON.stringify({ response: '', success: false, error: 'No previous bot response' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const fullText = (last.response || last.message || '')
      const chunkSize = 2000
  const start = Math.max(0, startCursor)
      const remaining = fullText.slice(start)
      const { head, tail } = cutAtSentence(remaining, chunkSize)
      const newCursor = start + (head ? head.length : 0)
      const truncated = newCursor < fullText.length

      return new Response(JSON.stringify({ response: head || '', truncated, cursor: newCursor, success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

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
      // increase token budget to reduce mid-sentence truncation
      maxOutputTokens: 4096,
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

    // Assemble text from all parts (if any) to avoid truncated output when
    // the model returns multiple parts.
    let botResponse = (data.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p.text || '')
      .filter(Boolean)
      .join('\n') || 'عذراً، لم أتمكن من فهم سؤالك. هل يمكنك إعادة صياغته؟';

    // If the response ends abruptly (no terminal punctuation), attempt a few
    // follow-up generations to continue the answer and append them. This loop
    // tries up to `maxContinuations` times or stops early when the output
    // appears to end properly.
    const maxContinuations = 3
    let contAttempt = 0
    while (!/[.؟!…]$/u.test(botResponse.trim()) && contAttempt < maxContinuations) {
      contAttempt++
      try {
        const contPrompt = `${systemPrompt}\n\nسياق المحادثة السابقة:\n${context}\n\nالسؤال الحالي: ${message}\n\nرد المساعد السابق (مقطوع):\n${botResponse}\n\nأكمل الرد السابق من حيث انتهى، ولا تكرر المقدمة أو السياق.`

        const contResp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: contPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
          })
        })

        if (!contResp.ok) {
          const errTxt = await contResp.text()
          console.error('Gemini continuation error:', errTxt)
          break
        }

        const contData = await contResp.json()
        const contText = (contData.candidates?.[0]?.content?.parts || [])
          .map((p: any) => p.text || '')
          .filter(Boolean)
          .join('\n') || ''

        if (contText) {
          botResponse = `${botResponse}\n${contText}`
        } else {
          // nothing new; stop attempting
          break
        }

        // small backoff between continuation attempts
        if (!/[.؟!…]$/u.test(botResponse.trim()) && contAttempt < maxContinuations) {
          await new Promise(res => setTimeout(res, 300))
        }
      } catch (e) {
        console.error('Error while requesting continuation:', e)
        break
      }
    }

    // Persist full assistant response (dedupe by exact match on last saved)
    const { data: lastRows } = await supabase
      .from('chat_history')
      .select('id, message, response, message_type')
      .eq('user_id', userId)
      .eq('message_type', 'bot')
      .order('created_at', { ascending: false })
      .limit(1)

    const last = (lastRows && lastRows[0]) || null
    if (!last || (last.response || last.message || '') !== botResponse) {
      await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          message: botResponse,
          response: botResponse,
          message_type: 'bot'
        });
    } else {
      console.log('Skipping duplicate assistant insert for user', userId)
    }

    // Return only the first chunk to the client, with cursor and truncated flag
    const chunkSize = 2000
    const { head, tail } = cutAtSentence(botResponse, chunkSize)
    const truncated = (tail && tail.length > 0)
    const cursor = head ? head.length : 0

    return new Response(JSON.stringify({ response: head || botResponse, truncated, cursor, success: true }), {
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