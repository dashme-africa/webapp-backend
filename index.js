const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const userProfileRoutes = require('./routes/userProfileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const adminProductRoutes = require('./routes/adminProductRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const myProductRoutes = require('./routes/myProductRoutes');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  'https://dashmeafrica-frontend.vercel.app',
  'https://dashmeafrica-frontend.onrender.com',
  'http://localhost:5173',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy error: ${origin} is not allowed.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Database connection error:', err));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Base API Endpoint
app.get('/', (req, res) => res.send('API is running...'));

// Admin Routes
app.use('/api/adminDashboard', adminDashboardRoutes);
app.use('/api/adminProduct', adminProductRoutes);
app.use('/api/admin', adminRoutes);

// User Routes
app.use('/api/products', productRoutes);
app.use('/api/userProfile', userProfileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/myProducts', myProductRoutes);


// Replace with your API secret key
const API_SECRET_KEY = "ssk_01ff6a285121b16938b542dbe5b0ca89042f628de23c2baa358269f0297eda30";

// Base URL for the courier API
const BASE_URL = "https://delivery-staging.apiideraos.com/api/v2/token";

// Get available couriers based on type
app.get("/api/couriers", async (req, res) => {
  const { type } = req.query;

  if (!type) {
    return res.status(400).json({ error: "Type query parameter is required." });
  }

  try {
    const response = await axios.get(`${BASE_URL}/shipments/courier-partners/`, {
      headers: { Authorization: `Bearer ${API_SECRET_KEY}` },
      params: { type },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching couriers:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch couriers.",
      details: error.response?.data || error.message,
    });
  }
});

// Get single rate for a specific courier
app.post("/api/rates", async (req, res) => {
  const { carrierName, type, toAddress, fromAddress, parcels, items } = req.body;
  console.log(req.body)

  if (!carrierName || !type || !toAddress || !fromAddress || !parcels || !items) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/tariffs/getpricesingle/${carrierName}`,
      {
        type,
        toAddress,
        fromAddress,
        parcels,
        items,
      },
      {
        headers: {
          Authorization: `Bearer ${API_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching couriers:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch couriers.",
      details: error.response?.data || error.message,
    });
  }
});


// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;


