'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { toast } from 'sonner';

interface HelpfulnessVoteProps {
  procedureId: string;
}

export default function HelpfulnessVote({ procedureId }: HelpfulnessVoteProps) {
  const [helpfulCount, setHelpfulCount] = useState(0);
  const [notHelpfulCount, setNotHelpfulCount] = useState(0);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchVotes();
    fetchUserVote();
  }, [procedureId]);

  const fetchVotes = async () => {
    try {
      const { data, error } = await supabase
        .from('procedure_helpfulness_votes')
        .select('is_helpful')
        .eq('procedure_id', procedureId);

      if (error) throw error;

      const helpful = data?.filter(v => v.is_helpful).length || 0;
      const notHelpful = data?.filter(v => !v.is_helpful).length || 0;

      setHelpfulCount(helpful);
      setNotHelpfulCount(notHelpful);
    } catch (error) {
      console.error('Error fetching votes:', error);
    }
  };

  const fetchUserVote = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('procedure_helpfulness_votes')
        .select('is_helpful')
        .eq('procedure_id', procedureId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setUserVote(data?.is_helpful ?? null);
    } catch (error) {
      console.error('Error fetching user vote:', error);
    }
  };

  const handleVote = async (isHelpful: boolean) => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Devi essere autenticato per votare');
        setIsLoading(false);
        return;
      }

      // If user is changing their vote or voting for the first time
      const { error } = await supabase
        .from('procedure_helpfulness_votes')
        .upsert({
          procedure_id: procedureId,
          user_id: user.id,
          is_helpful: isHelpful,
        }, {
          onConflict: 'procedure_id,user_id',
        });

      if (error) throw error;

      // Update local state
      if (userVote !== null) {
        // User is changing vote
        if (userVote) {
          setHelpfulCount(prev => prev - 1);
        } else {
          setNotHelpfulCount(prev => prev - 1);
        }
      }

      if (isHelpful) {
        setHelpfulCount(prev => prev + 1);
      } else {
        setNotHelpfulCount(prev => prev + 1);
      }

      setUserVote(isHelpful);
      toast.success('Grazie per il tuo feedback!');
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Errore durante il voto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        Ti è stata utile questa procedura?
      </h3>

      <div className="flex items-center justify-center gap-6">
        {/* Thumbs Up */}
        <button
          onClick={() => handleVote(true)}
          disabled={isLoading}
          className={`
            flex flex-col items-center gap-2 px-8 py-4 rounded-lg border-2 transition-all
            ${userVote === true
              ? 'bg-green-50 border-green-500 text-green-700'
              : 'bg-white border-gray-300 text-gray-600 hover:border-green-400 hover:bg-green-50'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <ThumbsUp className={`h-8 w-8 ${userVote === true ? 'fill-current' : ''}`} />
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium">Sì</span>
            <span className="text-xs text-gray-500">({helpfulCount})</span>
          </div>
        </button>

        {/* Thumbs Down */}
        <button
          onClick={() => handleVote(false)}
          disabled={isLoading}
          className={`
            flex flex-col items-center gap-2 px-8 py-4 rounded-lg border-2 transition-all
            ${userVote === false
              ? 'bg-red-50 border-red-500 text-red-700'
              : 'bg-white border-gray-300 text-gray-600 hover:border-red-400 hover:bg-red-50'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <ThumbsDown className={`h-8 w-8 ${userVote === false ? 'fill-current' : ''}`} />
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium">No</span>
            <span className="text-xs text-gray-500">({notHelpfulCount})</span>
          </div>
        </button>
      </div>

      {userVote !== null && (
        <p className="text-center text-sm text-gray-600 mt-4">
          Hai già votato. Puoi cambiare il tuo voto cliccando sull'altra opzione.
        </p>
      )}
    </div>
  );
}
