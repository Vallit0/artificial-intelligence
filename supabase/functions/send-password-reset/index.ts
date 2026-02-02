import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PasswordResetRequest {
  email: string;
}

async function sendEmailWithResend(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Señoriales <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend API error:", errorData);
      return { success: false, error: errorData.message || "Error sending email" };
    }

    const data = await response.json();
    console.log("Email sent successfully:", data);
    return { success: true };
  } catch (error) {
    console.error("Error calling Resend API:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email es requerido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if RESEND_API_KEY is configured
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Servicio de email no configurado" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Error de configuración del servidor" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if user exists (optional - for security you might want to always return success)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      // Continue anyway - don't reveal if user exists
    }

    const userExists = users?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());

    // If user doesn't exist, still return success (security best practice)
    if (!userExists) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return new Response(
        JSON.stringify({ success: true, message: "Si el email existe, recibirás instrucciones" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate password reset link using Supabase
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      return new Response(
        JSON.stringify({ error: "Error al generar enlace de recuperación" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract the token from the link
    const resetUrl = linkData.properties?.action_link;
    
    if (!resetUrl) {
      console.error("No reset URL generated");
      return new Response(
        JSON.stringify({ error: "Error al generar enlace de recuperación" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email using Resend API directly
    const emailResult = await sendEmailWithResend(
      email,
      "Restablecer tu contraseña - Señoriales",
      `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">Señoriales</h1>
            <p style="color: #666; margin-top: 5px;">Plataforma de Práctica de Ventas</p>
          </div>
          
          <div style="background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1f2937;">Restablecer Contraseña</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p>Haz clic en el botón de abajo para crear una nueva contraseña:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Restablecer Contraseña
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Este enlace expirará en 1 hora por seguridad.</p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
            <p>Tu contraseña actual permanecerá sin cambios.</p>
          </div>
        </body>
        </html>
      `
    );

    if (!emailResult.success) {
      console.error("Failed to send email:", emailResult.error);
      return new Response(
        JSON.stringify({ error: "Error al enviar correo electrónico" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Si el email existe, recibirás instrucciones" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in send-password-reset function:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    
    return new Response(
      JSON.stringify({ error: `Error al procesar solicitud: ${errorMessage}` }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
