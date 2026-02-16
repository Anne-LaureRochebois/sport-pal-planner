import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from './Dashboard';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading, profileLoading, isApproved, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && !profileLoading && user && !isApproved && !isAdmin) {
      navigate('/pending');
    }
  }, [user, loading, profileLoading, isApproved, isAdmin, navigate]);

  if (loading || profileLoading) {
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
