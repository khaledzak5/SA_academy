import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { 
  BookOpen, 
  Brain, 
  MessageCircle, 
  Play, 
  Trophy, 
  TrendingUp,
  Target,
  Clock
} from "lucide-react"

interface Profile {
  full_name: string
  student_id: string
  grade: string
}

interface QuizStats {
  totalQuizzes: number
  averageScore: number
  bestScore: number
  completedLessons: number
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<QuizStats>({
    totalQuizzes: 0,
    averageScore: 0,
    bestScore: 0,
    completedLessons: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()
  const [quizDialogOpen, setQuizDialogOpen] = useState(false)
  const [quizResultsList, setQuizResultsList] = useState<any[] | null>(null)
  const [loadingQuizResults, setLoadingQuizResults] = useState(false)
  const [completedLessonsList, setCompletedLessonsList] = useState<string[]>([]);

  useEffect(() => {
    fetchUserData()
  }, [])

  useEffect(() => {
    const completed = JSON.parse(localStorage.getItem('completedLessons') || '[]')
    setCompletedLessonsList(completed)
    // للتحديث عند تركيز الصفحة
    const handler = () => {
      const comp = JSON.parse(localStorage.getItem('completedLessons') || '[]')
      setCompletedLessonsList(comp)
    }
    window.addEventListener('focus', handler)
    return () => {
      window.removeEventListener('focus', handler);
    }
  }, []);

  const lessonsCount = 6; // عدل إذا كان هناك دروس أكثر
  const dashboardCompletion = (completedLessonsList.length / lessonsCount) * 100;

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        navigate('/auth')
        return
      }

      // debug: ensure we know current user id
      console.debug('Dashboard fetchUserData - current user id', user.id)

      // جلب الملف الشخصي
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profileError) {
        // PGRST116 is "No rows found"
        console.error('Error fetching profile:', profileError)
        if (profileError.code !== 'PGRST116') {
          // show toast to surface DB errors
          toast({ title: 'خطأ في الملف الشخصي', description: profileError.message || JSON.stringify(profileError), variant: 'destructive' })
        }
      }
      if (profileData) setProfile(profileData)

      // جلب إحصائيات الاختبارات
      const { data: quizData, error: quizError } = await supabase
        .from('quiz_results')
        .select('score_percentage, lesson_id')
        .eq('user_id', user.id)

      if (quizError) {
        console.error('Error fetching quiz results:', quizError)
        toast({ title: 'خطأ في جلب نتائج الاختبارات', description: quizError.message || JSON.stringify(quizError), variant: 'destructive' })
      }
      if (quizData) {
        const totalQuizzes = quizData.length
        const averageScore = totalQuizzes > 0 
          ? quizData.reduce((sum, quiz) => sum + quiz.score_percentage, 0) / totalQuizzes 
          : 0
        const bestScore = totalQuizzes > 0 
          ? Math.max(...quizData.map(quiz => quiz.score_percentage)) 
          : 0
        const completedLessons = new Set(quizData.map(quiz => quiz.lesson_id)).size

  setStats({
          totalQuizzes,
          averageScore: Math.round(averageScore),
          bestScore: Math.round(bestScore),
          completedLessons
        })
      }

    } catch (error) {
      toast({
        title: "خطأ في تحميل البيانات",
        description: "تعذر تحميل بياناتك الشخصية",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadQuizResults = async () => {
    setLoadingQuizResults(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: 'خطأ', description: 'المستخدم غير مسجل', variant: 'destructive' })
        return
      }

      const { data, error } = await supabase
        .from('quiz_results')
        .select('id, lesson_id, lesson_name, score_percentage, total_questions, correct_answers, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      if (error) {
        console.error('Supabase returned error:', error)
        toast({ title: 'خطأ في الاستعلام', description: `Supabase: ${error.message || error.code || JSON.stringify(error)}`, variant: 'destructive' })
        setQuizResultsList([])
      } else {
        setQuizResultsList(data || [])
      }
    } catch (err: any) {
      console.error('Error loading quiz results', err)
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err))
      toast({ title: 'خطأ', description: `تعذر جلب نتائج الاختبارات: ${msg}`, variant: 'destructive' })
    } finally {
      setLoadingQuizResults(false)
    }
  }

  const quickActions = [
    {
      title: "اختبرني",
      description: "ابدأ اختباراً جديداً في أي من الدروس",
      icon: Brain,
      color: "from-primary to-accent",
      onClick: () => navigate('/quiz-selection')
    },
    {
      title: "مساعدي الذكي",
      description: "اسأل الذكاء الاصطناعي عن أي شيء في البرمجة",
      icon: MessageCircle,
      color: "from-accent to-secondary",
      onClick: () => navigate('/chat')
    },
    {
      title: "الدروس",
      description: "شاهد فيديوهات الدروس التعليمية",
      icon: Play,
      color: "from-secondary to-primary",
      onClick: () => navigate('/lessons')
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen p-6 bg-gradient-hero">
      {/* light-mode frame using Deeper Sage, hidden in dark mode */}
      <div className="h-full rounded-lg border-4 border-[#6B8E6B] dark:border-transparent">
      <Header 
        title="لوحة التحكم" 
        showLogout={true}
        userName={profile?.full_name}
      />

      <main className="container mx-auto px-4 py-8">
  {/* بطاقة الترحيب */}
  <Card className="card-glass mb-8 bg-[#CFE8CF] dark:bg-card-glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl gradient-text">
                  مرحباً {profile?.full_name || 'طالب'} 👋
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  معرف الطالب: {profile?.student_id} • {profile?.grade}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">اليوم</div>
                <div className="text-lg font-semibold">
                  {new Date().toLocaleDateString('ar-SA', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="card-modern bg-[#CFE8CF] dark:bg-card-modern cursor-pointer" onClick={() => { setQuizDialogOpen(true); loadQuizResults(); }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الاختبارات</p>
                  <p className="text-3xl font-bold text-primary">{stats.totalQuizzes}</p>
                </div>
                <Trophy className="w-8 h-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern bg-[#CFE8CF] dark:bg-card-modern">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">متوسط الدرجات</p>
                  <p className="text-3xl font-bold text-accent">{stats.averageScore}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-accent opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern bg-[#CFE8CF] dark:bg-card-modern">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">أفضل نتيجة</p>
                  <p className="text-3xl font-bold text-secondary">{stats.bestScore}%</p>
                </div>
                <Target className="w-8 h-8 text-secondary opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern bg-[#CFE8CF] dark:bg-card-modern">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">الدروس المكتملة</p>
                  <p className="text-3xl font-bold text-primary">{stats.completedLessons}/6</p>
                </div>
                <BookOpen className="w-8 h-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* التقدم الإجمالي */}
  <Card className="card-glass mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              تقدمك في المنهج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>نسبة إكمال الدروس</span>
                <span>{Math.round(dashboardCompletion)}%</span>
              </div>
              <Progress 
                value={dashboardCompletion} 
                className="h-3"
              />
              <p className="text-xs text-muted-foreground text-center">
                أكملت {completedLessonsList.length} من {lessonsCount} درس — {lessonsCount - completedLessonsList.length} دروس متبقية
              </p>
            </div>
          </CardContent>
        </Card>

        {/* الإجراءات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => (
            <Card 
              key={index} 
              className="card-glass interactive-hover cursor-pointer group bg-[#E6F6E6] dark:bg-card-glass"
              onClick={action.onClick}
            >
              <CardContent className="p-6 text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl mb-2 group-hover:gradient-text transition-all duration-300">
                  {action.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {action.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
  </div>
  </div>
      {/* Quiz Results Dialog */}
      <Dialog open={quizDialogOpen} onOpenChange={(open) => { setQuizDialogOpen(open); if (!open) setQuizResultsList(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>نتائج الاختبارات</DialogTitle>
            <DialogDescription>قائمة بكل الاختبارات التي قمت بها ودرجاتها.</DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {loadingQuizResults ? (
              <div className="text-center">جاري التحميل...</div>
            ) : !quizResultsList || quizResultsList.length === 0 ? (
              <div className="text-center">لم تقم بأي اختبارات بعد.</div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-auto">
                {quizResultsList.map((r) => (
                  <div key={r.id} className="p-3 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.lesson_name || `الدرس ${r.lesson_id}`}</div>
                      <div className="text-sm text-muted-foreground">أسئلة: {r.total_questions} • صحيحة: {r.correct_answers}</div>
                      <div className="text-xs text-muted-foreground">التاريخ: {new Date(r.completed_at).toLocaleString('ar-SA')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{r.score_percentage}%</div>
                      <div className="text-sm text-muted-foreground">درجة الاختبار</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <div className="ml-auto">
              <Button variant="ghost" onClick={() => setQuizDialogOpen(false)}>إغلاق</Button>
            </div>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  </>
  )
}