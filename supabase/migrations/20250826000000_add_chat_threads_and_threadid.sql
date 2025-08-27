-- Create chat_threads table to hold conversation sessions
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'محادثة جديدة',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add thread_id column to chat_history to link messages to a thread
ALTER TABLE public.chat_history
  ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.chat_threads(id);

-- Ensure RLS still applies (users can view/insert their own messages)
-- Existing policies on chat_history using auth.uid() = user_id remain valid.
