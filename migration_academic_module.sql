-- ============================================================
-- Migration: Módulo Acadêmico — Cursos, Turmas, Matrículas, Visitas
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- ============================================================

-- 1. CURSOS
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  modality text DEFAULT 'presential' CHECK (modality IN ('presential', 'online', 'hybrid')),
  duration_hours integer,
  price numeric(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Courses viewable by institution members"
  ON public.courses FOR SELECT
  USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage courses"
  ON public.courses FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2. TURMAS
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  teacher_name text,
  schedule text,             -- Ex: "Seg/Qua/Sex 19h–21h"
  start_date date,
  end_date date,
  total_slots integer DEFAULT 30,
  filled_slots integer DEFAULT 0,
  meeting_url text,          -- Para turmas online/híbridas
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled', 'finished')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Classes viewable by institution members"
  ON public.classes FOR SELECT
  USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage classes"
  ON public.classes FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. MATRÍCULAS
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE RESTRICT NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  student_name text NOT NULL,
  student_email text,
  student_phone text,
  student_cpf text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'locked', 'finished', 'cancelled')),
  notes text,
  enrolled_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrollments viewable by institution members"
  ON public.enrollments FOR SELECT
  USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Members can manage enrollments"
  ON public.enrollments FOR ALL
  USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

-- 4. AGENDAMENTOS DE VISITA
CREATE TABLE IF NOT EXISTS public.visit_appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name text NOT NULL,
  lead_phone text,
  scheduled_at timestamptz NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'done', 'cancelled', 'no_show')),
  notes text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.visit_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visits viewable by institution members"
  ON public.visit_appointments FOR SELECT
  USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Members can manage visits"
  ON public.visit_appointments FOR ALL
  USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE TRIGGER on_course_updated
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_class_updated
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_enrollment_updated
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_visit_updated
  BEFORE UPDATE ON public.visit_appointments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ============================================================
-- ÍNDICES de performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_courses_institution ON public.courses (institution_id, is_active);
CREATE INDEX IF NOT EXISTS idx_classes_course ON public.classes (course_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON public.enrollments (class_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_lead ON public.enrollments (lead_id);
CREATE INDEX IF NOT EXISTS idx_visits_institution ON public.visit_appointments (institution_id, scheduled_at DESC);

-- ============================================================
-- Verificação final
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('courses', 'classes', 'enrollments', 'visit_appointments')
ORDER BY table_name;
