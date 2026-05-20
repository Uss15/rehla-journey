
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE public.plan_type AS ENUM ('subject', 'quarterly', 'yearly');

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  device_fingerprint TEXT,
  current_session_id TEXT,
  device_switch_count INT NOT NULL DEFAULT 0,
  device_switch_window_start TIMESTAMPTZ,
  account_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============= TEACHERS =============
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  share_percentage NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- ============= SUBJECTS =============
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 35000,
  grade_level TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- ============= CHAPTERS =============
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- ============= LESSONS =============
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_hls_url TEXT,
  pdf_url TEXT,
  duration_seconds INT,
  order_index INT NOT NULL DEFAULT 0,
  is_free_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- ============= QUIZ =============
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  score INT NOT NULL,
  total INT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- ============= CARD BATCHES =============
CREATE TABLE public.card_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id),
  plan_type public.plan_type NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  count INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.card_batches ENABLE ROW LEVEL SECURITY;

-- ============= CARDS =============
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.card_batches(id) ON DELETE SET NULL,
  code_hash TEXT NOT NULL UNIQUE,
  code_last4 TEXT NOT NULL,
  plan_type public.plan_type NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  price NUMERIC(10,2) NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE INDEX cards_code_hash_idx ON public.cards(code_hash);
CREATE INDEX cards_used_by_idx ON public.cards(used_by);

-- ============= SUBSCRIPTIONS =============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type public.plan_type NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id);
CREATE INDEX subscriptions_expires_idx ON public.subscriptions(expires_at);

-- ============= REDEMPTION ANTI-BRUTE =============
CREATE TABLE public.redemption_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip TEXT,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.redemption_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX redemption_attempts_user_idx ON public.redemption_attempts(user_id, attempted_at DESC);

CREATE TABLE public.redemption_locks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.redemption_locks ENABLE ROW LEVEL SECURITY;

-- ============= TRIGGER: auto-create profile + student role on signup =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= RLS POLICIES =============

-- profiles
CREATE POLICY "users_select_own_profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins_view_all_profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- user_roles (read only for users to know their own role; admin manages via service)
CREATE POLICY "users_view_own_roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_manage_roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- teachers: public read, admin write
CREATE POLICY "anyone_view_teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "admins_manage_teachers" ON public.teachers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- subjects: anyone view published, admin manage
CREATE POLICY "anyone_view_published_subjects" ON public.subjects FOR SELECT USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins_manage_subjects" ON public.subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- chapters: anyone view
CREATE POLICY "anyone_view_chapters" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "admins_manage_chapters" ON public.chapters FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- lessons: anyone view metadata (frontend hides video for non-subscribed)
CREATE POLICY "anyone_view_lessons" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "admins_manage_lessons" ON public.lessons FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- quiz_questions: anyone view (frontend gates by subscription)
CREATE POLICY "anyone_view_quiz" ON public.quiz_questions FOR SELECT USING (true);
CREATE POLICY "admins_manage_quiz" ON public.quiz_questions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- quiz_attempts
CREATE POLICY "users_view_own_attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_view_all_attempts" ON public.quiz_attempts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- cards: ONLY admins can view; redemption goes through server function (service role)
CREATE POLICY "admins_view_cards" ON public.cards FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins_manage_cards" ON public.cards FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- card_batches
CREATE POLICY "admins_manage_batches" ON public.card_batches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- subscriptions
CREATE POLICY "users_view_own_subs" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_view_all_subs" ON public.subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- redemption logs: admin only
CREATE POLICY "admins_view_attempts" ON public.redemption_attempts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users_view_own_redemption_attempts" ON public.redemption_attempts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_lock" ON public.redemption_locks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_view_locks" ON public.redemption_locks FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
