import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Loader2, Check, X, Trash2, User } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Booking {
  id: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

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
  bookings: Booking[];
}

interface SessionCardProps {
  session: Session;
  onBookingChange: () => void;
  showPastStatus?: boolean;
}

const sportEmojis: Record<string, string> = {
  musculation: '💪',
  'plein-air': '🌳',
  escalade: '🧗',
  natation: '🏊',
  running: '🏃',
  autre: '🎯',
  default: '🎯',
};

const sportLabels: Record<string, string> = {
  musculation: 'Musculation',
  'plein-air': 'Séance plein air',
  escalade: 'Escalade',
  natation: 'Natation',
  running: 'Running',
  autre: 'Autre',
};

interface CreatorProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export default function SessionCard({ session, onBookingChange, showPastStatus = false }: SessionCardProps) {
  const { user, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  
  useEffect(() => {
    async function fetchCreator() {
      if (!session.created_by) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, avatar_url')
        .eq('user_id', session.created_by)
        .maybeSingle();
      
      if (data) {
        setCreator(data);
      }
    }
    
    fetchCreator();
  }, [session.created_by]);
  
  const today = new Date().toISOString().split('T')[0];
  const isPast = session.session_date < today;
  const isBooked = session.bookings.some(b => b.user_id === user?.id);
  const isCreator = session.created_by === user?.id;
  const canDelete = isCreator || isAdmin;
  const spotsLeft = session.max_participants - session.bookings.length;
  const isFull = spotsLeft <= 0;
  const sportEmoji = sportEmojis[session.sport_type.toLowerCase()] || sportEmojis.default;
  const sportLabel = sportLabels[session.sport_type.toLowerCase()] || session.sport_type;
  const creatorName = creator?.full_name || creator?.email || 'Inconnu';

  async function handleBook() {
    if (!user) return;
    
    setIsLoading(true);
    const { error } = await supabase
      .from('bookings')
      .insert({ session_id: session.id, user_id: user.id });
    
    setIsLoading(false);
    
    if (error) {
      toast.error('Échec de la réservation');
    } else {
      toast.success('Séance réservée !');
      onBookingChange();
    }
  }

  async function handleCancel() {
    if (!user) return;
    
    setIsLoading(true);
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('session_id', session.id)
      .eq('user_id', user.id);
    
    setIsLoading(false);
    
    if (error) {
      toast.error("Échec de l'annulation");
    } else {
      toast.success('Réservation annulée');
      onBookingChange();
    }
  }

  async function handleDeleteSession() {
    if (!user || !canDelete) return;
    
    setIsDeletingSession(true);
    
    // First delete all bookings for this session
    await supabase.from('bookings').delete().eq('session_id', session.id);
    
    // Then delete the session
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', session.id);
    
    setIsDeletingSession(false);
    
    if (error) {
      toast.error('Échec de la suppression de la séance');
    } else {
      toast.success('Séance supprimée');
      onBookingChange();
    }
  }

  const hasParticipants = session.bookings.length > 0;

  return (
    <Card className={`group transition-all duration-300 hover:shadow-card animate-fade-in ${isBooked && !isPast ? 'ring-2 ring-primary/50' : ''} ${isPast && showPastStatus ? 'opacity-60 grayscale' : ''}`}>
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-2xl sm:text-3xl flex-shrink-0">{sportEmoji}</span>
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-base sm:text-lg leading-tight truncate">{session.title}</h3>
              <Badge variant="secondary" className="mt-1 capitalize text-xs">
                {sportLabel}
              </Badge>
            </div>
          </div>
          {isBooked && !isPast && (
            <Badge className="bg-success text-success-foreground text-xs flex-shrink-0">
              <Check className="h-3 w-3 mr-1" />
              Réservé
            </Badge>
          )}
          {isPast && showPastStatus && (
            <Badge variant="secondary" className="text-muted-foreground text-xs flex-shrink-0">
              Passée
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 px-4 sm:px-6">
        {session.description && (
          <p className="text-sm text-muted-foreground">{session.description}</p>
        )}
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{format(parseISO(session.session_date), 'EEEE d MMMM yyyy', { locale: fr })}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>{session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{session.location}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className={`${isFull ? 'text-destructive' : 'text-muted-foreground'}`}>
              {spotsLeft} {spotsLeft === 1 ? 'place restante' : 'places restantes'} sur {session.max_participants}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 text-primary" />
            <span>Organisé par {creatorName}</span>
          </div>
        </div>
        
        {session.bookings.length > 0 && (
          <div className="flex items-center gap-1 pt-2">
            <span className="text-xs text-muted-foreground mr-2">Participants :</span>
            <div className="flex -space-x-2">
              {session.bookings.slice(0, 5).map((booking) => (
                <Tooltip key={booking.id}>
                  <TooltipTrigger>
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarImage src={booking.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {booking.profiles?.full_name?.charAt(0) || booking.profiles?.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    {booking.profiles?.full_name || booking.profiles?.email}
                  </TooltipContent>
                </Tooltip>
              ))}
              {session.bookings.length > 5 && (
                <Avatar className="h-7 w-7 border-2 border-background">
                  <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                    +{session.bookings.length - 5}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex-col gap-2 px-4 sm:px-6">
        {isPast && showPastStatus ? (
          <Button variant="secondary" size="sm" className="w-full" disabled>
            Séance terminée
          </Button>
        ) : (
          <>
            {!isCreator && (
              isBooked ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full" 
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <X className="h-3 w-3 mr-1" />
                      Annuler la réservation
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  size="sm"
                  className="w-full" 
                  onClick={handleBook}
                  disabled={isLoading || isFull}
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isFull ? (
                    'Séance complète'
                  ) : (
                    'Réserver cette séance'
                  )}
                </Button>
              )
            )}
            
            {canDelete && !isPast && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="w-full" 
                    disabled={isDeletingSession}
                  >
                    {isDeletingSession ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Supprimer la séance
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {hasParticipants ? '⚠️ Supprimer la séance ?' : 'Supprimer la séance ?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {hasParticipants 
                        ? 'Des participants sont inscrits à cette séance. La supprimer annulera leurs réservations et les notifiera.'
                        : 'Voulez-vous vraiment supprimer cette séance ? Cette action est irréversible.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteSession}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
