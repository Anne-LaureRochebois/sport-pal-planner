import { useEffect, useState } from 'react';
import { LogOut, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import ProfileAvatarUpload from './ProfileAvatarUpload';
import InviteUserDialog from './InviteUserDialog';

interface Profile {
  avatar_url: string | null;
  full_name: string | null;
  email: string;
}

export default function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  
  async function fetchProfile() {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url, full_name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) {
      setProfile(data);
    }
  }
  
  useEffect(() => {
    fetchProfile();
  }, [user]);
  
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Utilisateur';
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold text-primary">
            SportSlot
          </h1>
          <span className="text-2xl">🏃</span>
        </div>
        
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Badge variant="secondary" className="hidden sm:flex">
              Administrateur
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-popover" align="end" forceMount>
              <div className="flex items-center justify-start gap-3 p-2">
                <ProfileAvatarUpload 
                  avatarUrl={avatarUrl || null}
                  fullName={profile?.full_name || null}
                  email={profile?.email || user?.email || ''}
                  onAvatarUpdated={fetchProfile}
                />
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              {isAdmin && (
                <InviteUserDialog 
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                      <UserPlus className="mr-2 h-4 w-4" />
                      <span>Inviter un utilisateur</span>
                    </DropdownMenuItem>
                  }
                />
              )}
              {isAdmin && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Se déconnecter</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}