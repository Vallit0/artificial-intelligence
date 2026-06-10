 # 1) Posicionarte en el backend
  cd C:\Users\estua\Documents\ai\senoriales-48152aa7\server

  # 2) Regenerar el cliente Prisma (por si acaso)
  npx prisma generate

  # 3) Aplicar la migración (dev y prod usan el mismo comando)
  npm run db:migrate          # = npx prisma migrate deploy

  Si preferís usar db push (como venías haciendo en dev según tu flujo), en lugar del paso 3:

  npx prisma db push

  En producción (dentro del contenedor / VM), apuntando a la DB de prod:

  cd server
  npx prisma migrate deploy

  Para verificar que la columna quedó aplicada:

  npx prisma migrate status
