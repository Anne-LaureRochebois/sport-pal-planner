import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Users, MoreVertical, Trash2, Mail, RefreshCw, Loader2, Shield, CheckCircle, XCircle, Clock } from 'lucide-react';

interface User {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  is_approved: boolean;
  rejected_at: string | null;
  roles: ('admin' | 'member')[];
}

const availableRoles = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'member', label: 'Membre (peut créer et s\'inscrire aux séances)' },
];

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
  
  // Roles dialog state
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [editingRolesUser, setEditingRolesUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' },
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

  const pendingUsers = users.filter(u => !u.is_approved);
  const approvedUsers = users.filter(u => u.is_approved);

  async function handleApproveUser(user: User) {
    setActionLoading(user.user_id);
    try {
      const { error } = await supabase.rpc('approve_user', { p_user_id: user.user_id });
      if (error) throw error;
      
      toast.success(`${user.full_name || user.email} a été approuvé`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error approving user:', error);
      toast.error(error.message || "Erreur lors de l'approbation");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectUser(user: User) {
    setActionLoading(user.user_id);
    try {
      const { error } = await supabase.rpc('reject_user', { p_user_id: user.user_id });
      if (error) throw error;
      
      toast.success(`${user.full_name || user.email} a été refusé`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error rejecting user:', error);
      toast.error(error.message || 'Erreur lors du refus');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteUser() {
    if (!deletingUser) return;
    
    setActionLoading(deletingUser.user_id);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: deletingUser.user_id },
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
        body: { action: 'updateEmail', userId: editingUser.user_id, email: newEmail },
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

  async function handleUpdateRoles() {
    if (!editingRolesUser) return;
    
    if (selectedRoles.length === 0) {
      toast.error('Sélectionnez au moins un rôle');
      return;
    }
    
    setActionLoading(editingRolesUser.user_id);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'updateRoles', userId: editingRolesUser.user_id, roles: selectedRoles },
      });

      if (response.error) throw response.error;
      
      toast.success('Rôles mis à jour');
      setRolesDialogOpen(false);
      setEditingRolesUser(null);
      setSelectedRoles([]);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating roles:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setActionLoading(null);
    }
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

  function openRolesDialog(user: User) {
    setEditingRolesUser(user);
    setSelectedRoles(user.roles || ['member']);
    setRolesDialogOpen(true);
  }

  function toggleRole(role: string) {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  }

  function UserRow({ user, showApprovalActions = false }: { user: User; showApprovalActions?: boolean }) {
    return (
      <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-secondary">
              {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">
                {user.full_name || user.email}
              </p>
              {user.roles?.includes('admin') && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        
        {showApprovalActions ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => handleApproveUser(user)}
              disabled={actionLoading === user.user_id}
            >
              {actionLoading === user.user_id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Approuver</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleRejectUser(user)}
              disabled={actionLoading === user.user_id}
            >
              {actionLoading === user.user_id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Refuser</span>
            </Button>
          </div>
        ) : (
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
              {!user.is_approved && (
                <DropdownMenuItem onClick={() => handleApproveUser(user)}>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Approuver
                </DropdownMenuItem>
              )}
              {user.is_approved && (
                <DropdownMenuItem onClick={() => handleRejectUser(user)}>
                  <XCircle className="h-4 w-4 mr-2 text-destructive" />
                  Révoquer l'accès
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openRolesDialog(user)}>
                <Shield className="h-4 w-4 mr-2" />
                Modifier les rôles
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                <Mail className="h-4 w-4 mr-2" />
                Modifier l'email
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
        )}
      </div>
    );
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
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Utilisateurs ({users.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={pendingUsers.length > 0 ? "pending" : "approved"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="pending" className="gap-1 text-xs sm:text-sm relative">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                En attente
                {pendingUsers.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center animate-pulse">
                    {pendingUsers.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1 text-xs sm:text-sm">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                Approuvés ({approvedUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-2">
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune demande en attente
                </p>
              ) : (
                pendingUsers.map((user) => (
                  <UserRow key={user.user_id} user={user} showApprovalActions />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-2">
              {approvedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun utilisateur approuvé
                </p>
              ) : (
                approvedUsers.map((user) => (
                  <UserRow key={user.user_id} user={user} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Roles Dialog */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les rôles</DialogTitle>
            <DialogDescription>
              Sélectionnez les rôles pour {editingRolesUser?.full_name || editingRolesUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {availableRoles.map((role) => (
              <div key={role.value} className="flex items-center space-x-3">
                <Checkbox
                  id={`role-${role.value}`}
                  checked={selectedRoles.includes(role.value)}
                  onCheckedChange={() => toggleRole(role.value)}
                />
                <Label htmlFor={`role-${role.value}`} className="cursor-pointer">
                  {role.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleUpdateRoles}
              disabled={selectedRoles.length === 0 || actionLoading !== null}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
