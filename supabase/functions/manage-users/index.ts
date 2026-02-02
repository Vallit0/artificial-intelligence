import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName?: string;
  isAdmin?: boolean;
}

interface BulkCreateRequest {
  users: CreateUserRequest[];
}

// Validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// Sanitize and validate user data
const validateUserData = (user: CreateUserRequest): { valid: boolean; error?: string } => {
  if (!user.email || typeof user.email !== "string") {
    return { valid: false, error: "Email es requerido" };
  }
  
  const email = user.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { valid: false, error: "Formato de email inválido" };
  }
  
  if (!user.password || typeof user.password !== "string") {
    return { valid: false, error: "Contraseña es requerida" };
  }
  
  if (!isValidPassword(user.password)) {
    return { valid: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }
  
  if (user.fullName && typeof user.fullName !== "string") {
    return { valid: false, error: "Nombre inválido" };
  }
  
  return { valid: true };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Configuración del servidor incompleta");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the requester is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado: Token de autenticación requerido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    let user;
    try {
      const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !data.user) {
        throw new Error("Token inválido");
      }
      user = data.user;
    } catch {
      return new Response(
        JSON.stringify({ error: "Sesión expirada. Por favor, inicia sesión nuevamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from("admin_emails")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (adminError) {
      console.error("Error checking admin status:", adminError);
      return new Response(
        JSON.stringify({ error: "Error al verificar permisos de administrador" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: "Acceso denegado: Se requieren permisos de administrador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Acción no especificada. Use: create, bulk-create, delete, o update-password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Datos de solicitud inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      const { email, password, fullName, isAdmin }: CreateUserRequest = body;
      
      // Validate input
      const validation = validateUserData({ email, password, fullName });
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanEmail = email.trim().toLowerCase();

      // Check if user already exists
      try {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

        if (existingUser) {
          return new Response(
            JSON.stringify({ 
              error: "Este email ya está registrado",
              code: "USER_EXISTS",
              existingUserId: existingUser.id 
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (listError) {
        console.error("Error listing users:", listError);
        // Continue with creation attempt - the create call will fail if user exists
      }

      try {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName?.trim() || "",
          },
        });

        if (createError) {
          // Handle specific error cases
          if (createError.message.includes("already been registered")) {
            return new Response(
              JSON.stringify({ error: "Este email ya está registrado", code: "USER_EXISTS" }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw createError;
        }

        // If isAdmin is true, add email to admin_emails table
        if (isAdmin && newUser.user) {
          const { error: adminError } = await supabaseAdmin
            .from("admin_emails")
            .insert({ email: cleanEmail });

          if (adminError) {
            console.error("Error adding admin email:", adminError);
            // User was created but admin status failed - return partial success
            return new Response(
              JSON.stringify({ 
                success: true, 
                user: { id: newUser.user.id, email: newUser.user.email },
                warning: "Usuario creado pero no se pudo asignar permisos de administrador"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            user: { id: newUser.user.id, email: newUser.user.email },
            isAdmin: isAdmin || false
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (createError) {
        console.error("Error creating user:", createError);
        const message = createError instanceof Error ? createError.message : "Error desconocido";
        return new Response(
          JSON.stringify({ error: `Error al crear usuario: ${message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "bulk-create") {
      const { users }: BulkCreateRequest = body;

      if (!users || !Array.isArray(users)) {
        return new Response(
          JSON.stringify({ error: "Se requiere un array de usuarios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (users.length === 0) {
        return new Response(
          JSON.stringify({ error: "El array de usuarios está vacío" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (users.length > 100) {
        return new Response(
          JSON.stringify({ error: "Máximo 100 usuarios por lote" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get existing users once for efficiency
      let existingEmails: Set<string> = new Set();
      try {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        existingEmails = new Set(
          existingUsers?.users?.map(u => u.email?.toLowerCase()).filter(Boolean) as string[]
        );
      } catch (listError) {
        console.error("Error listing existing users:", listError);
        // Continue without pre-check - individual creates will fail if user exists
      }

      const results: { email: string; success: boolean; error?: string; action?: string }[] = [];

      for (const userData of users) {
        try {
          // Validate user data
          const validation = validateUserData(userData);
          if (!validation.valid) {
            results.push({ 
              email: userData.email || "desconocido", 
              success: false, 
              error: validation.error 
            });
            continue;
          }

          const cleanEmail = userData.email.trim().toLowerCase();

          // Check if already exists
          if (existingEmails.has(cleanEmail)) {
            results.push({ 
              email: cleanEmail, 
              success: false, 
              error: "Usuario ya existe" 
            });
            continue;
          }

          const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: userData.password,
            email_confirm: true,
            user_metadata: {
              full_name: userData.fullName?.trim() || "",
            },
          });

          if (createError) {
            if (createError.message.includes("already been registered")) {
              results.push({ email: cleanEmail, success: false, error: "Usuario ya existe" });
              existingEmails.add(cleanEmail); // Add to set to prevent duplicate attempts
            } else {
              results.push({ email: cleanEmail, success: false, error: createError.message });
            }
          } else {
            results.push({ email: cleanEmail, success: true, action: "created" });
            existingEmails.add(cleanEmail); // Add to set to prevent duplicate attempts
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Error desconocido";
          results.push({ 
            email: userData.email || "desconocido", 
            success: false, 
            error: message 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({
          success: true,
          summary: { total: users.length, created: successCount, failed: failCount },
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { userId } = body;

      if (!userId || typeof userId !== "string") {
        return new Response(
          JSON.stringify({ error: "ID de usuario es requerido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prevent admin from deleting themselves
      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: "No puedes eliminar tu propia cuenta" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
          if (deleteError.message.includes("not found")) {
            return new Response(
              JSON.stringify({ error: "Usuario no encontrado" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw deleteError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (deleteError) {
        console.error("Error deleting user:", deleteError);
        const message = deleteError instanceof Error ? deleteError.message : "Error desconocido";
        return new Response(
          JSON.stringify({ error: `Error al eliminar usuario: ${message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "update-password") {
      const { userId, password } = body;

      if (!userId || typeof userId !== "string") {
        return new Response(
          JSON.stringify({ error: "ID de usuario es requerido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        return new Response(
          JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
        });

        if (updateError) {
          if (updateError.message.includes("not found")) {
            return new Response(
              JSON.stringify({ error: "Usuario no encontrado" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw updateError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (updateError) {
        console.error("Error updating password:", updateError);
        const message = updateError instanceof Error ? updateError.message : "Error desconocido";
        return new Response(
          JSON.stringify({ error: `Error al actualizar contraseña: ${message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Acción inválida. Use: create, bulk-create, delete, o update-password" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
