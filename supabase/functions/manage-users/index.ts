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
}

interface BulkCreateRequest {
  users: CreateUserRequest[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requester is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: adminCheck } = await supabaseAdmin
      .from("admin_emails")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (!adminCheck) {
      throw new Error("Forbidden: Admin access required");
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "create") {
      // Single user creation
      const { email, password, fullName }: CreateUserRequest = await req.json();

      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || "",
        },
      });

      if (createError) throw createError;

      return new Response(
        JSON.stringify({ success: true, user: { id: newUser.user.id, email: newUser.user.email } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "bulk-create") {
      // Bulk user creation
      const { users }: BulkCreateRequest = await req.json();

      if (!users || !Array.isArray(users) || users.length === 0) {
        throw new Error("Users array is required");
      }

      if (users.length > 100) {
        throw new Error("Maximum 100 users per batch");
      }

      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const userData of users) {
        try {
          if (!userData.email || !userData.password) {
            results.push({ email: userData.email || "unknown", success: false, error: "Email and password required" });
            continue;
          }

          // Check if user already exists
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === userData.email);

          if (existingUser) {
            results.push({ email: userData.email, success: false, error: "User already exists" });
            continue;
          }

          const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: {
              full_name: userData.fullName || "",
            },
          });

          if (createError) {
            results.push({ email: userData.email, success: false, error: createError.message });
          } else {
            results.push({ email: userData.email, success: true });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          results.push({ email: userData.email, success: false, error: message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: { total: users.length, created: successCount, failed: failCount },
          results 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { userId } = await req.json();

      if (!userId) {
        throw new Error("User ID is required");
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-password") {
      const { userId, password } = await req.json();

      if (!userId || !password) {
        throw new Error("User ID and password are required");
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action. Use: create, bulk-create, delete, or update-password");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
