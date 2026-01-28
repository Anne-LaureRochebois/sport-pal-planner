import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub;

    // Check if user is admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Accès refusé - Admin requis" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const url = new URL(req.url);
    const method = req.method;

    // GET: List all users with their profiles and roles
    if (method === "GET") {
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching profiles:", error);
        throw error;
      }

      // Get roles for all users
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles = profiles?.map((profile) => ({
        ...profile,
        role: roles?.find((r) => r.user_id === profile.user_id)?.role || "member",
      }));

      return new Response(JSON.stringify(usersWithRoles), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // DELETE: Delete a user
    if (method === "DELETE") {
      const { userId: targetUserId } = await req.json();
      
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "userId requis" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Prevent self-deletion
      if (targetUserId === userId) {
        return new Response(JSON.stringify({ error: "Vous ne pouvez pas vous supprimer vous-même" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Delete user from auth (this will cascade to profiles and roles via triggers/constraints)
      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

      if (error) {
        console.error("Error deleting user:", error);
        throw error;
      }

      console.log(`User ${targetUserId} deleted by admin ${userId}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // PATCH: Update user email
    if (method === "PATCH") {
      const { userId: targetUserId, email } = await req.json();
      
      if (!targetUserId || !email) {
        return new Response(JSON.stringify({ error: "userId et email requis" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Update email in auth
      const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        email: email,
      });

      if (authError) {
        console.error("Error updating user email in auth:", authError);
        throw authError;
      }

      // Update email in profiles
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ email })
        .eq("user_id", targetUserId);

      if (profileError) {
        console.error("Error updating profile email:", profileError);
        throw profileError;
      }

      console.log(`User ${targetUserId} email updated to ${email} by admin ${userId}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // POST: Resend invite (create new invite for user)
    if (method === "POST") {
      const { email } = await req.json();
      
      if (!email) {
        return new Response(JSON.stringify({ error: "email requis" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Check if user exists
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        // User exists, send password reset
        const { error } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: email,
        });

        if (error) {
          console.error("Error generating recovery link:", error);
          throw error;
        }

        console.log(`Password reset generated for ${email} by admin ${userId}`);

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Lien de réinitialisation envoyé",
          type: "recovery"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } else {
        // User doesn't exist, create new invite
        const { data: inviteData, error: inviteError } = await adminClient
          .from("invites")
          .insert({
            email: email.toLowerCase(),
            invited_by: userId,
          })
          .select("invite_code")
          .single();

        if (inviteError) {
          if (inviteError.code === "23505") {
            // Invite already exists, get the code
            const { data: existingInvite } = await adminClient
              .from("invites")
              .select("invite_code")
              .eq("email", email.toLowerCase())
              .single();
            
            return new Response(JSON.stringify({ 
              success: true, 
              inviteCode: existingInvite?.invite_code,
              message: "Invitation existante récupérée",
              type: "invite"
            }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          throw inviteError;
        }

        console.log(`New invite created for ${email} by admin ${userId}`);

        return new Response(JSON.stringify({ 
          success: true, 
          inviteCode: inviteData.invite_code,
          message: "Nouvelle invitation créée",
          type: "invite"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Méthode non supportée" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in admin-users function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur serveur" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
