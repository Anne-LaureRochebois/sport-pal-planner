import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { UserPlus, Loader2, Copy, Check } from 'lucide-react';

interface InviteUserDialogProps {
  trigger?: React.ReactNode;
}

export default function InviteUserDialog({ trigger }: InviteUserDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!user) return;
    
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('invites')
      .insert({
        email: email.toLowerCase(),
        invited_by: user.id,
      })
      .select('invite_code')
      .single();
    
    setIsLoading(false);
    
    if (error) {
      if (error.code === '23505') {
        toast.error('Cet email a déjà été invité');
      } else {
        toast.error("Échec de la création de l'invitation");
      }
    } else {
      setInviteCode(data.invite_code);
      toast.success('Invitation créée !');
    }
  }

  function copyInviteCode() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success("Code d'invitation copié !");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEmail('');
      setInviteCode(null);
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full sm:w-auto">
            <UserPlus className="h-4 w-4 mr-2" />
            Inviter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display">Inviter un nouvel utilisateur</DialogTitle>
        </DialogHeader>
        
        {!inviteCode ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Adresse email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="ami@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                L'utilisateur devra s'inscrire avec cette adresse email exacte
              </p>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Générer l'invitation"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-secondary">
              <p className="text-sm text-muted-foreground mb-2">Partagez ce code d'invitation avec {email} :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-background font-mono text-sm break-all">
                  {inviteCode}
                </code>
                <Button size="icon" variant="outline" onClick={copyInviteCode}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
              Terminé
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
