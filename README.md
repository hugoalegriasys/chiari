# Chiari - Pasteleria

Sistema de gestion para pasteleria: tortas, gelatinas y productos horneados.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
- Recharts (graficos)

## Setup

### 1. Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`
3. Crea un usuario en **Authentication > Users** con email y password
4. Copia las credenciales:
   - **Project URL** y **anon public** key desde Settings > API
   - **service_role** key desde Settings > API

### 2. Variables de entorno

Copia `.env.local.example` a `.env.local` y llena los valores:

```bash
cp .env.local.example .env.local
```

### 3. Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### 4. Despliegue en Vercel

1. Sube el codigo a GitHub
2. Importa el repo en [Vercel](https://vercel.com)
3. Agrega las variables de entorno en Settings > Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

## Estructura

```
src/
  app/
    login/page.tsx          - Login
    (auth)/
      layout.tsx            - Layout con nav inferior
      dashboard/page.tsx    - Reportes y graficos
      productos/page.tsx    - CRUD productos y categorias
      ventas/page.tsx       - Registro de ventas rapido
      compras/page.tsx      - Registro de compras/gastos
      produccion/page.tsx   - Registro de produccion
  lib/
    supabase/client.ts      - Cliente browser
    supabase/server.ts      - Cliente server
    supabase/middleware.ts  - Auth middleware
    types.ts                - Tipos TypeScript
    utils.ts                - Utilidades de fecha/moneda
```

## Funcionalidades

- **Productos**: CRUD de categorias y productos con calendario de produccion semanal
- **Ventas**: Formulario rapido con selector de metodo de pago (Yape/Efectivo)
- **Compras**: Registro de insumos con filtro por fecha
- **Produccion**: Sugerencia automatica de productos segun dia de la semana
- **Dashboard**: Resumen diario/semanal, graficos de ventas y produccion
- **Mobile-first**: Diseno optimizado para uso desde celular
