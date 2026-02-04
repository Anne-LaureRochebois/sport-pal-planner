import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from './Dashboard';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading, isApproved, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Redirect to pending page if user is not approved (and not admin)
    if (!loading && user && !isApproved && !isAdmin) {
      navigate('/pending');
    }
  }, [user, loading, isApproved, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (!isApproved && !isAdmin)) {
    return null;
  }

  return <Dashboard />;
}
