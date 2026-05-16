require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.use('/static', express.static('/app/uploads'));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/stores', require('./routes/stores.routes'));
app.use('/api/stores/:storeId/services', require('./routes/services.routes'));
app.use('/api/stores/:storeId/hours', require('./routes/hours.routes'));
app.use('/api/appointments', require('./routes/appointments.routes'));
app.use('/api/reviews', require('./routes/reviews.routes'));
app.use('/api/recommendations', require('./routes/recommendations.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api/agent', require('./routes/agent'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Nexo backend listening on port ${PORT}`));
