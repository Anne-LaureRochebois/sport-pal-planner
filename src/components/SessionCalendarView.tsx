import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  recurrence_type: string | null;
  parent_session_id: string | null;
  is_recurring_instance: boolean;
  is_cancelled: boolean;
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

interface SessionCalendarViewProps {
  sessions: Session[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onSessionClick: (session: Session) => void;
  userId?: string;
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

const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function SessionCalendarView({ 
  sessions, 
  currentMonth, 
  onMonthChange,
  onSessionClick,
  userId
}: SessionCalendarViewProps) {
  const today = new Date();
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days for the start of the month
    const startDayOfWeek = (monthStart.getDay() + 6) % 7; // Convert to Monday = 0
    const paddingStart = Array(startDayOfWeek).fill(null);
    
    return [...paddingStart, ...days];
  }, [monthStart, monthEnd]);
  
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    sessions.forEach(session => {
      const date = session.session_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(session);
    });
    return map;
  }, [sessions]);
  
  function getSessionsForDay(day: Date): Session[] {
    const dateStr = format(day, 'yyyy-MM-dd');
    return sessionsByDate.get(dateStr) || [];
  }
  
  function handlePrevMonth() {
    onMonthChange(subMonths(currentMonth, 1));
  }
  
  function handleNextMonth() {
    onMonthChange(addMonths(currentMonth, 1));
  }
  
  return (
    <div className="bg-card rounded-lg border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-display text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h2>
        <Button variant="outline" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="min-h-[80px] sm:min-h-[100px]" />;
          }
          
          const daySessions = getSessionsForDay(day);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isPast = day < today && !isToday;
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[80px] sm:min-h-[100px] p-1 border rounded-md transition-colors",
                isToday && "bg-primary/10 border-primary",
                !isCurrentMonth && "opacity-50",
                isPast && "bg-muted/50"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-1",
                isToday && "text-primary font-bold"
              )}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {daySessions.slice(0, 3).map((session) => {
                  const isBooked = session.bookings.some(b => b.user_id === userId);
                  const isFull = session.bookings.length >= session.max_participants;
                  const emoji = sportEmojis[session.sport_type.toLowerCase()] || sportEmojis.default;
                  
                  return (
                    <Tooltip key={session.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onSessionClick(session)}
                          className={cn(
                            "w-full text-left text-[10px] sm:text-xs px-1 py-0.5 rounded truncate transition-colors",
                            session.is_cancelled && "bg-[#F1C40F]/20 text-[#B7950B] line-through",
                            !session.is_cancelled && isBooked && "bg-success/20 text-success-foreground border-l-2 border-success",
                            !session.is_cancelled && !isBooked && isFull && "bg-destructive/20 text-destructive",
                            !session.is_cancelled && !isBooked && !isFull && "bg-secondary hover:bg-secondary/80"
                          )}
                        >
                          <span className="mr-0.5">{emoji}</span>
                          <span className="hidden sm:inline">{session.start_time.slice(0, 5)}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <div className="space-y-1">
                          <p className="font-semibold">{session.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                          </p>
                          <p className="text-xs">{session.location}</p>
                          {session.is_cancelled && (
                            <Badge className="text-[10px] bg-[#F1C40F] text-black">Annulé</Badge>
                          )}
                          {!session.is_cancelled && isBooked && (
                            <Badge className="text-[10px] bg-success">Réservé</Badge>
                          )}
                          {!session.is_cancelled && isFull && !isBooked && (
                            <Badge variant="destructive" className="text-[10px]">Complet</Badge>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                
                {daySessions.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{daySessions.length - 3} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-secondary" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success/20 border-l-2 border-success" />
          <span>Réservé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive/20" />
          <span>Complet</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#F1C40F]/20" />
          <span>Annulé</span>
        </div>
      </div>
    </div>
  );
}
