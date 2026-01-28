import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Camera, Loader2, User } from 'lucide-react';

interface ProfileAvatarUploadProps {
  avatarUrl: string | null;
  fullName: string | null;
  email: string;
  onAvatarUpdated: () => void;
}

export default function ProfileAvatarUpload({ avatarUrl, fullName, email, onAvatarUpdated }: ProfileAvatarUploadProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = fullName?.charAt(0) || email?.charAt(0) || '?';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image doit faire moins de 5 Mo');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast.success('Photo de profil mise à jour !');
      setOpen(false);
      onAvatarUpdated();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Échec de la mise à jour de la photo');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative group cursor-pointer">
          <Avatar className="h-10 w-10 border-2 border-background">
            <AvatarImage src={avatarUrl || undefined} alt={fullName || email} />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="h-4 w-4 text-white" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display">Modifier ma photo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={avatarUrl || undefined} alt={fullName || email} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Choisir une photo
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Formats acceptés : JPG, PNG, GIF. Taille max : 5 Mo
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}