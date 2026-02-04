import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function PendingApproval() {
  const { user, signOut, isApproved, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [isRejected, setIsRejected] = useState(false);

  useEffect(() => {
    if (isApproved || isAdmin) {
      navigate('/');
    }
  }, [isApproved, isAdmin, navigate]);

  useEffect(() => {
    async function checkRejection() {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('rejected_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsRejected(!!data?.rejected_at);
    }
    checkRejection();
  }, [user]);

  async function handleCheckStatus() {
    setChecking(true);
    // Force a refresh of the auth state
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('profiles')
        .select('is_approved, rejected_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (data?.is_approved) {
        window.location.reload();
      } else {
        setIsRejected(!!data?.rejected_at);
      }
    }
    setChecking(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate('/auth');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">
            {isRejected ? 'Accès refusé' : 'En attente de validation'}
          </CardTitle>
          <CardDescription>
            {isRejected 
              ? 'Votre demande d\'accès a été refusée par un administrateur.'
              : 'Votre compte a été créé avec succès. Un administrateur doit maintenant valider votre inscription avant que vous puissiez accéder à l\'application.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isRejected && (
            <div className="text-sm text-muted-foreground text-center">
              <p>Vous serez notifié par email lorsque votre compte sera validé.</p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {!isRejected && (
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={handleCheckStatus}
                disabled={checking}
              >
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Vérifier le statut
              </Button>
            )}
            <Button 
              variant="ghost" 
              className="w-full gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
