import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { weatherRouter } from './src/routes/weather.js';
import { publicRouter } from './src/routes/public.js';
import { paymentRouter } from './src/routes/payment.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers if needed
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://x402.org", "https://*.base.org"]
    }
  }
}));

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (free)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Weather x402 API'
  });
});

// API info endpoint (free)
app.get('/api', (req, res) => {
  res.json({
    name: 'Weather x402 API',
    version: '1.0.0',
    description: 'Weather data API with x402 USDC payment settlement',
    endpoints: {
      free: [
        { path: '/health', method: 'GET', description: 'Health check' },
        { path: '/api', method: 'GET', description: 'API information' },
        { path: '/api/pricing', method: 'GET', description: 'View pricing info' }
      ],
      paid: [
        { path: '/api/weather/conditions/:location', method: 'GET', description: 'Current weather conditions (XWeather conditions endpoint)', price: `${process.env.PRICE_CURRENT_WEATHER || 1000} USDC units`, note: 'Location format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code' },
        { path: '/api/weather/roadweather/:location', method: 'GET', description: 'Road weather conditions (XWeather roadweather endpoint)', price: `${process.env.PRICE_ROADWEATHER || 1500} USDC units`, note: 'Location format: "city,state", coordinates, or ZIP code. Query: ?filter=' },
        { path: '/api/weather/forecasts/:location', method: 'GET', description: 'Weather forecasts (XWeather forecasts endpoint)', price: `${process.env.PRICE_FORECAST || 2000} USDC units`, note: 'Location format: "city,state", coordinates, or ZIP code. Query: ?filter=day&limit=7&fields=' },
        { path: '/api/weather/cascade', method: 'GET', description: 'Cascade Endpoints - All 3 endpoints + True Random Number Generator', price: `${(parseInt(process.env.PRICE_CURRENT_WEATHER || 1000) + parseInt(process.env.PRICE_ROADWEATHER || 1500) + parseInt(process.env.PRICE_FORECAST || 2000))} USDC units`, note: 'Query: ?location= or ?location1=&location2=&location3=, ?min=&max= for random range' }
      ]
    },
    payment: {
      network: process.env.PAYMENT_NETWORK || 'base',
      currency: 'USDC',
      facilitator: process.env.FACILITATOR_URL || 'https://x402.org/facilitator'
    },
    documentation: {
      x402: 'https://docs.corbits.dev/api/reference/overview',
      xweather: 'https://www.xweather.com/docs/weather-api/getting-started/authentication'
    }
  });
});

// Pricing endpoint (free)
app.get('/api/pricing', (req, res) => {
  const priceCurrentWeather = parseInt(process.env.PRICE_CURRENT_WEATHER || '1000');
  const priceForecast = parseInt(process.env.PRICE_FORECAST || '2000');
  const priceAlerts = parseInt(process.env.PRICE_ALERTS || '1500');

  res.json({
    currency: 'USDC',
    network: process.env.PAYMENT_NETWORK || 'base',
    decimals: 6,
    note: 'Prices are in smallest USDC units (1 USDC = 1,000,000 units)',
    pricing: {
      current_weather: {
        price: priceCurrentWeather,
        priceUSDC: priceCurrentWeather / 1_000_000,
        description: 'Real-time weather conditions for any location'
      },
      forecast: {
        price: priceForecast,
        priceUSDC: priceForecast / 1_000_000,
        description: '7-day weather forecast with hourly data'
      },
      alerts: {
        price: priceAlerts,
        priceUSDC: priceAlerts / 1_000_000,
        description: 'Active weather alerts and warnings'
      }
    },
    recipient: process.env.PAYMENT_RECIPIENT_ADDRESS || 'Not configured'
  });
});

// Payment verification routes (must be before public routes)
app.use('/api/payment', paymentRouter);

// Protected weather API routes (require x402 payment)
app.use('/api/weather', weatherRouter);

// Public routes (demo page) - must be last to not catch API routes
app.use('/', publicRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Endpoint ${req.method} ${req.path} does not exist` 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🌤️  Weather x402 API Server Started  🌤️             ║
╠═══════════════════════════════════════════════════════════════╣
║  Server:      http://localhost:${PORT}                           ║
║  API Info:    http://localhost:${PORT}/api                       ║
║  Pricing:     http://localhost:${PORT}/api/pricing               ║
║  Demo Page:   http://localhost:${PORT}                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Payment Network: ${(process.env.PAYMENT_NETWORK || 'base').padEnd(41)}║
║  Facilitator:     ${(process.env.FACILITATOR_URL || 'https://x402.org/facilitator').substring(0, 41).padEnd(41)}║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;

