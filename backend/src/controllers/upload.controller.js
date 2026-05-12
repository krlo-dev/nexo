const uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió imagen' });

  if (process.env.STORAGE_TYPE === 's3') {
    // S3 upload handled by multer-s3 middleware (to be wired when STORAGE_TYPE=s3)
    return res.json({ success: true, data: { url: req.file.location } });
  }

  const url = `${process.env.BACKEND_URL || 'http://localhost:4000'}/static/${req.file.filename}`;
  res.json({ success: true, data: { url } });
};

module.exports = { uploadImage };
