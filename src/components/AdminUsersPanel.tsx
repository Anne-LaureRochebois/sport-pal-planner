import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Users, MoreVertical, Trash2, Mail, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface User {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  role: 'admin' | 'member';
}

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Edit email dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newEmail, setNewEmail] = useState('');
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  
  // Invite code dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Non authentifié');
      }

      const response = await supabase.functions.invoke('admin-users', {
        method: 'GET',
      });

      if (response.error) throw response.error;
      setUsers(response.data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleDeleteUser() {
    if (!deletingUser) return;
    
    setActionLoading(deletingUser.user_id);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        method: 'DELETE',
        body: { userId: deletingUser.user_id },
      });

      if (response.error) throw response.error;
      
      toast.success(`Utilisateur ${deletingUser.email} supprimé`);
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateEmail() {
    if (!editingUser || !newEmail) return;
    
    setActionLoading(editingUser.user_id);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        method: 'PATCH',
        body: { userId: editingUser.user_id, email: newEmail },
      });

      if (response.error) throw response.error;
      
      toast.success('Email mis à jour');
      setEditDialogOpen(false);
      setEditingUser(null);
      setNewEmail('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendCredentials(user: User) {
    setActionLoading(user.user_id);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        method: 'POST',
        body: { email: user.email },
      });

      if (response.error) throw response.error;
      
      if (response.data.type === 'recovery') {
        toast.success('Lien de réinitialisation généré');
      } else if (response.data.inviteCode) {
        setInviteCode(response.data.inviteCode);
        setInviteDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Error resending credentials:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi');
    } finally {
      setActionLoading(null);
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success("Code copié !");
    setTimeout(() => setCopied(false), 2000);
  }

  function openEditDialog(user: User) {
    setEditingUser(user);
    setNewEmail(user.email);
    setEditDialogOpen(true);
  }

  function openDeleteDialog(user: User) {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Utilisateurs ({users.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-secondary">
                    {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {user.full_name || user.email}
                    </p>
                    {user.role === 'admin' && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 flex-shrink-0"
                    disabled={actionLoading === user.user_id}
                  >
                    {actionLoading === user.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreVertical className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => openEditDialog(user)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Modifier l'email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleResendCredentials(user)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Renvoyer les accès
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => openDeleteDialog(user)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun utilisateur
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Email Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'email</DialogTitle>
            <DialogDescription>
              Modifier l'adresse email de {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouvelle@email.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleUpdateEmail}
              disabled={!newEmail || newEmail === editingUser?.email || actionLoading !== null}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'utilisateur{' '}
              <strong>{deletingUser?.full_name || deletingUser?.email}</strong> ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={actionLoading !== null}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Code Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Code d'invitation</DialogTitle>
            <DialogDescription>
              Partagez ce code avec l'utilisateur pour qu'il puisse s'inscrire
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 rounded bg-muted font-mono text-sm break-all">
                {inviteCode}
              </code>
              <Button size="icon" variant="outline" onClick={copyInviteCode}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
