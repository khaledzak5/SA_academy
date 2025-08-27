import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [userDetails, setUserDetails] = useState<any | null>(null)
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    ;(async () => {
      try {
        const s = await supabase.auth.getSession()
        const uid = (s as any)?.data?.session?.user?.id || null
        setCurrentUid(uid)

        // attempt RPC is_admin (may not exist if migration not applied)
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('is_admin')
          if (!rpcErr) setIsAdmin(Boolean((rpcData as any)))
          else setIsAdmin(null)
        } catch (e) {
          setIsAdmin(null)
        }
      } catch (e) {
        setCurrentUid(null)
        setIsAdmin(null)
      }

      loadUsers()
    })()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      // load profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, student_id, grade')

      if (profilesError) throw profilesError

      const userIds = (profiles || []).map((p: any) => p.user_id)

      // fetch all quizzes for these users in one request
      let quizzesAll: any[] = []
      if (userIds.length) {
        const { data: quizzes, error: quizzesError } = await supabase
          .from('quiz_results')
          .select('user_id, score_percentage, lesson_id, completed_at')
          .in('user_id', userIds)

        if (quizzesError) throw quizzesError
        quizzesAll = quizzes || []
      }

      const rows = (profiles || []).map((p: any) => {
        const userQuizzes = quizzesAll.filter(q => q.user_id === p.user_id)
        const totalQuizzes = userQuizzes.length
        const averageScore = totalQuizzes > 0 ? Math.round(userQuizzes.reduce((s, q) => s + Number(q.score_percentage), 0) / totalQuizzes) : 0
        const completedLessons = new Set(userQuizzes.map(q => q.lesson_id)).size
        const lastTaken = userQuizzes.length ? userQuizzes.reduce((a, b) => (new Date(a.completed_at) > new Date(b.completed_at) ? a : b)).completed_at : null

        return {
          user_id: p.user_id,
          full_name: p.full_name,
          student_id: p.student_id,
          grade: p.grade,
          totalQuizzes,
          averageScore,
          completedLessons,
          lastTaken,
        }
      })

      setUsers(rows)
    } catch (err: any) {
      console.error('Admin load users error', err)
      toast({ title: 'خطأ', description: `تعذر جلب المستخدمين: ${err?.message || err}`, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const openUser = async (user: any) => {
    setSelectedUser(user)
    try {
      const { data } = await supabase
        .from('quiz_results')
        .select('id, lesson_id, lesson_name, total_questions, correct_answers, score_percentage, questions_data, completed_at')
        .eq('user_id', user.user_id)
        .order('completed_at', { ascending: false })

      setUserDetails(data || [])
    } catch (err) {
      console.error('Error loading user details', err)
      toast({ title: 'خطأ', description: 'تعذر جلب تفاصيل المستخدم', variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header title="لوحة إدارة" showLogout={true} />
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>إدارة المستخدمين</CardTitle>
          </CardHeader>
      <CardContent>
        <div className="mb-4 text-sm text-muted-foreground">معرف الجلسة: {currentUid || '-'} • مدير؟: {isAdmin === null ? 'غير معروف' : isAdmin ? 'نعم' : 'لا'}</div>
        <div className="flex items-center justify-between mb-4">
                <div></div>
                <div>
                  <Button onClick={loadUsers} className="btn-gradient">تحديث</Button>
                </div>
              </div>
              {loading ? (
                <div>جاري التحميل...</div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم المستخدم</TableHead>
                    <TableHead>معرف الطالب</TableHead>
                    <TableHead>المعدل</TableHead>
                    <TableHead>إجمالي الاختبارات</TableHead>
                    <TableHead>الدروس المكتملة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.user_id} className="cursor-pointer">
                      <TableCell>{u.full_name}</TableCell>
                      <TableCell>{u.student_id}</TableCell>
                      <TableCell>{u.averageScore}%</TableCell>
                      <TableCell>{u.totalQuizzes}</TableCell>
                      <TableCell>{u.completedLessons}/6</TableCell>
                      <TableCell>{u.lastTaken ? new Date(u.lastTaken).toLocaleString('ar-SA') : '-'}</TableCell>
                      <TableCell>
                        <Button onClick={() => openUser(u)}>عرض</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedUser} onOpenChange={(o) => { if (!o) { setSelectedUser(null); setUserDetails(null) } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تفاصيل المستخدم</DialogTitle>
              <DialogDescription>{selectedUser?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3 max-h-72 overflow-auto">
              {userDetails && userDetails.length === 0 && <div>لا توجد نتائج لهذا المستخدم.</div>}
              {userDetails && userDetails.map((r: any) => (
                <div key={r.id} className="p-3 border rounded">
                  <div className="font-medium">{r.lesson_name || `الدرس ${r.lesson_id}`} - {r.score_percentage}%</div>
                  <div className="text-sm text-muted-foreground">أسئلة: {r.total_questions} • صحيحة: {r.correct_answers} • {new Date(r.completed_at).toLocaleString('ar-SA')}</div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
