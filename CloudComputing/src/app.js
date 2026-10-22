const path = require('path');
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/auth', routes);

app.get('/', (req, res) => {
  console.log('Root route accessed');
  res.send('Welcome to the Ifihsy Backend API!');
});

app.post('/predict', (req, res) => {
  res.json({
    disease: 'Aeromoniasis',
    confidence: '92.5',
    details: {
      'Validasi': 'Belum tervalidasi - hasil prediksi awal dari model (stub dev)',
      'Rekomendasi Pengobatan': 'Karantina ikan, perbaiki kualitas air, dan gunakan antibiotik sesuai dosis.',
      'Penyebab': 'Infeksi bakteri Aeromonas hydrophila akibat kualitas air yang buruk.',
    },
    message: 'Stub prediction (dev) — model belum diintegrasi',
  });
});

module.exports = app;
