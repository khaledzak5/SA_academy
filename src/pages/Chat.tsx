import { useState, useRef, useEffect } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Trash2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface ChatMessage {
  id: string
  message_type: 'user' | 'assistant'
  message: string
  response?: string
  truncated?: boolean
  cursor?: number
  timestamp: Date
}

interface ChatThread {
  id: string
  title?: string
  created_at?: string
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    loadChatHistory()
  loadThreads()
  }, [])

  const createThread = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const title = `محادثة ${new Date().toLocaleString('ar-SA')}`
      const { data, error } = await (supabase as any)
        .from('chat_threads')
        .insert({ user_id: user.id, title })
        .select()

      if (error) throw error
      const newThread = data?.[0]
      const threadObj = { id: String(newThread.id), title: newThread.title, created_at: newThread.created_at }
      setThreads(prev => [threadObj, ...prev])
      setCurrentThread(threadObj)
      setMessages([])
    } catch (error) {
      console.error('Error creating thread:', error)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadChatHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // load messages for current thread if selected, otherwise recent messages
      let resp
      // chat_history table does not include thread_id in this project's schema,
      // so always load by user_id only.
      resp = await (supabase as any)
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100)

      const { data, error } = resp

      if (error) throw error


      const formattedMessages: ChatMessage[] = (data || []).map((msg: any) => ({
        id: String(msg.id),
        // normalize DB types: 'bot' -> assistant
        message_type: msg.message_type === 'user' ? 'user' : 'assistant',
        message: msg.message,
        response: msg.response || '',
        timestamp: new Date(msg.created_at || '')
      }))

      // Remove consecutive duplicate messages (same type + same content)
      const deduped: ChatMessage[] = []
      for (const m of formattedMessages) {
        const prev = deduped[deduped.length - 1]
        if (!prev || prev.message_type !== m.message_type || prev.message !== m.message || (prev.response || '') !== (m.response || '')) {
          deduped.push(m)
        }
      }

      setMessages(deduped)
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const loadThreads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const resp = await (supabase as any)
        .from('chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data, error } = resp
      if (error) throw error
      const rows: any[] = data || []
      const mapped: ChatThread[] = rows.map(r => ({ id: String(r.id), title: r.title, created_at: r.created_at }))
      setThreads(mapped)
      if (!currentThread && mapped.length) setCurrentThread(mapped[0])
    } catch (error) {
      console.error('Error loading threads:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || sendingRef.current) return

    // Prevent re-entrant sends from rapid clicks/keypresses
    sendingRef.current = true

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      message_type: 'user',
      message: input.trim(),
      timestamp: new Date()
    }

  // Optimistically render the user message
  setMessages(prev => [...prev, userMessage])
  setInput('')
  setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // حفظ رسالة المستخدم أولا حتى تكون متاحة كسياق للوظيفة
      await supabase.from('chat_history').insert({
        user_id: user.id,
        message_type: 'user',
        message: userMessage.message
      })

      // استدعاء دالة الـ Edge Function بعد حفظ رسالة المستخدم
      const { data, error } = await supabase.functions.invoke('chat-bot', {
        body: { message: userMessage.message, userId: user.id, threadId: currentThread?.id }
      })

      // Debug: log full function response and sizes to browser console
      try {
        console.debug('chat-bot response raw:', data)
        const maybeText = (data as any)?.response || (data as any)?.message || ''
        console.debug('chat-bot response length:', (maybeText as string).length)
      } catch (e) {
        console.debug('error logging chat-bot response', e)
      }

      if (error) throw error

      const assistantText = (data as any)?.response || (data as any)?.message || ''
      const truncated = !!(data as any)?.truncated
      const cursor = typeof (data as any)?.cursor === 'number' ? (data as any).cursor : 0

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message_type: 'assistant',
        // Edge function returns { response: string, success: boolean }
        message: assistantText,
        truncated,
        cursor,
        timestamp: new Date()
      }

  // Render assistant message locally. Then fetch the server-saved assistant
  // response (if any) and replace the optimistic message when the DB text
  // is longer (this handles server-side continuations that arrived after
  // the function returned a partial string).
  setMessages(prev => [...prev, assistantMessage])

      // After rendering optimistic assistant message, poll the DB a few times
      // to catch any late writes or continuations saved by the server.
      const pollLatest = async (attempts = 3, delayMs = 800) => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          let prevLen = assistantText.length
          for (let i = 0; i < attempts; i++) {
            const q = await (supabase as any)
              .from('chat_history')
              .select('id, response, message, created_at')
              .eq('user_id', user.id)
              .eq('message_type', 'bot')
              .order('created_at', { ascending: false })
              .limit(1)

            const latest = q.data && q.data[0]
            const latestText = latest ? (latest.response || latest.message || '') : ''

            if (latestText && latestText.length > prevLen) {
              // Replace last assistant message in state with the DB text
              setMessages(prev => {
                const copy = [...prev]
                for (let j = copy.length - 1; j >= 0; j--) {
                  if (copy[j].message_type === 'assistant') {
                    copy[j] = { ...copy[j], message: latestText }
                    break
                  }
                }
                return copy
              })
              prevLen = latestText.length
            }

            // stop early if we've grown and the latest ends with terminal punctuation
            if (latestText && /[.؟!…]$/u.test(latestText.trim())) break

            // wait before next attempt
            await new Promise(res => setTimeout(res, delayMs))
          }
        } catch (e) {
          console.error('Error polling latest bot response:', e)
        }
      }

      // fire-and-forget poll (don't block UI)
      void pollLatest(4, 700)

    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "خطأ في الإرسال",
        description: "حدث خطأ أثناء إرسال الرسالة",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      // clear the synchronous guard
      sendingRef.current = false
    }
  }

  // Continue a truncated assistant message by calling the chat-bot function
  // with { continue: true, cursor } and appending the returned chunk.
  const continueAssistant = async (msgIndex: number) => {
    if (sendingRef.current) return
    sendingRef.current = true
    try {
      const target = messages[msgIndex]
      if (!target || target.message_type !== 'assistant' || !target.truncated) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase.functions.invoke('chat-bot', {
        body: { continue: true, cursor: target.cursor || 0, userId: user.id }
      })

      if (error) throw error

      const chunk = (data as any)?.response || ''
      const truncated = !!(data as any)?.truncated
      const newCursor = typeof (data as any)?.cursor === 'number' ? (data as any).cursor : (target.cursor || 0)

      // append chunk to message
      setMessages(prev => {
        const copy = [...prev]
        if (copy[msgIndex] && copy[msgIndex].message_type === 'assistant') {
          copy[msgIndex] = { ...copy[msgIndex], message: `${copy[msgIndex].message}\n${chunk}`, truncated, cursor: newCursor }
        }
        return copy
      })
    } catch (e) {
      console.error('Error continuing assistant message:', e)
    } finally {
      sendingRef.current = false
    }
  }

  const clearChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // delete all messages for this user (schema has no thread_id column)
      await supabase
        .from('chat_history')
        .delete()
        .eq('user_id', user.id)

      setMessages([])
      toast({
        title: "تم مسح المحادثات",
        description: "تم حذف جميع الرسائل بنجاح",
      })
    } catch (error) {
      toast({
        title: "خطأ في المسح",
        description: "حدث خطأ أثناء مسح المحادثة",
        variant: "destructive",
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Helper: remove surrounding stars, detect Arabic, and render code blocks LTR
  const renderMessageContent = (text: string) => {
    if (!text) return null

    // Remove all asterisks used as emphasis in messages
    const cleaned = text.replace(/\*/g, '')

    // Ensure spacing around inline backtick code when adjacent to Arabic
    const preprocessInlineCodeSpacing = (t: string) =>
      t
        .replace(/([\u0600-\u06FF])`/g, '$1 `') // add space before opening backtick if Arabic before
        .replace(/`([\u0600-\u06FF])/g, '` $1') // add space after closing backtick if Arabic after

    const prepared = preprocessInlineCodeSpacing(cleaned)

    // Split by triple-backtick code fences. odd indices are code blocks.
    const parts = prepared.split('```')

    return (
      <div>
        {parts.map((part, idx) => {
          if (idx % 2 === 1) {
            // code block: render left-to-right with monospace
            return (
              <pre key={idx} dir="ltr" className="bg-muted px-3 py-2 rounded-lg overflow-auto text-sm font-mono text-left">
                <code>{part.trim()}</code>
              </pre>
            )
          }

          // normal text: handle inline code marked with single backticks
          const segments = part.split(/`([^`]+)`/g) // keeps code in odd indices

          return (
            <p key={idx} className="whitespace-pre-wrap">
              {segments.map((seg, sidx) => {
                if (sidx % 2 === 1) {
                  // inline code segment: LTR, monospace, with small horizontal margin
                  return (
                    <code
                      key={sidx}
                      dir="ltr"
                      className="bg-blue-800 text-white px-1 rounded font-mono text-sm inline-block mx-1"
                      style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.2)'}}
                    >
                      {seg}
                    </code>
                  )
                }

                const isArabic = /[\u0600-\u06FF]/.test(seg)
                return (
                  <span key={sidx} dir={isArabic ? 'rtl' : 'ltr'} className={isArabic ? 'text-right' : 'text-left'}>
                    {seg}
                  </span>
                )
              })}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header title="مساعد البرمجة الذكي" showBackButton />
      
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - visible on md+ */}
          <aside className="w-64 hidden md:flex flex-col bg-card p-3 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-medium">المحادثات</h3>
                <div className="text-xs text-muted-foreground">اختر محادثة أو أنشئ جديدة</div>
              </div>
              <Button size="sm" onClick={createThread}>جديدة</Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {threads.length === 0 && (
                <div className="text-xs text-muted-foreground">لا توجد محادثات بعد</div>
              )}
              {threads.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setCurrentThread(t); loadChatHistory(); }}
                  className={`w-full text-right px-3 py-2 rounded-md flex items-center justify-between ${currentThread?.id === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <div className="text-sm truncate">{t.title || 'محادثة'}</div>
                  <div className="text-xs text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleDateString('ar-SA') : ''}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* Main area */}
          <main className="flex-1 max-w-6xl flex flex-col">
            {/* Small-screen threads bar */}
            <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium">المحادثات</h3>
                <div className="text-xs text-muted-foreground">(اختر أو أنشئ)</div>
              </div>
              <div className="ml-auto">
                <Button size="sm" onClick={createThread}>جديدة</Button>
              </div>
              {threads.map(t => (
                <Button key={t.id} variant={currentThread?.id === t.id ? 'default' : 'ghost'} size="sm" onClick={() => { setCurrentThread(t); loadChatHistory(); }}>
                  {t.title || 'محادثة'}
                </Button>
              ))}
            </div>
        {/* رأس الدردشة */}
        <Card className="card-modern mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">مساعد البرمجة</h2>
                  <p className="text-sm text-muted-foreground">مدعوم بـ Gemini 2.0 Flash</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Badge variant="secondary">متصل</Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearChat}
                  className="hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* منطقة الرسائل */}
        <Card className="flex-1 card-modern mb-4 overflow-hidden">
          <CardContent className="p-0 h-full">
            <div className="h-[70vh] overflow-y-auto custom-scrollbar p-6 space-y-6 text-lg">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">مرحباً بك!</h3>
                  <p className="text-sm">اسأل أي سؤال متعلق بالبرمجة وسأساعدك</p>
                </div>
              ) : (
                <>
                  {messages.map((message, idx) => {
                    return (
                      <div
                        key={message.id}
                        className={`flex items-start space-x-3 space-x-reverse ${message.message_type === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.message_type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-r from-accent to-secondary text-white'}`}>
                          {message.message_type === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>

                        <div className={`flex-1 ${message.message_type === 'user' ? 'text-right' : 'text-right'}`}>
                          <div className={`inline-block px-4 py-3 rounded-lg max-w-[80%] ${message.message_type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                            {renderMessageContent(message.message_type === 'user' ? message.message : (message.response || message.message))}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              {message.timestamp.toLocaleTimeString('ar-SA', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {message.message_type === 'assistant' && message.truncated && (
                              <Button size="sm" variant="outline" onClick={() => continueAssistant(idx)}>أكمل</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
              
              {loading && (
                <div className="flex items-start space-x-3 space-x-reverse">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-accent to-secondary text-white flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted px-4 py-3 rounded-lg">
                    <div className="flex space-x-1 space-x-reverse">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* منطقة الإدخال */}
        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="flex space-x-3 space-x-reverse items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="اكتب رسالتك هنا..."
                disabled={loading}
                className="flex-1 py-4 text-base"
              />
              <Button 
                onClick={sendMessage} 
                disabled={!input.trim() || loading}
                className="btn-gradient px-8 py-3"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              اضغط Enter للإرسال • يمكنك السؤال عن أي موضوع في البرمجة
            </p>
          </CardContent>
        </Card>
      </main>
      </div>
    </div>
    </div>
  )
}