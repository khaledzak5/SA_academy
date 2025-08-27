import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Lock, User, BookOpen } from "lucide-react"

export default function Auth() {
  const [studentId, setStudentId] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    // التحقق من تسجيل الدخول المسبق
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        navigate('/')
      }
    }
    checkUser()
  }, [navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // للتجربة - استخدام email مؤقت
      const email = `${studentId}@student.academy.sa`
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Authentication failed
        console.error('Sign in error', error)
        toast({ title: 'فشل تسجيل الدخول', description: error.message || 'خطأ في بيانات الاعتماد', variant: 'destructive' })
        return
      }

      // Successful sign in
      const user = (data as any)?.user
      if (!user) {
        toast({ title: 'خطأ', description: 'لم يتم العثور على جلسة المستخدم بعد تسجيل الدخول' })
        return
      }

      // Ensure profile exists (create or upsert default profile on first login)
      try {
        await supabase.from('profiles').upsert({
          user_id: user.id,
          student_id: studentId,
          full_name: studentId,
          grade: 'الثالث المتوسط'
        }, { onConflict: 'user_id' })

        // fetch profile to decide redirect
        const res = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        const profileData: any = (res as any).data

        if (profileData?.role === 'admin') {
          toast({ title: 'مرحباً مدير النظام', description: 'تم تسجيل الدخول كمدير' })
          navigate('/admin')
          return
        }

        toast({ title: 'أهلاً وسهلاً!', description: 'تم تسجيل الدخول بنجاح' })
        navigate('/')
      } catch (err) {
        console.error('Profile upsert error', err)
        toast({ title: 'تم تسجيل الدخول', description: 'لكن حدث خطأ صغير أثناء تجهيز ملفك الشخصي' })
        navigate('/')
      }

    } catch (error) {
      toast({
        title: "خطأ غير متوقع",
        description: "حدث خطأ أثناء تسجيل الدخول",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero relative overflow-hidden">
      {/* خلفية متحركة */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay: '1s'}}></div>
      </div>

      {/* زر تبديل الوضع */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* نموذج تسجيل الدخول */}
      <Card className="w-full max-w-md mx-4 card-glass relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center animate-float">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold gradient-text">
            الوحدة الرابعة
          </CardTitle>
          <CardDescription className="text-base">
            الصف الثالث المتوسط - تسجيل الدخول
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="studentId" className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                معرف الطالب
              </Label>
              <Input
                id="studentId"
                type="text"
                placeholder="أدخل معرف الطالب"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                className="text-center font-english"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                كلمة المرور
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-center"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-gradient font-medium text-lg py-6"
              disabled={isLoading || !studentId || !password}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  جاري تسجيل الدخول...
                </div>
              ) : (
                'تسجيل الدخول'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              مرحباً بك في منصة التعلم الذكية
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              للحصول على حساب جديد، تواصل مع إدارة المدرسة
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}