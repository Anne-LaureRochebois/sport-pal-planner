import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import SessionCard from '@/components/SessionCard';
import CreateSessionDialog from '@/components/CreateSessionDialog';
import AdminUsersPanel from '@/components/AdminUsersPanel';
import { Loader2, Calendar, Inbox, Users, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

const sportTypes = [
  { value: 'all', label: 'Tous les sports' },
  { value: 'musculation', label: 'Musculation' },
  { value: 'plein-air', label: 'Séance plein air' },
  { value: 'escalade', label: 'Escalade' },
  { value: 'natation', label: 'Natation' },
  { value: 'running', label: 'Running' },
  { value: 'autre', label: 'Autre' },
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSport, setFilterSport] = useState('all');
  const [filterDate, setFilterDate] = useState('');

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
  
  const filteredUpcomingSessions = sessions.filter(s => {
    if (s.session_date < today) return false;
    if (filterSport !== 'all' && s.sport_type !== filterSport) return false;
    if (filterDate && s.session_date !== filterDate) return false;
    return true;
  });
  
  const mySessions = sessions.filter(s => 
    s.bookings.some(b => b.user_id === user?.id)
  );
  
  const hasActiveFilters = filterSport !== 'all' || filterDate !== '';
  
  function clearFilters() {
    setFilterSport('all');
    setFilterDate('');
  }

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
      
      <main className="container px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Séances</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Trouvez et réservez des séances sportives
            </p>
          </div>
          
          {isAdmin && (
            <CreateSessionDialog onSessionCreated={fetchSessions} />
          )}
        </div>
        
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className={`mb-6 w-full sm:w-auto grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} sm:inline-flex`}>
            <TabsTrigger value="upcoming" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Toutes les</span> Séances
            </TabsTrigger>
            <TabsTrigger value="my-sessions" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Inbox className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Mes</span> Réservations
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                Utilisateurs
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="upcoming">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Select value={filterSport} onValueChange={setFilterSport}>
                <SelectTrigger className="h-8 w-[140px] text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {sportTypes.map((sport) => (
                    <SelectItem key={sport.value} value={sport.value} className="text-xs">
                      {sport.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-8 w-[140px] text-xs bg-background"
              />
              
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
            
            {filteredUpcomingSessions.length === 0 ? (
              <EmptyState 
                title={hasActiveFilters ? "Aucune séance trouvée" : "Aucune séance à venir"}
                description={hasActiveFilters ? "Modifiez vos filtres pour voir plus de séances." : (isAdmin ? "Créez la première séance pour commencer !" : "Revenez plus tard pour de nouvelles séances.")}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredUpcomingSessions.map((session) => (
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
          
          {isAdmin && (
            <TabsContent value="users">
              <AdminUsersPanel />
            </TabsContent>
          )}
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
