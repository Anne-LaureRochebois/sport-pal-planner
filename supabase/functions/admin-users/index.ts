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
    
    // Parse body for action-based routing
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON
    }
    
    const action = body.action || 'list';

    // LIST: List all users with their profiles and roles
    if (action === 'list') {
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, created_at, is_approved, rejected_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching profiles:", error);
        throw error;
      }

      // Get all roles for all users
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles = profiles?.map((profile) => ({
        ...profile,
        roles: roles?.filter((r) => r.user_id === profile.user_id).map((r) => r.role) || [],
      }));

      return new Response(JSON.stringify(usersWithRoles), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // DELETE: Delete a user
    if (action === 'delete') {
      const targetUserId = body.userId;
      
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

    // UPDATE EMAIL: Update user email
    if (action === 'updateEmail') {
      const targetUserId = body.userId;
      const email = body.email;
      
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

    // UPDATE ROLES: Update user roles
    if (action === 'updateRoles') {
      const targetUserId = body.userId;
      const roles = body.roles;
      
      if (!targetUserId || !Array.isArray(roles)) {
        return new Response(JSON.stringify({ error: "userId et roles requis" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Prevent removing own admin role
      if (targetUserId === userId && !roles.includes("admin")) {
        return new Response(JSON.stringify({ error: "Vous ne pouvez pas retirer votre propre rôle admin" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Delete existing roles for this user
      const { error: deleteError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId);

      if (deleteError) {
        console.error("Error deleting user roles:", deleteError);
        throw deleteError;
      }

      // Insert new roles
      if (roles.length > 0) {
        const rolesToInsert = roles.map((role: string) => ({
          user_id: targetUserId,
          role: role,
        }));

        const { error: insertError } = await adminClient
          .from("user_roles")
          .insert(rolesToInsert);

        if (insertError) {
          console.error("Error inserting user roles:", insertError);
          throw insertError;
        }
      }

      console.log(`User ${targetUserId} roles updated to [${roles.join(", ")}] by admin ${userId}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Action non supportée" }), {
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
