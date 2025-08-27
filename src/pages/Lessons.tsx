import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PlayCircle, CheckCircle, Lock, Clock } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Lesson {
  id: number
  lesson_title: string
  lesson_description: string | null
  lesson_number: number
  video_url: string | null
  questions_json: any
}

export function Lessons() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [completedLessons, setCompletedLessons] = useState<string[]>([])
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    fetchLessons()
  }, [])

  const fetchLessons = async () => {
    try {
      setFetchError(null)
      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .order('lesson_number')

      if (lessonsError) {
        console.error('Supabase lessons error', lessonsError)
        setFetchError(lessonsError.message || JSON.stringify(lessonsError))
        throw lessonsError
      }

      setLessons(lessons || [])
    } catch (error) {
      toast({
        title: "خطأ في تحميل الدروس",
        description: "حدث خطأ أثناء تحميل الدروس",
        variant: "destructive",
      })
      console.error('fetchLessons catch', error)
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    return 'bg-primary'
  }

  const getDifficultyText = (lessonNumber: number) => {
    if (lessonNumber <= 3) return 'مبتدئ'
    if (lessonNumber <= 6) return 'متوسط'
    return 'متقدم'
  }

  const isLessonUnlocked = (lessonIndex: number) => {
    if (lessonIndex === 0) return true
    return completedLessons.includes(lessons[lessonIndex - 1]?.id.toString())
  }

  const completionRate = (completedLessons.length / lessons.length) * 100

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="الدروس" showBackButton />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">جاري التحميل...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="الدروس" showBackButton />
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* شريط التقدم */}
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="text-center">تقدمك في الدروس</CardTitle>
            <CardDescription className="text-center">
              أكملت {completedLessons.length} من {lessons.length} درس
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={completionRate} className="w-full h-3" />
            <p className="text-center mt-2 text-sm text-muted-foreground">
              {Math.round(completionRate)}% مكتمل
            </p>
          </CardContent>
        </Card>

        {/* قائمة الدروس */}
        <div className="grid gap-4 md:gap-6">
        {lessons.map((lesson, index) => {
          const isCompleted = completedLessons.includes(lesson.id.toString())
          const isUnlocked = isLessonUnlocked(index)

          return (
            <Card 
              key={lesson.id} 
              className={`card-modern transition-all duration-300 ${
                isUnlocked ? 'hover:shadow-lg cursor-pointer' : 'opacity-60'
              }`}
              onClick={() => isUnlocked && navigate(`/lesson/${lesson.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 space-x-reverse flex-1">
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="h-12 w-12 text-green-500" />
                      ) : isUnlocked ? (
                        <PlayCircle className="h-12 w-12 text-primary" />
                      ) : (
                        <Lock className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-card-foreground mb-2">
                        {lesson.lesson_title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-3">
                        {lesson.lesson_description || `الدرس رقم ${lesson.lesson_number}`}
                      </p>
                      
                      <div className="flex items-center space-x-4 space-x-reverse flex-wrap gap-2">
                        <Badge className={getDifficultyColor('default')}>
                          {getDifficultyText(lesson.lesson_number)}
                        </Badge>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          30 دقيقة
                        </div>
                      </div>
                    </div>
                  </div>
                    
                    {isUnlocked && (
                      <Button 
                        variant={isCompleted ? "outline" : "default"}
                        size="sm"
                        className="mr-4"
                      >
                        {isCompleted ? "مراجعة" : "بدء الدرس"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
            {(!lessons || lessons.length === 0) && (
              <div className="text-center p-6">
                {fetchError ? (
                  <div className="space-y-2">
                    <div className="text-sm text-destructive">\u062e\u0637\u0623: {fetchError}</div>
                    <div>
                      <button className="btn btn-ghost mt-2" onClick={fetchLessons}>\u0639\u0627\u0648\u062f \u0627\u0644\u062d\u0627\u0644\u0629</button>
                    </div>
                  </div>
                ) : (
                  <div>\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0633\u0626\u0644\u0629 \u0644\u0647\u0632\u0627 \u0627\u0644\u062f\u0631\u0633</div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}