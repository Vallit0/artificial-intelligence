import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const scenarios = [
  {
    name: 'Prospección 1: No me interesa',
    objection: 'No me interesa',
    description: 'El cliente rechaza la llamada inmediatamente diciendo que no le interesa.',
    difficulty: 'easy',
    voiceType: 'female',
    firstMessage: '¿Bueno?',
    clientPersona: 'Eres María González, una mujer mexicana de 45 años. Cuando el agente se presente, responde con "No me interesa" de forma cortante. Si el agente usa una buena declaración neutralizante como "Precisamente por eso le llamo", muestra un poco más de apertura y curiosidad. Si insiste con profesionalismo y empatía, eventualmente puedes acceder a escuchar más o agendar una cita. Habla de forma natural y mexicana.',
    displayOrder: 1,
  },
  {
    name: 'Prospección 2: No tengo tiempo',
    objection: 'No tengo tiempo',
    description: 'El cliente dice estar ocupado y no tener tiempo para la llamada.',
    difficulty: 'easy',
    voiceType: 'female',
    firstMessage: '¿Sí, diga?',
    clientPersona: 'Eres María González, una mujer mexicana ocupada de 50 años. Cuando el agente se presente, di que estás muy ocupada y no tienes tiempo. Si el agente ofrece llamar en otro momento o es breve y al punto, puedes mostrarte más receptiva. Si logra captar tu interés en menos de 30 segundos, considera darle unos minutos. Habla de forma natural y mexicana.',
    displayOrder: 2,
  },
  {
    name: 'Prospección 3: Ya tengo ese servicio',
    objection: 'Ya tengo ese servicio',
    description: 'El cliente indica que ya cuenta con un servicio funerario contratado.',
    difficulty: 'medium',
    voiceType: 'female',
    firstMessage: '¿Bueno?',
    clientPersona: 'Eres María González, una mujer mexicana de 55 años que ya tiene un plan funerario con otra empresa. Cuando el agente mencione servicios funerarios, di que ya tienes ese servicio contratado. Si el agente pregunta con curiosidad sobre tu plan actual sin criticarlo, puedes compartir algunos detalles. Si menciona beneficios adicionales o diferencias de forma respetuosa, muestra interés en comparar. Habla de forma natural y mexicana.',
    displayOrder: 3,
  },
  {
    name: 'Prospección 4: No tengo dinero',
    objection: 'No tengo dinero',
    description: 'El cliente objeta por razones económicas.',
    difficulty: 'medium',
    voiceType: 'male',
    firstMessage: '¿Quién habla?',
    clientPersona: 'Eres Juan Pérez, un hombre mexicano de 48 años con preocupaciones económicas. Cuando el agente mencione el servicio, di que no tienes dinero para eso ahora. Si el agente muestra empatía y menciona opciones de pago flexibles o planes accesibles, muestra más interés. No te cierres completamente si el agente es comprensivo con tu situación. Habla de forma natural y mexicana.',
    displayOrder: 4,
  },
  {
    name: 'Prospección 5: Tengo que consultarlo',
    objection: 'Tengo que consultarlo',
    description: 'El cliente quiere consultar la decisión con su familia.',
    difficulty: 'medium',
    voiceType: 'female',
    firstMessage: '¿Hola?',
    clientPersona: 'Eres María González, una mujer mexicana de 52 años que no toma decisiones sola. Cuando el agente proponga algo, di que tienes que consultarlo con tu esposo/familia. Si el agente sugiere incluir a tu familia en la conversación o agendar una cita donde puedan estar todos, considera aceptar. No te comprometas a nada sin "consultarlo". Habla de forma natural y mexicana.',
    displayOrder: 5,
  },
  {
    name: 'Prospección 6: Mándeme información',
    objection: 'Mándeme información',
    description: 'El cliente pide que le envíen información en lugar de continuar la llamada.',
    difficulty: 'hard',
    voiceType: 'female',
    firstMessage: '¿Bueno, quién habla?',
    clientPersona: 'Eres María González, una mujer mexicana de 47 años que prefiere revisar información antes de comprometerse. Cuando el agente haga su presentación, pide que te mande información por correo o WhatsApp. Si el agente intenta agendar una cita para explicar mejor la información, puedes resistirte inicialmente pero eventualmente considerar una cita breve. Habla de forma natural y mexicana.',
    displayOrder: 6,
  },
  {
    name: 'Prospección 7: Ya me habían llamado',
    objection: 'Ya me habían llamado',
    description: 'El cliente indica que ya recibió llamadas anteriores de la empresa.',
    difficulty: 'hard',
    voiceType: 'male',
    firstMessage: '¿Sí?',
    clientPersona: 'Eres Roberto Sánchez, un hombre mexicano de 60 años algo molesto porque ya te han llamado antes de esta empresa. Cuando el agente se presente, di con tono de fastidio que ya te habían llamado. Si el agente se disculpa sinceramente y ofrece valor diferente o actualización importante, puedes calmarte un poco. Si es persistente pero respetuoso, eventualmente puedes escuchar. Habla de forma natural y mexicana.',
    displayOrder: 7,
  },
];

async function main() {
  console.log('Seeding database...');

  const existing = await prisma.scenario.count();
  if (existing === 0) {
    await prisma.scenario.createMany({ data: scenarios });
    console.log(`Created ${scenarios.length} scenarios`);
  } else {
    console.log(`Scenarios already exist (${existing}), skipping`);
  }

  // Seed admin user
  const adminEmail = 'admin@gmail.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const adminHash = await bcrypt.hash('admin', 12);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminHash,
        firstName: 'Admin',
        lastName: 'Administrador',
        emailVerified: true,
        roles: {
          create: { role: 'admin' },
        },
      },
    });
    console.log(`Created admin user: ${admin.email}`);
  } else {
    console.log('Admin user already exists, skipping');
  }

  // Seed demo user
  const demoEmail = 'demo@gmail.com';
  const existingDemo = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existingDemo) {
    const demoHash = await bcrypt.hash('demo', 12);
    const demo = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash: demoHash,
        firstName: 'Usuario',
        lastName: 'Demo',
        emailVerified: true,
        roles: {
          create: { role: 'learner' },
        },
      },
    });
    console.log(`Created demo user: ${demo.email}`);
  } else {
    console.log('Demo user already exists, skipping');
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
