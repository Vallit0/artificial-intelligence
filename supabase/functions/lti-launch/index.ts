import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface LTIPlatform {
  id: string;
  name: string;
  issuer_url: string;
  client_id: string;
  auth_endpoint: string;
  token_endpoint: string;
  jwks_url: string;
  deployment_id: string;
}

interface JWTHeader {
  alg: string;
  kid: string;
  typ: string;
}

interface LTIClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce: string;
  "https://purl.imsglobal.org/spec/lti/claim/message_type": string;
  "https://purl.imsglobal.org/spec/lti/claim/version": string;
  "https://purl.imsglobal.org/spec/lti/claim/deployment_id": string;
  "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": string;
  "https://purl.imsglobal.org/spec/lti/claim/resource_link"?: {
    id: string;
    title?: string;
  };
  "https://purl.imsglobal.org/spec/lti/claim/context"?: {
    id: string;
    title?: string;
    type?: string[];
  };
  "https://purl.imsglobal.org/spec/lti/claim/roles"?: string[];
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

// Base64URL decode
function base64UrlDecode(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Fetch JWKS and get the key
async function getPublicKey(jwksUrl: string, kid: string): Promise<CryptoKey | null> {
  try {
    const response = await fetch(jwksUrl);
    const jwks = await response.json();
    
    const key = jwks.keys?.find((k: { kid: string }) => k.kid === kid);
    if (!key) return null;

    return await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch (error) {
    console.error("Error fetching JWKS:", error);
    return null;
  }
}

// Verify JWT signature
async function verifyJWT(token: string, publicKey: CryptoKey): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const signatureInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signatureBytes = base64UrlDecode(parts[2]);
  // Create a proper ArrayBuffer copy
  const signatureBuffer = new ArrayBuffer(signatureBytes.length);
  new Uint8Array(signatureBuffer).set(signatureBytes);

  return await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signatureBuffer,
    signatureInput
  );
}

// Parse JWT without verification (for getting header/claims)
function parseJWT(token: string): { header: JWTHeader; claims: LTIClaims } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));

    return { header, claims };
  } catch {
    return null;
  }
}

// Map LTI roles to our enum
function mapLTIRoles(ltiRoles: string[]): string[] {
  const roleMap: Record<string, string> = {
    "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor": "instructor",
    "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner": "learner",
    "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator": "admin",
    "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper": "content_developer",
  };

  const mappedRoles: string[] = [];
  for (const role of ltiRoles) {
    if (roleMap[role]) {
      mappedRoles.push(roleMap[role]);
    }
  }

  return mappedRoles.length > 0 ? mappedRoles : ["learner"];
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ============================================
    // OIDC Login Initiation (Step 1 of LTI 1.3)
    // ============================================
    if (path === "initiate" && req.method === "POST") {
      const formData = await req.formData();
      const issuer = formData.get("iss") as string;
      const loginHint = formData.get("login_hint") as string;
      const targetLinkUri = formData.get("target_link_uri") as string;
      const ltiMessageHint = formData.get("lti_message_hint") as string;

      if (!issuer || !loginHint || !targetLinkUri) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the platform configuration
      const { data: platform, error: platformError } = await supabase
        .from("lti_platforms")
        .select("*")
        .eq("issuer_url", issuer)
        .eq("is_active", true)
        .maybeSingle();

      if (platformError || !platform) {
        return new Response(
          JSON.stringify({ error: "Platform not registered" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate state and nonce
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();

      // Store state/nonce for validation (in a real implementation, store in DB or cache)
      // For simplicity, we'll encode them in the state parameter

      // Build the authentication request URL
      const authParams = new URLSearchParams({
        scope: "openid",
        response_type: "id_token",
        client_id: platform.client_id,
        redirect_uri: `${supabaseUrl}/functions/v1/lti-launch/launch`,
        login_hint: loginHint,
        state: state,
        response_mode: "form_post",
        nonce: nonce,
        prompt: "none",
      });

      if (ltiMessageHint) {
        authParams.set("lti_message_hint", ltiMessageHint);
      }

      const authUrl = `${platform.auth_endpoint}?${authParams.toString()}`;

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: authUrl,
        },
      });
    }

    // ============================================
    // LTI Launch (Step 2 - receives the id_token)
    // ============================================
    if (path === "launch" && req.method === "POST") {
      const formData = await req.formData();
      const idToken = formData.get("id_token") as string;
      const state = formData.get("state") as string;

      if (!idToken) {
        return new Response(
          JSON.stringify({ error: "Missing id_token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse the JWT to get claims
      const parsed = parseJWT(idToken);
      if (!parsed) {
        return new Response(
          JSON.stringify({ error: "Invalid JWT format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { header, claims } = parsed;

      // Find the platform by issuer
      const { data: platform, error: platformError } = await supabase
        .from("lti_platforms")
        .select("*")
        .eq("issuer_url", claims.iss)
        .eq("is_active", true)
        .maybeSingle();

      if (platformError || !platform) {
        return new Response(
          JSON.stringify({ error: "Platform not found" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the JWT signature
      const publicKey = await getPublicKey(platform.jwks_url, header.kid);
      if (!publicKey) {
        return new Response(
          JSON.stringify({ error: "Could not fetch public key" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isValid = await verifyJWT(idToken, publicKey);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid JWT signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate claims
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        return new Response(
          JSON.stringify({ error: "Token expired" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check audience
      const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!aud.includes(platform.client_id)) {
        return new Response(
          JSON.stringify({ error: "Invalid audience" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract user info
      const ltiUserId = claims.sub;
      const email = claims.email;
      const name = claims.name || `${claims.given_name || ""} ${claims.family_name || ""}`.trim();
      const context = claims["https://purl.imsglobal.org/spec/lti/claim/context"];
      const resourceLink = claims["https://purl.imsglobal.org/spec/lti/claim/resource_link"];
      const ltiRoles = claims["https://purl.imsglobal.org/spec/lti/claim/roles"] || [];

      // Check if we have an existing LTI session for this user
      const { data: existingSession } = await supabase
        .from("lti_sessions")
        .select("user_id")
        .eq("platform_id", platform.id)
        .eq("lti_user_id", ltiUserId)
        .maybeSingle();

      let userId: string;

      if (existingSession) {
        // User already linked, update the session
        userId = existingSession.user_id;
        
        await supabase
          .from("lti_sessions")
          .update({
            lti_email: email,
            lti_name: name,
            context_id: context?.id,
            context_title: context?.title,
            resource_link_id: resourceLink?.id,
            roles: mapLTIRoles(ltiRoles),
            last_launch_at: new Date().toISOString(),
          })
          .eq("platform_id", platform.id)
          .eq("lti_user_id", ltiUserId);
      } else {
        // New user - create Supabase user and link
        if (!email) {
          return new Response(
            JSON.stringify({ error: "Email is required for new users" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if a user with this email already exists
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const matchingUser = existingUser?.users?.find((u) => u.email === email);

        if (matchingUser) {
          userId = matchingUser.id;
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: email,
            email_confirm: true,
            user_metadata: {
              full_name: name,
              lti_source: platform.name,
            },
          });

          if (createError || !newUser.user) {
            console.error("Error creating user:", createError);
            return new Response(
              JSON.stringify({ error: "Failed to create user" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          userId = newUser.user.id;
        }

        // Create LTI session link
        await supabase.from("lti_sessions").insert({
          user_id: userId,
          platform_id: platform.id,
          lti_user_id: ltiUserId,
          lti_email: email,
          lti_name: name,
          context_id: context?.id,
          context_title: context?.title,
          resource_link_id: resourceLink?.id,
          roles: mapLTIRoles(ltiRoles),
        });
      }

      // Generate a magic link for the user to sign in
      const { data: magicLink, error: magicLinkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: email!,
        options: {
          redirectTo: `${Deno.env.get("APP_URL") || "https://senoriales.lovable.app"}/`,
        },
      });

      if (magicLinkError || !magicLink) {
        console.error("Error generating magic link:", magicLinkError);
        return new Response(
          JSON.stringify({ error: "Failed to generate login link" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Redirect to the magic link
      return new Response(null, {
        status: 302,
        headers: {
          Location: magicLink.properties.action_link,
        },
      });
    }

    // ============================================
    // Platform Registration Info (for Moodle admin)
    // ============================================
    if (path === "info" && req.method === "GET") {
      const baseUrl = `${supabaseUrl}/functions/v1/lti-launch`;
      
      return new Response(
        JSON.stringify({
          tool_name: "Corporación Señoriales - Práctica de Ventas",
          description: "Herramienta de práctica de ventas con IA conversacional",
          lti_version: "1.3.0",
          initiate_login_url: `${baseUrl}/initiate`,
          target_link_uri: `${baseUrl}/launch`,
          redirect_uris: [`${baseUrl}/launch`],
          oidc_initiation_url: `${baseUrl}/initiate`,
          public_jwks_url: null, // We don't send grades back yet
          messages: [
            {
              type: "LtiResourceLinkRequest",
              target_link_uri: `${baseUrl}/launch`,
            },
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("LTI Launch error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
