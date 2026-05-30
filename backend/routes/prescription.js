const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── POST /api/prescription/upload ──
router.post('/upload', (req, res) => {
  const upload = req.app.locals.upload;

  upload.single('prescription')(req, res, async (err) => {
    if (err) return res.json({ success: false, error: err.message });

    try {
      const file = req.file;
      const { email, notes } = req.body;

      if (!file) return res.json({ success: false, error: 'No file received' });
      if (!email) return res.json({ success: false, error: 'Email is required' });

      const ext = file.originalname.split('.').pop();
      const fileName = `${email.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${ext}`;

      // 1. Upload file to Supabase Storage
      const { error: storageError } = await supabase
        .storage
        .from('prescriptionsupload')          // ✅ fixed bucket name
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (storageError) {
        console.error('Storage error:', storageError);
        return res.json({ success: false, error: storageError.message });
      }

      // 2. Get public URL
      const { data: urlData } = supabase
        .storage
        .from('prescriptionsupload')          // ✅ fixed bucket name
        .getPublicUrl(fileName);

      const fileUrl = urlData.publicUrl;

      // 3. Save metadata to DB (now includes email ✅)
      const { error: dbError } = await supabase
        .from('prescriptions')
        .insert([{
          email: email,                        // ✅ now saved
          file_name: file.originalname,        // ✅ original name for display
          stored_name: fileName,               // internal name with timestamp
          file_url: fileUrl,
          notes: notes || '',
          uploaded_at: new Date().toISOString()
        }]);

      if (dbError) {
        console.error('DB error:', dbError);
        return res.json({ success: false, error: dbError.message });
      }

      res.json({
        success: true,
        fileName: file.originalname,
        fileUrl,
        uploadedAt: new Date().toISOString()
      });

    } catch (e) {
      console.error('Upload error:', e);
      res.json({ success: false, error: 'Server error' });
    }
  });
});


// ── GET /api/prescription/my?email=user@example.com ──
router.get('/my', async (req, res) => {
  const { email } = req.query;

  if (!email) return res.json({ success: false, error: 'Email is required' });

  try {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('file_name, file_url, notes, uploaded_at')
      .eq('email', email)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Fetch error:', error);
      return res.json({ success: false, error: error.message });
    }

    res.json({ success: true, prescriptions: data || [] });

  } catch (e) {
    console.error('Fetch error:', e);
    res.json({ success: false, error: 'Server error' });
  }
});

module.exports = router;