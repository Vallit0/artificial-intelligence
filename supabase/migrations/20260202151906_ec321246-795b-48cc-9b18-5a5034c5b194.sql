-- Fix final_grade precision to allow 100
ALTER TABLE public.student_grades 
ALTER COLUMN final_grade TYPE numeric(5,2);