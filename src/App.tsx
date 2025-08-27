import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import QuizSelection from "./pages/QuizSelection";
import { Lessons } from "./pages/Lessons";
import { LessonDetail } from "./pages/LessonDetail";
import { Chat } from "./pages/Chat";
import Quiz from "./pages/Quiz";
import NotFound from "./pages/NotFound";
import AdminPage from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard /> : <Navigate to="/auth" />} 
            />
            <Route 
              path="/quiz-selection" 
              element={user ? <QuizSelection /> : <Navigate to="/auth" />} 
            />
            <Route 
              path="/lessons" 
              element={user ? <Lessons /> : <Navigate to="/auth" />} 
            />
            <Route 
              path="/lesson/:id" 
              element={user ? <LessonDetail /> : <Navigate to="/auth" />} 
            />
            <Route 
              path="/chat" 
              element={user ? <Chat /> : <Navigate to="/auth" />} 
            />
            <Route
              path="/quiz/:id"
              element={user ? <Quiz /> : <Navigate to="/auth" />}
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
