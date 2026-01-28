import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting session reminder check...');

    // Get current time and calculate the 1-hour window
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    // Format dates for query
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    const oneHourTime = oneHourFromNow.toTimeString().slice(0, 5);

    console.log(`Checking sessions on ${today} starting between ${currentTime} and ${oneHourTime}`);

    // Find sessions starting in approximately 1 hour (within a 5-minute window to avoid duplicates)
    // We look for sessions starting between 55 and 65 minutes from now
    const targetStartMin = new Date(now.getTime() + 55 * 60 * 1000);
    const targetStartMax = new Date(now.getTime() + 65 * 60 * 1000);
    
    const targetTimeMin = targetStartMin.toTimeString().slice(0, 5);
    const targetTimeMax = targetStartMax.toTimeString().slice(0, 5);

    // Get sessions happening today within the target window
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, title, start_time, location, sport_type')
      .eq('session_date', today)
      .gte('start_time', targetTimeMin)
      .lte('start_time', targetTimeMax);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions starting in the reminder window');
      return new Response(
        JSON.stringify({ message: 'No sessions to remind', reminders_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${sessions.length} sessions to check for reminders`);

    let totalRemindersSent = 0;

    for (const session of sessions) {
      // Get bookings that haven't received reminders yet
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, user_id')
        .eq('session_id', session.id)
        .eq('reminder_sent', false);

      if (bookingsError) {
        console.error(`Error fetching bookings for session ${session.id}:`, bookingsError);
        continue;
      }

      if (!bookings || bookings.length === 0) {
        console.log(`No pending reminders for session "${session.title}"`);
        continue;
      }

      console.log(`Sending ${bookings.length} reminders for session "${session.title}"`);

      // Create notifications for each participant
      const notifications = bookings.map(booking => ({
        user_id: booking.user_id,
        type: 'session_reminder',
        session_id: session.id,
        session_title: session.title,
        message: `Rappel : votre séance "${session.title}" commence dans 1h à ${session.start_time.slice(0, 5)} - ${session.location}`,
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error(`Error creating notifications for session ${session.id}:`, notifError);
        continue;
      }

      // Mark reminders as sent
      const bookingIds = bookings.map(b => b.id);
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ reminder_sent: true })
        .in('id', bookingIds);

      if (updateError) {
        console.error(`Error updating reminder_sent for session ${session.id}:`, updateError);
      } else {
        totalRemindersSent += bookings.length;
      }
    }

    console.log(`Total reminders sent: ${totalRemindersSent}`);

    return new Response(
      JSON.stringify({ 
        message: 'Session reminders processed', 
        reminders_sent: totalRemindersSent,
        sessions_checked: sessions.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in session-reminders function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});