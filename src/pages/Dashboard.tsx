import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import SessionCard from '@/components/SessionCard';
import CreateSessionDialog from '@/components/CreateSessionDialog';
import InviteUserDialog from '@/components/InviteUserDialog';
import { Loader2, Calendar, Inbox } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Session {
  id: string;
  title: string;
  description: string | null;
  sport_type: string;
  location: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  created_by: string | null;
  bookings: {
    id: string;
    user_id: string;
    profiles: {
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    } | null;
  }[];
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        bookings (
          id,
          user_id,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        )
      `)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (!error && data) {
      setSessions(data as Session[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const upcomingSessions = sessions.filter(s => s.session_date >= today);
  const mySessions = sessions.filter(s => 
    s.bookings.some(b => b.user_id === user?.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Séances</h1>
            <p className="text-muted-foreground mt-1">
              Trouvez et réservez des séances sportives avec vos amis
            </p>
          </div>
          
          {isAdmin && (
            <div className="flex gap-3">
              <InviteUserDialog />
              <CreateSessionDialog onSessionCreated={fetchSessions} />
            </div>
          )}
        </div>
        
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming" className="gap-2">
              <Calendar className="h-4 w-4" />
              Toutes les séances
            </TabsTrigger>
            <TabsTrigger value="my-sessions" className="gap-2">
              <Inbox className="h-4 w-4" />
              Mes réservations
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming">
            {upcomingSessions.length === 0 ? (
              <EmptyState 
                title="Aucune séance à venir" 
                description={isAdmin ? "Créez la première séance pour commencer !" : "Revenez plus tard pour de nouvelles séances."}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session} 
                    onBookingChange={fetchSessions}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="my-sessions">
            {mySessions.length === 0 ? (
              <EmptyState 
                title="Aucune réservation" 
                description="Réservez une séance pour la voir ici !"
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {mySessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session} 
                    onBookingChange={fetchSessions}
                    showPastStatus={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Calendar className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
