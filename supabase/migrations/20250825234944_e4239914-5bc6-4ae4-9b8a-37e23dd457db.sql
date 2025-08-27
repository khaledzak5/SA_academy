-- إنشاء جدول الملفات الشخصية للطلاب
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  student_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  grade VARCHAR(20) DEFAULT 'الثالث المتوسط',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء جدول الدروس
CREATE TABLE public.lessons (
  id SERIAL PRIMARY KEY,
  lesson_number INTEGER NOT NULL UNIQUE,
  lesson_title VARCHAR(200) NOT NULL,
  lesson_description TEXT,
  video_url VARCHAR(500),
  questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء جدول نتائج الاختبارات
CREATE TABLE public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id INTEGER REFERENCES public.lessons(id) NOT NULL,
  lesson_name VARCHAR(200) NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  score_percentage DECIMAL(5,2) NOT NULL,
  questions_data JSONB NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء جدول المحادثات
CREATE TABLE public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  message_type VARCHAR(10) CHECK (message_type IN ('user', 'bot')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تمكين RLS على جميع الجداول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للملفات الشخصية
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- سياسات الأمان للدروس (قراءة فقط للجميع)
CREATE POLICY "Everyone can view lessons" 
ON public.lessons FOR SELECT 
USING (true);

-- سياسات الأمان لنتائج الاختبارات
CREATE POLICY "Users can view their own quiz results" 
ON public.quiz_results FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz results" 
ON public.quiz_results FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- سياسات الأمان للمحادثات
CREATE POLICY "Users can view their own chat history" 
ON public.chat_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" 
ON public.chat_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- إدراج بيانات الدروس الأساسية
INSERT INTO public.lessons (lesson_number, lesson_title, lesson_description, video_url, questions_json) VALUES
(1, 'القوائم وصفوف البيانات', 'تعلم كيفية استخدام القوائم والمصفوفات في بايثون مع العمليات الأساسية', 'https://example.com/lesson1', '[
  {
    "id": 1,
    "question": "ما هي الطريقة الصحيحة لإنشاء قائمة فارغة في بايثون؟",
    "options": ["list = []", "list = {}", "list = ()", "list = \"\""],
    "correct": 0,
    "type": "multiple"
  },
  {
    "id": 2,
    "question": "يمكن إضافة عناصر مختلفة الأنواع في نفس القائمة",
    "options": ["صحيح", "خطأ"],
    "correct": 0,
    "type": "boolean"
  }
]'),
(2, 'المكتبات البرمجية', 'استكشاف المكتبات المدمجة والخارجية في بايثون وكيفية استيرادها', 'https://example.com/lesson2', '[
  {
    "id": 1,
    "question": "أي من هذه المكتبات مدمجة في بايثون؟",
    "options": ["numpy", "pandas", "math", "requests"],
    "correct": 2,
    "type": "multiple"
  }
]'),
(3, 'بناء الواجهات الرسومية بلغة بايثون', 'تعلم إنشاء واجهات المستخدم الرسومية باستخدام Tkinter', 'https://example.com/lesson3', '[
  {
    "id": 1,
    "question": "ما هي المكتبة الأساسية لإنشاء واجهات رسومية في بايثون؟",
    "options": ["PyQt", "Tkinter", "Kivy", "wxPython"],
    "correct": 1,
    "type": "multiple"
  }
]'),
(4, 'القواميس', 'فهم هياكل البيانات المتقدمة: القواميس وطرق التعامل معها', 'https://example.com/lesson4', '[
  {
    "id": 1,
    "question": "القاموس في بايثون يحتوي على مفاتيح وقيم",
    "options": ["صحيح", "خطأ"],
    "correct": 0,
    "type": "boolean"
  }
]'),
(5, 'القوائم المتداخلة', 'العمل مع القوائم ثنائية وثلاثية الأبعاد والتطبيقات العملية', 'https://example.com/lesson5', '[
  {
    "id": 1,
    "question": "كيف نصل للعنصر الثاني في القائمة الأولى من [[1,2,3],[4,5,6]]؟",
    "options": ["[0][1]", "[1][0]", "[0][2]", "[1][1]"],
    "correct": 0,
    "type": "multiple"
  }
]'),
(6, 'الملفات', 'قراءة وكتابة الملفات النصية ومعالجة البيانات المحفوظة', 'https://example.com/lesson6', '[
  {
    "id": 1,
    "question": "ما هو الأمر الصحيح لفتح ملف للقراءة؟",
    "options": ["open(\"file.txt\", \"r\")", "read(\"file.txt\")", "file(\"file.txt\")", "open(\"file.txt\", \"w\")"],
    "correct": 0,
    "type": "multiple"
  }
]');

-- إنشاء function لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء triggers للتحديث التلقائي
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();