import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Loader2, Check, X } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Booking {
  id: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
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
  bookings: Booking[];
}

interface SessionCardProps {
  session: Session;
  onBookingChange: () => void;
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

export default function SessionCard({ session, onBookingChange }: SessionCardProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const isBooked = session.bookings.some(b => b.user_id === user?.id);
  const spotsLeft = session.max_participants - session.bookings.length;
  const isFull = spotsLeft <= 0;
  const sportEmoji = sportEmojis[session.sport_type.toLowerCase()] || sportEmojis.default;
  const sportLabel = sportLabels[session.sport_type.toLowerCase()] || session.sport_type;

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

  return (
    <Card className={`group transition-all duration-300 hover:shadow-card animate-fade-in ${isBooked ? 'ring-2 ring-primary/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sportEmoji}</span>
            <div>
              <h3 className="font-display font-semibold text-lg leading-tight">{session.title}</h3>
              <Badge variant="secondary" className="mt-1 capitalize">
                {sportLabel}
              </Badge>
            </div>
          </div>
          {isBooked && (
            <Badge className="bg-success text-success-foreground">
              <Check className="h-3 w-3 mr-1" />
              Réservé
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
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
        </div>
        
        {session.bookings.length > 0 && (
          <div className="flex items-center gap-1 pt-2">
            <span className="text-xs text-muted-foreground mr-2">Participants :</span>
            <div className="flex -space-x-2">
              {session.bookings.slice(0, 5).map((booking) => (
                <Tooltip key={booking.id}>
                  <TooltipTrigger>
                    <Avatar className="h-7 w-7 border-2 border-background">
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
      
      <CardFooter>
        {isBooked ? (
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Annuler la réservation
              </>
            )}
          </Button>
        ) : (
          <Button 
            className="w-full" 
            onClick={handleBook}
            disabled={isLoading || isFull}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isFull ? (
              'Séance complète'
            ) : (
              'Réserver cette séance'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
