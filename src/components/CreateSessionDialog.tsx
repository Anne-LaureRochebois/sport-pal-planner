import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

const sportTypes = [
  { value: 'musculation', label: 'Musculation' },
  { value: 'plein-air', label: 'Séance plein air' },
  { value: 'escalade', label: 'Escalade' },
  { value: 'natation', label: 'Natation' },
  { value: 'running', label: 'Running' },
  { value: 'autre', label: 'Autre' },
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
    max_participants: '10',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!user) return;
    
    // Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (formData.session_date < today) {
      toast.error('La date de la séance ne peut pas être dans le passé');
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await supabase.from('sessions').insert({
      title: formData.title,
      description: formData.description || null,
      sport_type: formData.sport_type,
      location: formData.location,
      session_date: formData.session_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      max_participants: parseInt(formData.max_participants),
      created_by: user.id,
    });
    
    setIsLoading(false);
    
    if (error) {
      toast.error('Échec de la création de la séance');
    } else {
      toast.success('Séance créée !');
      setOpen(false);
      setFormData({
        title: '',
        description: '',
        sport_type: '',
        location: '',
        session_date: '',
        start_time: '',
        end_time: '',
        max_participants: '10',
      });
      onSessionCreated();
    }
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
          
          <Button type="submit" className="w-full" disabled={isLoading || !formData.sport_type}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer la séance'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
