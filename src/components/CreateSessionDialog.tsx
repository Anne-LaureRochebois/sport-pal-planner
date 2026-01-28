import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Loader2, Repeat } from 'lucide-react';

const sportTypes = [
  { value: 'musculation', label: 'Musculation' },
  { value: 'plein-air', label: 'Séance plein air' },
  { value: 'escalade', label: 'Escalade' },
  { value: 'natation', label: 'Natation' },
  { value: 'running', label: 'Running' },
  { value: 'autre', label: 'Autre' },
];

const recurrenceTypes = [
  { value: 'none', label: 'Aucune' },
  { value: 'daily', label: 'Tous les jours' },
  { value: 'weekly', label: 'Toutes les semaines' },
  { value: 'custom', label: 'Personnalisée' },
];

const weekDays = [
  { value: 0, label: 'Dim' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
];

interface CreateSessionDialogProps {
  onSessionCreated: () => void;
}

export default function CreateSessionDialog({ onSessionCreated }: CreateSessionDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sport_type: '',
    location: '',
    session_date: '',
    start_time: '',
    end_time: '',
    max_participants: '1',
    recurrence_type: 'none',
    recurrence_days: [] as number[],
    recurrence_end_date: '',
  });

  function toggleDay(day: number) {
    setFormData(prev => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter(d => d !== day)
        : [...prev.recurrence_days, day].sort((a, b) => a - b)
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!user) return;
    
    // Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (formData.session_date < today) {
      toast.error('La date de la séance ne peut pas être dans le passé');
      return;
    }

    // Validate recurrence settings
    if (formData.recurrence_type !== 'none' && !formData.recurrence_end_date) {
      toast.error('Veuillez spécifier une date de fin pour la récurrence');
      return;
    }

    if (formData.recurrence_type === 'custom' && formData.recurrence_days.length === 0) {
      toast.error('Veuillez sélectionner au moins un jour pour la récurrence personnalisée');
      return;
    }

    // Validate end date is after start date
    if (formData.recurrence_end_date && formData.recurrence_end_date <= formData.session_date) {
      toast.error('La date de fin de récurrence doit être après la date de début');
      return;
    }
    
    setIsLoading(true);
    
    // Create the parent session
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        title: formData.title,
        description: formData.description || null,
        sport_type: formData.sport_type,
        location: formData.location,
        session_date: formData.session_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        max_participants: parseInt(formData.max_participants),
        created_by: user.id,
        recurrence_type: formData.recurrence_type,
        recurrence_days: formData.recurrence_type === 'custom' ? formData.recurrence_days : null,
        recurrence_end_date: formData.recurrence_type !== 'none' ? formData.recurrence_end_date : null,
      })
      .select('id')
      .single();
    
    if (error) {
      setIsLoading(false);
      toast.error('Échec de la création de la séance');
      return;
    }

    // If it's a recurring session, generate instances
    if (formData.recurrence_type !== 'none' && newSession) {
      const { error: recurrenceError } = await supabase.rpc('generate_recurring_sessions', {
        p_parent_id: newSession.id,
        p_recurrence_type: formData.recurrence_type,
        p_recurrence_days: formData.recurrence_type === 'custom' ? formData.recurrence_days : null,
        p_end_date: formData.recurrence_end_date,
      });

      if (recurrenceError) {
        console.error('Error generating recurring sessions:', recurrenceError);
        toast.warning('Séance créée, mais erreur lors de la génération des récurrences');
      } else {
        toast.success('Séance récurrente créée !');
      }
    } else {
      toast.success('Séance créée !');
    }
    
    setIsLoading(false);
    setOpen(false);
    setFormData({
      title: '',
      description: '',
      sport_type: '',
      location: '',
      session_date: '',
      start_time: '',
      end_time: '',
      max_participants: '1',
      recurrence_type: 'none',
      recurrence_days: [],
      recurrence_end_date: '',
    });
    onSessionCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="default" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Créer une séance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Créer une nouvelle séance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              placeholder="Match de football du matin"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnelle)</Label>
            <Textarea
              id="description"
              placeholder="Match amical, tous niveaux bienvenus..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sport_type">Type de sport</Label>
              <Select
                value={formData.sport_type}
                onValueChange={(value) => setFormData({ ...formData, sport_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un sport" />
                </SelectTrigger>
                <SelectContent>
                  {sportTypes.map((sport) => (
                    <SelectItem key={sport.value} value={sport.value}>
                      {sport.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max_participants">Participants max</Label>
              <Input
                id="max_participants"
                type="number"
                min="1"
                max="100"
                value={formData.max_participants}
                onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">Lieu</Label>
            <Input
              id="location"
              placeholder="Stade Municipal Terrain 3"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="session_date">Date</Label>
            <Input
              id="session_date"
              type="date"
              value={formData.session_date}
              onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Heure de début</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end_time">Heure de fin</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Recurrence section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="h-4 w-4 text-primary" />
              <Label className="font-medium">Récurrence</Label>
            </div>
            
            <div className="space-y-3">
              <Select
                value={formData.recurrence_type}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  recurrence_type: value,
                  recurrence_days: value === 'custom' ? [] : formData.recurrence_days
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recurrenceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {formData.recurrence_type === 'custom' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Jours de la semaine</Label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((day) => (
                      <div
                        key={day.value}
                        className={`flex items-center justify-center w-10 h-10 rounded-full border cursor-pointer transition-colors ${
                          formData.recurrence_days.includes(day.value)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-input'
                        }`}
                        onClick={() => toggleDay(day.value)}
                      >
                        <span className="text-xs font-medium">{day.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.recurrence_type !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="recurrence_end_date">Date de fin de récurrence</Label>
                  <Input
                    id="recurrence_end_date"
                    type="date"
                    value={formData.recurrence_end_date}
                    onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                    min={formData.session_date}
                    required={formData.recurrence_type !== 'none'}
                  />
                </div>
              )}
            </div>
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading || !formData.sport_type}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer la séance'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}