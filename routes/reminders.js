const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// GET all reminders for logged-in user
router.get('/', async (req, res) => {
  const email = req.session?.passport?.user?.email || req.query.email;
  if (!email) return res.json({ success: false, error: 'Not logged in' });

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_email', email)
    .order('reminder_time');

  if (error) return res.json({ success: false, error: error.message });
  res.json({ success: true, reminders: data });
});

// POST create reminder
router.post('/', async (req, res) => {
  const { user_email, user_phone, medicine_name, dosage, reminder_time, days_of_week, notify_email, notify_sms } = req.body;

  const { data, error } = await supabase.from('reminders').insert([{
    user_email, user_phone, medicine_name, dosage,
    reminder_time, days_of_week,
    notify_email: notify_email ?? true,
    notify_sms: notify_sms ?? false
  }]).select();

  if (error) return res.json({ success: false, error: error.message });
  res.json({ success: true, reminder: data[0] });
});

// DELETE reminder
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('reminders').delete().eq('id', req.params.id);
  if (error) return res.json({ success: false, error: error.message });
  res.json({ success: true });
});

// PATCH toggle active
router.patch('/:id/toggle', async (req, res) => {
  const { is_active } = req.body;
  const { error } = await supabase.from('reminders').update({ is_active }).eq('id', req.params.id);
  if (error) return res.json({ success: false, error: error.message });
  res.json({ success: true });
});

module.exports = router;