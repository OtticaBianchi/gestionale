// components/SessionManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SessionManager() {
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [showLogoutReminder, setShowLogoutReminder] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [reminderShownAt, setReminderShownAt] = useState<number | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // Idle timeout: 10 minutes of inactivity
  const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
  // Auto-logout: 1 minute after popup appears
  const AUTO_LOGOUT_TIMEOUT = 1 * 60 * 1000; // 1 minute in milliseconds

  useEffect(() => {
    // ✅ Check session expiry
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const expiryTime = new Date(session.expires_at! * 1000);
        setSessionExpiry(expiryTime);
      }
    };

    checkSession();

    // ✅ Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setSessionExpiry(null);
          setShowWarning(false);
          setShowLogoutReminder(false);
        } else if (event === 'SIGNED_IN' && session) {
          const expiryTime = new Date(session.expires_at! * 1000);
          setSessionExpiry(expiryTime);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!sessionExpiry) return;

    const interval = setInterval(() => {
      const now = new Date();
      const timeUntilExpiry = sessionExpiry.getTime() - now.getTime();
      const minutesLeft = Math.floor(timeUntilExpiry / (1000 * 60));
      
      setTimeLeft(minutesLeft);

      // ✅ Auto-refresh at 5 minutes before expiry
      if (minutesLeft <= 5 && minutesLeft > 3) {
        handleExtendSession(); // Try to refresh automatically
      }

      // ✅ Show warning at 2 minutes
      if (minutesLeft <= 2 && minutesLeft > 0 && !showWarning) {
        setShowWarning(true);
        toast.warning(`Sessione in scadenza tra ${minutesLeft} minuti. Salva il tuo lavoro!`, {
          duration: 8000,
          action: {
            label: 'Estendi sessione',
            onClick: () => handleExtendSession()
          }
        });
      }

      // ✅ Auto logout at 0 minutes (only if refresh failed)
      if (minutesLeft <= 0) {
        handleAutoLogout();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [sessionExpiry, showWarning]);

  // ✅ Track user activity (mouse, keyboard, clicks, scrolls)
  useEffect(() => {
    const resetIdleTimer = () => {
      // Only reset timer if popup is NOT showing
      // Once popup shows, user must explicitly click "Più tardi" to continue
      if (!showLogoutReminder) {
        setLastActivity(Date.now());
      }
    };

    // Listen to all user activity events
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('scroll', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('keypress', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('scroll', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
    };
  }, [showLogoutReminder]);

  // ✅ Check for idle timeout and auto-logout
  useEffect(() => {
    const idleCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      // If user has been idle for IDLE_TIMEOUT, show reminder
      if (timeSinceLastActivity >= IDLE_TIMEOUT && !showLogoutReminder) {
        console.log('🔒 User idle for 10 minutes - showing logout reminder');
        setShowLogoutReminder(true);
        setReminderShownAt(now);
      }

      // If reminder is showing and 1 minute has passed, auto-logout
      if (showLogoutReminder && reminderShownAt) {
        const timeSinceReminder = now - reminderShownAt;
        if (timeSinceReminder >= AUTO_LOGOUT_TIMEOUT) {
          console.log('⏰ 1 minute passed since reminder - auto-logging out');
          handleAutoLogout();
        }
      }
    }, 10000); // Check every 10 seconds for more responsive auto-logout

    return () => clearInterval(idleCheckInterval);
  }, [lastActivity, showLogoutReminder, reminderShownAt, IDLE_TIMEOUT, AUTO_LOGOUT_TIMEOUT]);

  const handleExtendSession = async () => {
    try {
      console.log('🔄 Attempting session refresh...');
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('❌ Session refresh error:', error);
        // Don't show error toast for automatic refreshes (only manual ones)
        if (showWarning) {
          toast.error('Errore nel rinnovo sessione');
        }
      } else {
        console.log('✅ Session refreshed successfully');
        // Update expiry time with new session
        if (data.session) {
          const newExpiryTime = new Date(data.session.expires_at! * 1000);
          setSessionExpiry(newExpiryTime);
        }
        // Only show success message for manual refreshes
        if (showWarning) {
          toast.success('Sessione rinnovata con successo!');
        }
        setShowWarning(false);
      }
    } catch (error) {
      console.error('❌ Session refresh error:', error);
      if (showWarning) {
        toast.error('Errore nel rinnovo sessione');
      }
    }
  };

  const handleAutoLogout = async () => {
    try {
      toast.error('Tempo di inattività superato - Logout automatico', { 
        duration: 5000,
        action: {
          label: 'Accedi di nuovo',
          onClick: () => router.push('/login')
        }
      });
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('❌ Auto logout error:', error);
    }
  };

  const handleManualLogout = async () => {
    try {
      await supabase.auth.signOut();
      setShowLogoutReminder(false);
      toast.success('Logout effettuato con successo');
    } catch (error) {
      console.error('❌ Manual logout error:', error);
      toast.error('Errore durante il logout');
    }
  };

  const dismissReminder = () => {
    setShowLogoutReminder(false);
    // Reset idle timer when user dismisses (they're clearly active)
    setLastActivity(Date.now());
  };

  return (
    <>
      {/* ✅ Session Warning */}
      {showWarning && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="font-medium">Sessione in scadenza</p>
              <p className="text-sm">
                {timeLeft > 0 ? `${timeLeft} minuti rimasti` : 'Scadendo...'}
              </p>
            </div>
          </div>
          <div className="mt-2 flex space-x-2">
            <button
              onClick={handleExtendSession}
              className="text-sm bg-yellow-200 hover:bg-yellow-300 px-3 py-1 rounded"
            >
              Estendi
            </button>
            <button
              onClick={() => setShowWarning(false)}
              className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* ✅ Logout Reminder */}
      {showLogoutReminder && (
        <div className="fixed bottom-4 right-4 z-50 bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center space-x-2">
            <LogOut className="w-5 h-5" />
            <div>
              <p className="font-medium">Sicurezza postazione</p>
              <p className="text-sm">
                Ricordati di fare logout quando lasci la postazione di lavoro
              </p>
            </div>
          </div>
          <div className="mt-2 flex space-x-2">
            <button
              onClick={handleManualLogout}
              className="text-sm bg-blue-200 hover:bg-blue-300 px-3 py-1 rounded"
            >
              Logout ora
            </button>
            <button
              onClick={dismissReminder}
              className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
            >
              Più tardi
            </button>
          </div>
        </div>
      )}
    </>
  );
}