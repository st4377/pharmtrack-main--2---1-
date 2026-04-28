const cron = require('node-cron');

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// Disabled Resend and Twilio for local development
const resend = { emails: { send: async () => { console.log('[LOCAL] Email send skipped'); } } };
const twilioClient = { messages: { create: async () => { console.log('[LOCAL] SMS send skipped'); } } };

const DAY_MAP = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

async function checkAndSendReminders() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const currentDay = DAY_MAP[now.getDay()];

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('is_active', true)
    .eq('reminder_time', currentTime);  // matches HH:MM

  if (error || !reminders?.length) return;

  for (const r of reminders) {
    if (!r.days_of_week.includes(currentDay)) continue;

    // Send Email
    if (r.notify_email && r.user_email) {
      await resend.emails.send({
        from: 'PharmTrack <reminders@yourdomain.com>',
        to: r.user_email,
        subject: `💊 Time to take ${r.medicine_name}`,
        html: `
          <h2>Medicine Reminder</h2>
          <p>It's time to take your medicine!</p>
          <ul>
            <li><strong>Medicine:</strong> ${r.medicine_name}</li>
            <li><strong>Dosage:</strong> ${r.dosage || 'As prescribed'}</li>
            <li><strong>Time:</strong> ${r.reminder_time}</li>
          </ul>
          <p>Stay healthy! — PharmTrack</p>
        `
      }).catch(e => console.error('Email error:', e.message));
    }

    // Send SMS
    if (r.notify_sms && r.user_phone) {
      await twilioClient.messages.create({
        body: `💊 PharmTrack Reminder: Time to take ${r.medicine_name}${r.dosage ? ' (' + r.dosage + ')' : ''} at ${r.reminder_time}.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: r.user_phone
      }).catch(e => console.error('SMS error:', e.message));
    }
  }
}

function startReminderScheduler() {
  // Runs every minute
  cron.schedule('* * * * *', checkAndSendReminders);
  console.log('✅ Reminder scheduler started');
}

module.exports = { startReminderScheduler };