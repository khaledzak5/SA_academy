import { useState, useEffect } from "react"
import { cn } from '@/lib/utils'
import lesson1Questions from '@/data/lesson1_questions.json'
import lesson2Questions from '@/data/lesson2_questions.json'
import lesson3Questions from '@/data/lesson3_questions.json'
import lesson4Questions from '@/data/lesson4_questions.json'
import lesson5Questions from '@/data/lesson5_questions.json'
import lesson6Questions from '@/data/lesson6_questions.json'
import { useParams, useSearchParams, useNavigate } from "react-router-dom"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Question {
  id: number
  question: string
  options: string[]
  correct: number
  type: 'multiple' | 'boolean'
}

export default function Quiz() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [resultSummary, setResultSummary] = useState<null | {
    total: number
    correct: number
    percentage: number
    questionResults: any[]
  }>(null)
  const [attemptsCount, setAttemptsCount] = useState<number | null>(null)
  const questionCount = Number(searchParams.get('questions') || 10)

  useEffect(() => {
    if (!id) return
    fetchLessonQuestions(Number(id))
  }, [id])

  const fetchLessonQuestions = async (lessonId: number) => {
    try {
      // guard: ensure previous lesson completed before accessing this one
      if (lessonId > 1) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            // check attempts for previous lesson
            const prevLesson = lessonId - 1
            const { count: prevCount, error: pcErr } = await supabase
              .from('quiz_results')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('lesson_id', prevLesson)

            if (!pcErr && (prevCount ?? 0) === 0) {
              toast({ title: 'غير مسموح', description: 'يجب إكمال اختبار الدرس السابق أولاً.', variant: 'destructive' })
              navigate('/quiz-selection')
              return
            }
          }
        } catch (e) {
          // ignore auth errors — allow access for unauthenticated users
        }
      }
      let raw: any = []

      if (lessonId === 1) {
        // use local JSON file for lesson 1
        // lesson1Questions has shape { unit_title, questions: [...] }
        raw = lesson1Questions.questions || []
      } else if (lessonId === 2) {
        // use local JSON file for lesson 2 (new)
        raw = lesson2Questions.questions || []
      } else if (lessonId === 3) {
        raw = lesson3Questions.questions || []
      } else if (lessonId === 4) {
        // lesson 4: local JSON added from user-provided questions
        raw = lesson4Questions.questions || []
      } else if (lessonId === 5) {
        // lesson 5: nested lists questions
        raw = lesson5Questions.questions || []
          } else if (lessonId === 6) {
            // lesson 6: user-provided local JSON
            raw = lesson6Questions.questions || []
      } else {
        const { data, error } = await supabase
          .from('lessons')
          .select('questions_json')
          .eq('id', lessonId)
          .single()

        if (error) throw error
        raw = data.questions_json || []
      }

      // before proceeding, check user's past attempts for this lesson (limit 3)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { count, error } = await supabase
            .from('quiz_results')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('lesson_id', lessonId)

          if (!error) {
            const attempts = count ?? 0
            setAttemptsCount(attempts)
            if (attempts >= 3) {
              toast({ title: 'غير مسموح', description: 'لقد وصلت للحد الأقصى من محاولات الاختبار لهذا الدرس (3 محاولات).', variant: 'destructive' })
              navigate('/quiz-selection')
              return
            }
          }
        }
      } catch (e) {
        // ignore auth check failures — allow quiz to proceed for unauthenticated or transient errors
      }

      // coerce/validate questions array
      const allQuestions: Question[] = Array.isArray(raw)
        ? raw.map((item: any, idx: number) => {
              // support multiple incoming shapes, including the provided 'answerOptions' array
              const isTrueFalse = item.question_type === 'true_false' || item.type === 'boolean' || (Array.isArray(item.answerOptions) && item.answerOptions.length === 2 && item.answerOptions.every((a: any) => typeof a.text === 'string' && (a.text.includes('صح') || a.text.includes('خطأ'))))

              // prefer explicit answerOptions array if present (each option object has .text and .isCorrect)
              let options: any[] = []
              let correctIndex = -1

              if (Array.isArray(item.answerOptions)) {
                options = item.answerOptions.map((ao: any) => ao.text ?? String(ao))
                const idxCorrect = item.answerOptions.findIndex((ao: any) => ao.isCorrect === true || ao.is_correct === true)
                if (idxCorrect >= 0) correctIndex = idxCorrect
              } else if (item.answer_data) {
                // support lesson3 schema: answer_data.options (array of strings) and answer_data.correct_answer
                if (Array.isArray(item.answer_data.options)) {
                  options = item.answer_data.options.map(String)
                }
                if (typeof item.answer_data.correct_answer === 'boolean') {
                  // true/false question
                  const boolCorrect = item.answer_data.correct_answer === true
                  options = ['صح', 'خطأ']
                  correctIndex = boolCorrect ? 0 : 1
                } else if (typeof item.answer_data.correct_answer === 'string') {
                  const idx = (options || []).findIndex((o: any) => String(o) === String(item.answer_data.correct_answer))
                  if (idx >= 0) correctIndex = idx
                }
              } else {
                options = isTrueFalse ? ['صح', 'خطأ'] : (item.options || item.options_list || [])
                if (isTrueFalse) {
                  correctIndex = (item.correct_answer === true || item.correct === 0 || item.correct === 'صح') ? 0 : 1
                } else if (Array.isArray(options)) {
                  correctIndex = options.findIndex((o: any) => String(o) === String(item.correct_answer ?? item.correct))
                }
              }

            return {
              id: item.id ?? item.questionNumber ?? idx,
              question: String(item.question_text || item.question || item.text || ''),
              options: Array.isArray(options) ? options.map(String) : [],
              correct: correctIndex >= 0 ? correctIndex : Number(item.correct ?? 0),
              type: isTrueFalse ? 'boolean' : 'multiple',
              // keep hint/rationale/raw structure for rendering later
              // @ts-ignore
              _raw: item,
            }
          })
        : []

      // shuffle and pick N random questions
      const shuffled = allQuestions
        .map(q => ({ q, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map(x => x.q)

      const selected = shuffled.slice(0, questionCount)
      setQuestions(selected)
  setAnswers(Array(selected.length).fill(-1))
  // ensure hint is hidden when loading questions
  setShowHint(false)
    } catch (error) {
      toast({ title: 'خطأ', description: 'تعذر جلب أسئلة الدرس', variant: 'destructive' })
      navigate('/quiz-selection')
    } finally {
      setLoading(false)
    }
  }

  const selectAnswer = (idx: number) => {
    setAnswers(prev => {
      const copy = [...prev]
      copy[currentIndex] = idx
      return copy
    })
  }

  const next = () => {
    if (currentIndex < questions.length - 1) {
      // require answer selected before moving next
      if (answers[currentIndex] === -1) {
        toast({ title: 'اختر إجابة', description: 'يجب اختيار إجابة قبل الانتقال للسؤال التالي.' })
        return
      }
      setCurrentIndex(i => i + 1)
      setShowHint(false)
    }
  }

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setShowHint(false)
    }
  }

  const finish = async () => {
    // require all questions answered
    if (answers.some(a => a === -1)) {
      toast({ title: 'أجب عن جميع الأسئلة', description: 'لا يمكنك إنهاء الاختبار حتى تجيب على كل الأسئلة.' })
      return
    }

    // compute score and build results
    const total = questions.length
    let correct = 0
    const questionResults = questions.map((q, i) => ({
      ...q,
      selected: answers[i]
    }))
    questionResults.forEach((q, i) => { if (q.selected === q.correct) correct++ })

    const percentage = total ? Math.round((correct / total) * 100) : 0

    setResultSummary({ total, correct, percentage, questionResults })
    setShowResults(true)

    // try to save result but don't block the UI
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // re-check attempt count before saving to avoid race
      const { count, error } = await supabase
        .from('quiz_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('lesson_id', Number(id))

      const attempts = (count ?? 0)
      if (attempts >= 3) {
        toast({ title: 'تم الوصول للحد', description: 'لا يمكن حفظ نتيجة جديدة لأن الحد الأقصى للمحاولات (3) قد تم الوصول إليه.', variant: 'destructive' })
        return
      }

      await supabase.from('quiz_results').insert({
        user_id: user.id,
        lesson_id: Number(id),
        lesson_name: `Lesson ${id}`,
        total_questions: total,
        correct_answers: correct,
        score_percentage: percentage,
        questions_data: questionResults,
      })
      setAttemptsCount(prev => (prev ?? 0) + 1)
      toast({ title: 'تم حفظ النتيجة', description: `درجتك: ${percentage}%` })
    } catch (error) {
      toast({ title: 'محصلش حفظ', description: 'تعذر حفظ نتيجة الاختبار تلقائياً', variant: 'destructive' })
    }
  }

  const retake = () => {
    // reshuffle and reset
    const shuffled = questions
      .map(q => ({ q, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(x => x.q)
    setQuestions(shuffled)
    setAnswers(Array(shuffled.length).fill(-1))
    setCurrentIndex(0)
    setShowResults(false)
    setResultSummary(null)
  setShowHint(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>

  if (!questions.length) return <div className="min-h-screen flex items-center justify-center">لا توجد أسئلة لهذا الدرس</div>

  if (showResults && resultSummary) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Header title={`النتيجة - ${resultSummary.percentage}%`} showBackButton />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل النتيجة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div>الأسئلة: {resultSummary.total}</div>
                <div>الإجابات الصحيحة: {resultSummary.correct}</div>
                <div>النسبة: {resultSummary.percentage}%</div>
              </div>

              <div className="space-y-4">
                {resultSummary.questionResults.map((qres, idx) => (
                  <div key={idx} className="p-3 border rounded">
                    <div className="font-medium">{idx + 1}. {qres.question}</div>
                    <div className="mt-2 space-y-1">
                      <div>إجابتك: <span className={qres.selected === qres.correct ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{qres.selected >= 0 ? (qres.options[qres.selected] ?? 'غير مختارة') : 'غير مختارة'}</span></div>
                      <div>الإجابة الصحيحة: <span className="font-medium">{qres.options[qres.correct]}</span></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-6">
                <div className="space-x-2">
                  <Button onClick={retake}>إعادة الاختبار</Button>
                  <Button onClick={() => navigate('/dashboard')} className="btn-gradient">الذهاب للوحة التحكم</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const q = questions[currentIndex]
  const rawItem = (q as any)?._raw || null

  // render text that may contain inline/backtick code blocks.
  // Splits on backticks (`). odd indices are code fragments.
  const renderTextWithCode = (text?: string, forHint: boolean = false) => {
    if (!text) return null
    const parts = String(text).split(/`+/g)
    const textParts: string[] = []
    const codeParts: string[] = []

    parts.forEach((part, i) => {
      if (i % 2 === 1) codeParts.push(part)
      else textParts.push(part)
    })

    return (
      <div className="text-right">
        {textParts.length > 0 && (
          <div className="whitespace-pre-line">{textParts.join('')}</div>
        )}

        {codeParts.length > 0 && (
          <pre
            dir="ltr"
            className={cn(
              // when rendering hints, use dark background + white text
              forHint
                ? 'bg-slate-800 text-white text-sm p-2 rounded my-1 overflow-x-auto whitespace-pre leading-tight'
                : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-white text-sm p-2 rounded my-1 overflow-x-auto whitespace-pre leading-tight'
            )}
            style={{ textAlign: 'left' }}
          >
            {codeParts.join('\n')}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header title={`الاختبار - سؤال ${currentIndex + 1} من ${questions.length}`} />
      <main className="container mx-auto px-4 py-8">
        <Card>
            <CardHeader>
            <CardTitle>
              {renderTextWithCode(q.question)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {q.options.map((opt, i) => (
                <div key={i} className={`p-3 rounded border ${answers[currentIndex] === i ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => selectAnswer(i)}>
                  {opt}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button onClick={() => setShowHint(s => !s)} className="bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:text-white">{showHint ? 'اخفاء التلميح' : 'عرض التلميح'}</Button>
                {showHint && (
                <div className="mt-3 p-3 border rounded bg-gray-50 dark:bg-gray-100 text-right text-black">
                  {rawItem?.hint ? (
                    renderTextWithCode(rawItem.hint, true)
                  ) : rawItem?.rationale ? (
                    <div className="space-y-2">
                      {typeof rawItem.rationale === 'object' ? (
                        Object.keys(rawItem.rationale).map(key => (
                          <div key={key} className="text-sm">
                            <div className="font-medium">الخيار {Number(key) + 1}:</div>
                            <div className="text-black">{renderTextWithCode(rawItem.rationale[key], true)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-black">{renderTextWithCode(String(rawItem.rationale), true)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-black">لا يوجد تلميح متاح.</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-6">
              <div className="space-x-2">
                <Button onClick={prev} disabled={currentIndex === 0}>السابق</Button>
                {currentIndex < questions.length - 1 ? (
                  <Button onClick={next}>التالي</Button>
                ) : (
                  <Button onClick={finish} className="btn-gradient">إنهاء الاختبار</Button>
                )}
              </div>
              <div className="text-sm text-muted-foreground">السؤال {currentIndex + 1} / {questions.length}</div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
