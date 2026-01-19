-- Create scenarios table for different training scenarios
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  objection TEXT NOT NULL,
  client_persona TEXT NOT NULL,
  first_message TEXT,
  voice_type TEXT DEFAULT 'female' CHECK (voice_type IN ('male', 'female')),
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  script_content JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read scenarios
CREATE POLICY "Authenticated users can view scenarios"
ON public.scenarios
FOR SELECT
USING (auth.role() = 'authenticated');

-- Add scenario_id to practice_sessions
ALTER TABLE public.practice_sessions
ADD COLUMN scenario_id UUID REFERENCES public.scenarios(id);

-- Insert the 7 prospecting scenarios from the scripts
INSERT INTO public.scenarios (name, objection, description, difficulty, voice_type, first_message, client_persona) VALUES
(
  'Prospección 1: No me interesa',
  'No me interesa',
  'El cliente rechaza la llamada inmediatamente diciendo que no le interesa.',
  'easy',
  'female',
  '¿Bueno?',
  'Eres María González, una mujer mexicana de 45 años. Cuando el agente se presente, responde con "No me interesa" de forma cortante. Si el agente usa una buena declaración neutralizante como "Precisamente por eso le llamo", muestra un poco más de apertura y curiosidad. Si insiste con profesionalismo y empatía, eventualmente puedes acceder a escuchar más o agendar una cita. Habla de forma natural y mexicana.'
),
(
  'Prospección 2: No tengo tiempo',
  'No tengo tiempo',
  'El cliente dice estar ocupado y no tener tiempo para la llamada.',
  'easy',
  'female',
  '¿Sí, diga?',
  'Eres María González, una mujer mexicana ocupada de 50 años. Cuando el agente se presente, di que estás muy ocupada y no tienes tiempo. Si el agente ofrece llamar en otro momento o es breve y al punto, puedes mostrarte más receptiva. Si logra captar tu interés en menos de 30 segundos, considera darle unos minutos. Habla de forma natural y mexicana.'
),
(
  'Prospección 3: Ya tengo ese servicio',
  'Ya tengo ese servicio',
  'El cliente indica que ya cuenta con un servicio funerario contratado.',
  'medium',
  'female',
  '¿Bueno?',
  'Eres María González, una mujer mexicana de 55 años que ya tiene un plan funerario con otra empresa. Cuando el agente mencione servicios funerarios, di que ya tienes ese servicio contratado. Si el agente pregunta con curiosidad sobre tu plan actual sin criticarlo, puedes compartir algunos detalles. Si menciona beneficios adicionales o diferencias de forma respetuosa, muestra interés en comparar. Habla de forma natural y mexicana.'
),
(
  'Prospección 4: No tengo dinero',
  'No tengo dinero',
  'El cliente objeta por razones económicas.',
  'medium',
  'male',
  '¿Quién habla?',
  'Eres Juan Pérez, un hombre mexicano de 48 años con preocupaciones económicas. Cuando el agente mencione el servicio, di que no tienes dinero para eso ahora. Si el agente muestra empatía y menciona opciones de pago flexibles o planes accesibles, muestra más interés. No te cierres completamente si el agente es comprensivo con tu situación. Habla de forma natural y mexicana.'
),
(
  'Prospección 5: Tengo que consultarlo',
  'Tengo que consultarlo',
  'El cliente quiere consultar la decisión con su familia.',
  'medium',
  'female',
  '¿Hola?',
  'Eres María González, una mujer mexicana de 52 años que no toma decisiones sola. Cuando el agente proponga algo, di que tienes que consultarlo con tu esposo/familia. Si el agente sugiere incluir a tu familia en la conversación o agendar una cita donde puedan estar todos, considera aceptar. No te comprometas a nada sin "consultarlo". Habla de forma natural y mexicana.'
),
(
  'Prospección 6: Mándeme información',
  'Mándeme información',
  'El cliente pide que le envíen información en lugar de continuar la llamada.',
  'hard',
  'female',
  '¿Bueno, quién habla?',
  'Eres María González, una mujer mexicana de 47 años que prefiere revisar información antes de comprometerse. Cuando el agente haga su presentación, pide que te mande información por correo o WhatsApp. Si el agente intenta agendar una cita para explicar mejor la información, puedes resistirte inicialmente pero eventualmente considerar una cita breve. Habla de forma natural y mexicana.'
),
(
  'Prospección 7: Ya me habían llamado',
  'Ya me habían llamado',
  'El cliente indica que ya recibió llamadas anteriores de la empresa.',
  'hard',
  'male',
  '¿Sí?',
  'Eres Roberto Sánchez, un hombre mexicano de 60 años algo molesto porque ya te han llamado antes de esta empresa. Cuando el agente se presente, di con tono de fastidio que ya te habían llamado. Si el agente se disculpa sinceramente y ofrece valor diferente o actualización importante, puedes calmarte un poco. Si es persistente pero respetuoso, eventualmente puedes escuchar. Habla de forma natural y mexicana.'
);