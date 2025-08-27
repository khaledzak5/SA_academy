import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, ArrowRight, ArrowLeft } from "lucide-react"
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

export function LessonDetail() {
  const { id } = useParams<{ id: string }>()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    if (id) {
      fetchLesson()
    }
  }, [id])

  const fetchLesson = async () => {
    if (!id) return

    try {
      const { data: lesson, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', parseInt(id))
        .single()

      if (error) throw error

      setLesson(lesson)
    } catch (error) {
      toast({
        title: "خطأ في تحميل الدرس",
        description: "حدث خطأ أثناء تحميل محتوى الدرس",
        variant: "destructive",
      })
      navigate('/lessons')
    } finally {
      setLoading(false)
    }
  }

  const markAsCompleted = async () => {
    if (!lesson) return

    try {
      setIsCompleted(true)
      toast({
        title: "تهانينا! 🎉",
        description: "لقد أكملت الدرس بنجاح",
      })
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ التقدم",
        variant: "destructive",
      })
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-500'
      case 'intermediate':
        return 'bg-yellow-500'
      case 'advanced':
        return 'bg-red-500'
      default:
        return 'bg-primary'
    }
  }

  const getDifficultyText = (lessonNumber: number) => {
    if (lessonNumber <= 3) return 'مبتدئ'
    if (lessonNumber <= 6) return 'متوسط'
    return 'متقدم'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="الدرس" showBackButton />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">جاري التحميل...</div>
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="الدرس غير موجود" showBackButton />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">الدرس غير موجود</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title={lesson.lesson_title} showBackButton />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* معلومات الدرس */}
        <Card className="card-modern mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4 space-x-reverse">
                <Badge className={getDifficultyColor('default')}>
                  {getDifficultyText(lesson.lesson_number)}
                </Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  30 دقيقة
                </div>
              </div>
              
              {isCompleted && (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  مكتمل
                </div>
              )}
            </div>
            
            <p className="text-muted-foreground mb-4">
              {lesson.lesson_description || `الدرس رقم ${lesson.lesson_number} - تعلم أساسيات البرمجة`}
            </p>
          </CardContent>
        </Card>

        {/* محتوى الدرس */}
        <Card className="card-modern mb-6">
          <CardContent className="p-6">
            <div className="prose prose-lg max-w-none dark:prose-invert text-right">
              <h2>محتوى الدرس</h2>
              <p>
                هذا هو الدرس رقم {lesson.lesson_number}: {lesson.lesson_title}
              </p>
              <p>
                {lesson.lesson_description || 'ستتعلم في هذا الدرس المفاهيم الأساسية للبرمجة وكيفية تطبيقها عملياً.'}
              </p>
              
              {lesson.video_url && (
                <div className="my-6">
                  <h3>فيديو الشرح</h3>
                  <video 
                    src={lesson.video_url} 
                    controls 
                    className="w-full rounded-lg"
                  >
                    متصفحك لا يدعم تشغيل الفيديو
                  </video>
                </div>
              )}

              <div className="my-6">
                <h3>النقاط الرئيسية</h3>
                <ul>
                  <li>فهم المفاهيم الأساسية</li>
                  <li>التطبيق العملي</li>
                  <li>حل المشاكل</li>
                  <li>التدرب على الأمثلة</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* أزرار التنقل */}
        <div className="flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={() => navigate('/lessons')}
            className="flex items-center"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            العودة للدروس
          </Button>

          <div className="flex space-x-4 space-x-reverse">
            {!isCompleted && (
              <Button 
                onClick={markAsCompleted}
                className="btn-gradient"
              >
                إنهاء الدرس
                <CheckCircle className="h-4 w-4 mr-2" />
              </Button>
            )}
            
            <Button 
              variant="outline"
              onClick={() => navigate('/quiz-selection')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 ml-2" />
              الانتقال للامتحانات
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}