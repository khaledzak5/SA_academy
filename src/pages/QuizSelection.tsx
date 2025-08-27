import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { BookOpen, Brain, Clock, Target } from "lucide-react"

interface Lesson {
  id: number
  lesson_number: number
  lesson_title: string
  lesson_description: string
  questions_json: any
}

export default function QuizSelection() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null)
  const [questionCount, setQuestionCount] = useState<number>(10)
  const [attemptsMap, setAttemptsMap] = useState<Record<number, number>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetchLessons()
  }, [])

  const fetchLessons = async () => {
    try {
  setFetchError(null)
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .order('lesson_number')

      if (error) throw error

      setLessons(data || [])

      // fetch current user and their attempts per lesson
      try {
        const { data: userData } = await supabase.auth.getUser()
        const user = userData?.user
        if (user) {
          setUserId(user.id)
          const { data: results, error: resErr } = await supabase
            .from('quiz_results')
            .select('lesson_id')
            .eq('user_id', user.id)

          if (!resErr && Array.isArray(results)) {
            const counts: Record<number, number> = {}
            results.forEach((r: any) => {
              const lid = Number(r.lesson_id)
              if (!Number.isNaN(lid)) counts[lid] = (counts[lid] || 0) + 1
            })
            setAttemptsMap(counts)
          }
        }
      } catch (e) {
        // ignore user/attempt fetch errors — page still usable
      }
    } catch (error) {
  console.error('QuizSelection fetchLessons error', error)
  setFetchError((error as any)?.message || JSON.stringify(error))
      toast({
        title: "خطأ في تحميل الدروس",
        description: "تعذر تحميل قائمة الدروس",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const startQuiz = () => {
    if (!selectedLesson) {
      toast({
        title: "اختر درساً",
        description: "يجب اختيار درس لبدء الاختبار",
        variant: "destructive",
      })
      return
    }

    navigate(`/quiz/${selectedLesson}?questions=${questionCount}`)
  }

  const questionOptions = [5, 10, 15, 20]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg">جaري تحميل الدروس...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header 
        title="اختبرني" 
        showBackButton={true}
        showLogout={true}
      />

      <main className="container mx-auto px-4 py-8">
        {/* بطاقة المقدمة */}
        <Card className="card-glass mb-8">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-full flex items-center justify-center animate-float">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl gradient-text">
              اختبر معلوماتك في البرمجة
            </CardTitle>
            <CardDescription className="text-base">
              اختر الدرس الذي تريد اختبار معلوماتك فيه وحدد عدد الأسئلة
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* قائمة الدروس */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              اختر الدرس
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons.map((lesson) => (
                <Card 
                  key={lesson.id}
                  className={`cursor-pointer transition-all duration-300 ${
                    selectedLesson === lesson.id 
                      ? 'card-glass ring-2 ring-primary shadow-glow' 
                      : 'card-modern hover:shadow-lg'
                  }`}
                  onClick={() => setSelectedLesson(lesson.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary" className="text-xs">
                        الدرس {lesson.lesson_number}
                      </Badge>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>{lesson.questions_json?.length || 0} سؤال</div>
                            <div>
                              {userId ? (
                                <span className="font-medium">{Math.max(0, 3 - (attemptsMap[lesson.id] || 0))} محاولات متبقية</span>
                              ) : (
                                <span className="text-[11px]">سجّل الدخول لعرض المحاولات</span>
                              )}
                            </div>
                          </div>
                    </div>
                    <CardTitle className="text-lg">{lesson.lesson_title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {lesson.lesson_description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* لوحة الإعدادات */}
          <div>
            <Card className="card-glass sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  إعدادات الاختبار
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* عدد الأسئلة */}
                <div>
                  <label className="text-sm font-medium mb-3 block">
                    عدد الأسئلة
                  </label>
                  <Select 
                    value={questionCount.toString()} 
                    onValueChange={(value) => setQuestionCount(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {questionOptions.map((count) => (
                        <SelectItem key={count} value={count.toString()}>
                          {count} أسئلة
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* معلومات الاختبار */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>الدرس المختار:</span>
                    <span className="font-medium">
                      {selectedLesson 
                        ? lessons.find(l => l.id === selectedLesson)?.lesson_title 
                        : 'لم يتم الاختيار'
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>عدد الأسئلة:</span>
                    <span className="font-medium">{questionCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>الوقت المتوقع:</span>
                    <span className="font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {questionCount * 1.5} دقيقة
                    </span>
                  </div>
                </div>

                {/* زر البدء */}
                <Button 
                  onClick={startQuiz}
                  disabled={!selectedLesson}
                  className="w-full btn-gradient text-lg py-6"
                >
                  بدء الاختبار
                </Button>

                {!selectedLesson && (
                  <p className="text-xs text-center text-muted-foreground">
                    اختر درساً لتتمكن من بدء الاختبار
                  </p>
                )}
              </CardContent>
              {(!lessons || lessons.length === 0) && (
                <div className="text-center p-6">
                  {fetchError ? (
                    <div>
                      <div className="text-sm text-destructive">خطأ: {fetchError}</div>
                      <div><button className="btn btn-ghost mt-2" onClick={fetchLessons}>عودة الحالة</button></div>
                    </div>
                  ) : (
                    <div>لا توجد دروس</div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}