import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Users, Calendar, MapPin } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  inviteCode: z.string().min(1, "Le code d'invitation est requis"),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ fullName: '', email: '', password: '', inviteCode: '' });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    
    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    
    setIsSubmitting(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsSubmitting(false);
    
    if (error) {
      toast.error('Email ou mot de passe incorrect');
    } else {
      toast.success('Bon retour parmi nous !');
      navigate('/');
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    
    const result = signupSchema.safeParse(signupData);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    
    setIsSubmitting(true);
    const { error } = await signUp(signupData.email, signupData.password, signupData.fullName, signupData.inviteCode);
    setIsSubmitting(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Compte créé ! Bienvenue.');
      navigate('/');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-primary-foreground">
            GoMove
          </h1>
          <p className="mt-2 text-primary-foreground/80">
            Réservez des créneaux sportifs avec vos amis
          </p>
        </div>
        
        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary-foreground/10 p-3">
              <Calendar className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-primary-foreground">Planification facile</h3>
              <p className="text-sm text-primary-foreground/70">Trouvez et réservez des créneaux disponibles instantanément</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary-foreground/10 p-3">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-primary-foreground">Groupe privé</h3>
              <p className="text-sm text-primary-foreground/70">Accès sur invitation uniquement pour vos amis de confiance</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary-foreground/10 p-3">
              <MapPin className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-primary-foreground">Plusieurs lieux</h3>
              <p className="text-sm text-primary-foreground/70">Des séances dans différents endroits</p>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-primary-foreground/60">
          © 2026 GoMove. Tous droits réservés.
        </p>
      </div>
      
      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md shadow-card border-0 animate-fade-in">
          <CardHeader className="text-center">
            <div className="lg:hidden mb-4">
              <h1 className="font-display text-2xl font-bold text-primary">GoMove</h1>
            </div>
            <CardTitle className="font-display text-2xl">Bienvenue</CardTitle>
            <CardDescription>Connectez-vous ou créez un compte pour continuer</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="vous@exemple.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Se connecter'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nom complet</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={signupData.fullName}
                      onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="vous@exemple.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-invite">Code d'invitation</Label>
                    <Input
                      id="signup-invite"
                      type="text"
                      placeholder="Entrez votre code d'invitation"
                      value={signupData.inviteCode}
                      onChange={(e) => setSignupData({ ...signupData, inviteCode: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Vous avez besoin d'une invitation d'un administrateur pour rejoindre
                    </p>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer un compte'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
