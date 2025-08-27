import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface HeaderProps {
  title: string
  showBackButton?: boolean
  showLogout?: boolean
  userName?: string
}

export function Header({ title, showBackButton = false, showLogout = false, userName }: HeaderProps) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/auth')
      toast({
        title: "تم تسجيل الخروج بنجاح",
        description: "نراك قريباً!",
      })
    } catch (error) {
      toast({
        title: "خطأ في تسجيل الخروج",
        description: "حدث خطأ أثناء تسجيل الخروج",
        variant: "destructive",
      })
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 dark:bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* العنوان والزر الخلفي */}
          <div className="flex items-center space-x-4 space-x-reverse">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="hover:bg-primary/10"
              >
                ← العودة
              </Button>
            )}
            <h1 className="text-xl font-bold gradient-text">{title}</h1>
          </div>

          {/* أدوات التنقل */}
          <div className="flex items-center space-x-3 space-x-reverse">
            {userName && (
              <div className="flex items-center space-x-2 space-x-reverse text-sm">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{userName}</span>
              </div>
            )}
            
            <ThemeToggle />
            
            {showLogout && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                خروج
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}