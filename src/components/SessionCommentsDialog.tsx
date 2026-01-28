import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MessageCircle, Send, Loader2, Pencil, Trash2, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url: string;
  };
}

interface SessionCommentsDialogProps {
  sessionId: string;
  sessionTitle: string;
  sessionCreatorId: string | null;
  commentCount: number;
  onCommentChange: () => void;
}

export default function SessionCommentsDialog({
  sessionId,
  sessionTitle,
  sessionCreatorId,
  commentCount,
  onCommentChange,
}: SessionCommentsDialogProps) {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  async function fetchComments() {
    setLoading(true);
    
    // First fetch comments
    const { data: commentsData, error } = await supabase
      .from('session_comments')
      .select('id, content, user_id, created_at, updated_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      setLoading(false);
      return;
    }

    if (!commentsData || commentsData.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for all comment authors
    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, avatar_url')
      .in('user_id', userIds);

    const profilesMap = new Map(
      (profilesData || []).map(p => [p.user_id, { 
        full_name: p.full_name || '', 
        email: p.email, 
        avatar_url: p.avatar_url || '' 
      }])
    );

    const commentsWithProfiles: Comment[] = commentsData.map(comment => ({
      ...comment,
      profiles: profilesMap.get(comment.user_id) || { full_name: '', email: '', avatar_url: '' }
    }));

    setComments(commentsWithProfiles);
    setLoading(false);
  }

  useEffect(() => {
    if (open) {
      fetchComments();

      // Subscribe to realtime updates
      const channel = supabase
        .channel(`comments-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'session_comments',
            filter: `session_id=eq.${sessionId}`,
          },
          () => {
            fetchComments();
            onCommentChange();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, sessionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('session_comments').insert({
      session_id: sessionId,
      user_id: user.id,
      content: newComment.trim(),
    });

    setSubmitting(false);

    if (error) {
      toast.error("Erreur lors de l'envoi du commentaire");
    } else {
      setNewComment('');
      fetchComments();
      onCommentChange();
    }
  }

  async function handleEdit(commentId: string) {
    if (!editContent.trim()) return;

    const { error } = await supabase
      .from('session_comments')
      .update({ content: editContent.trim() })
      .eq('id', commentId);

    if (error) {
      toast.error('Erreur lors de la modification');
    } else {
      setEditingId(null);
      setEditContent('');
      fetchComments();
    }
  }

  async function handleDelete(commentId: string) {
    const { error } = await supabase
      .from('session_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      fetchComments();
      onCommentChange();
    }
  }

  function canModifyComment(comment: Comment) {
    if (!user) return false;
    return comment.user_id === user.id;
  }

  function canDeleteComment(comment: Comment) {
    if (!user) return false;
    // Own comment, session creator, or admin can delete
    return (
      comment.user_id === user.id ||
      sessionCreatorId === user.id ||
      isAdmin
    );
  }

  function getInitials(name: string | null, email: string) {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <MessageCircle className="h-4 w-4" />
          <span>{commentCount}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">
            Commentaires - {sessionTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucun commentaire pour le moment</p>
              <p className="text-sm">Soyez le premier à commenter !</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4 -mr-4">
              <div className="space-y-4 py-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(
                          comment.profiles?.full_name || null,
                          comment.profiles?.email || ''
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {comment.profiles?.full_name || comment.profiles?.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                        {comment.updated_at !== comment.created_at && (
                          <span className="text-xs text-muted-foreground">(modifié)</span>
                        )}
                      </div>

                      {editingId === comment.id ? (
                        <div className="mt-1 space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[60px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEdit(comment.id)}
                              disabled={!editContent.trim()}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Sauvegarder
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setEditContent('');
                              }}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm mt-1 break-words whitespace-pre-wrap">
                            {comment.content}
                          </p>
                          {(canModifyComment(comment) || canDeleteComment(comment)) && (
                            <div className="flex gap-1 mt-1">
                              {canModifyComment(comment) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setEditingId(comment.id);
                                    setEditContent(comment.content);
                                  }}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Modifier
                                </Button>
                              )}
                              {canDeleteComment(comment) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(comment.id)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Supprimer
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* New comment form */}
          <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t space-y-3">
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <Button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
