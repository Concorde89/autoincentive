import { Router } from 'express';
import { xweatherService } from '../services/xweather.js';
import { createPaymentMiddleware, manualPaymentRequired, addPaymentHeaders } from '../middleware/x402.js';
import { randomGenerator } from '../services/random-generator.js';

const router = Router();

// Add payment headers to all weather routes
router.use(addPaymentHeaders);

// Parse pricing from environment
const PRICE_CONDITIONS = parseInt(process.env.PRICE_CURRENT_WEATHER || '1000');
const PRICE_ROADWEATHER = parseInt(process.env.PRICE_ROADWEATHER || '1500');
const PRICE_FORECASTS = parseInt(process.env.PRICE_FORECAST || '2000');
const PRICE_CURRENT = parseInt(process.env.PRICE_CURRENT_WEATHER || '1000');
const PRICE_FORECAST = parseInt(process.env.PRICE_FORECAST || '2000');
const PRICE_ALERTS = parseInt(process.env.PRICE_ALERTS || '1500');

/**
 * GET /api/weather/conditions/:location
 * Get current weather conditions using XWeather conditions endpoint
 * Location format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code
 * Requires x402 USDC payment
 */
router.get('/conditions/:location',
  manualPaymentRequired(PRICE_CONDITIONS, 'Current Weather Conditions'),
  async (req, res) => {
    try {
      const { location } = req.params;
      
      if (!location || location.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Location parameter is required. Format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code'
        });
      }

      const conditionsData = await xweatherService.getConditions(location);
      
      res.json({
        success: true,
        endpoint: 'conditions',
        payment: {
          charged: PRICE_CONDITIONS,
          currency: 'USDC',
          network: process.env.PAYMENT_NETWORK || 'base'
        },
        data: conditionsData
      });
    } catch (error) {
      console.error('Conditions error:', error);
      res.status(error.message.includes('No conditions data') || error.message.includes('not found') ? 404 : 500).json({
        error: 'Weather API Error',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/weather/roadweather/:location
 * Get road weather conditions using XWeather roadweather endpoint
 * Location format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code
 * Query params: ?filter= (optional)
 * Requires x402 USDC payment
 */
router.get('/roadweather/:location',
  manualPaymentRequired(PRICE_ROADWEATHER, 'Road Weather Conditions'),
  async (req, res) => {
    try {
      const { location } = req.params;
      const filter = req.query.filter || '';
      
      if (!location || location.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Location parameter is required. Format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code'
        });
      }

      const roadWeatherData = await xweatherService.getRoadWeather(location, filter);
      
      res.json({
        success: true,
        endpoint: 'roadweather',
        payment: {
          charged: PRICE_ROADWEATHER,
          currency: 'USDC',
          network: process.env.PAYMENT_NETWORK || 'base'
        },
        data: roadWeatherData
      });
    } catch (error) {
      console.error('Road weather error:', error);
      res.status(error.message.includes('No road weather data') || error.message.includes('not found') ? 404 : 500).json({
        error: 'Weather API Error',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/weather/forecasts/:location
 * Get weather forecasts using XWeather forecasts endpoint
 * Location format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code
 * Query params: ?filter=day (default: day), ?limit=7 (default: 7), ?fields= (optional)
 * Requires x402 USDC payment
 */
router.get('/forecasts/:location',
  manualPaymentRequired(PRICE_FORECASTS, 'Weather Forecasts'),
  async (req, res) => {
    try {
      const { location } = req.params;
      const filter = req.query.filter || 'day';
      const limit = parseInt(req.query.limit) || 7;
      const fields = req.query.fields || '';
      
      if (!location || location.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Location parameter is required. Format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code'
        });
      }

      if (limit < 1 || limit > 14) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Limit parameter must be between 1 and 14'
        });
      }

      const forecastsData = await xweatherService.getForecasts(location, filter, limit, fields);
      
      res.json({
        success: true,
        endpoint: 'forecasts',
        payment: {
          charged: PRICE_FORECASTS,
          currency: 'USDC',
          network: process.env.PAYMENT_NETWORK || 'base'
        },
        data: forecastsData
      });
    } catch (error) {
      console.error('Forecasts error:', error);
      res.status(error.message.includes('No forecast data') || error.message.includes('not found') ? 404 : 500).json({
        error: 'Weather API Error',
        message: error.message
      });
    }
  }
);

// Temporarily disabled - only conditions endpoint is active
/*
/**
 * GET /api/weather/current/:location
 * Get current weather conditions for a location
 * Requires x402 USDC payment
 */
/*
router.get('/current/:location',
  manualPaymentRequired(PRICE_CURRENT, 'Current Weather Data'),
  async (req, res) => {
    try {
      const { location } = req.params;
      
      if (!location || location.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Location parameter is required'
        });
      }

      const weatherData = await xweatherService.getCurrentWeather(location);
      
      res.json({
        success: true,
        endpoint: 'current',
        payment: {
          charged: PRICE_CURRENT,
          currency: 'USDC',
          network: process.env.PAYMENT_NETWORK || 'base'
        },
        data: weatherData
      });
    } catch (error) {
      console.error('Current weather error:', error);
      res.status(error.message.includes('No weather data') ? 404 : 500).json({
        error: 'Weather API Error',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/weather/forecast/:location
 * Get weather forecast for a location
 * Requires x402 USDC payment
 */
/*
router.get('/forecast/:location',
  manualPaymentRequired(PRICE_FORECAST, '7-Day Weather Forecast'),
  async (req, res) => {
    try {
      const { location } = req.params;
      const days = parseInt(req.query.days) || 7;
      
      if (!location || location.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Location parameter is required'
        });
      }

      if (days < 1 || days > 14) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Days parameter must be between 1 and 14'
        });
      }

      const forecastData = await xweatherService.getForecast(location, days);
      
      res.json({
        success: true,
        endpoint: 'forecast',
        payment: {
          charged: PRICE_FORECAST,
          currency: 'USDC',
          network: process.env.PAYMENT_NETWORK || 'base'
        },
        data: forecastData
      });
    } catch (error) {
      console.error('Forecast error:', error);
      res.status(error.message.includes('No forecast data') ? 404 : 500).json({
        error: 'Weather API Error',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/weather/alerts/:location
 * Get weather alerts for a location
 * Requires x402 USDC payment
 */
/*
router.get('/alerts/:location',
  manualPaymentRequired(PRICE_ALERTS, 'Weather Alerts'),
  async (req, res) => {
    try {
      const { location } = req.params;
      
      if (!location || location.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Location parameter is required'
        });
      }

      const alertsData = await xweatherService.getAlerts(location);
      
      res.json({
        success: true,
        endpoint: 'alerts',
        payment: {
          charged: PRICE_ALERTS,
          currency: 'USDC',
          network: process.env.PAYMENT_NETWORK || 'base'
        },
        data: alertsData
      });
    } catch (error) {
      console.error('Alerts error:', error);
      res.status(500).json({
        error: 'Weather API Error',
        message: error.message
      });
    }
  }
);
*/

/**
 * GET /api/weather/cascade
 * Cascade Endpoints - Fetch all 3 endpoints at once and generate true random number
 * Query params:
 *   - location1: Location for conditions endpoint (default: same as location)
 *   - location2: Location for roadweather endpoint (default: same as location)
 *   - location3: Location for forecasts endpoint (default: same as location)
 *   - location: Single location to use for all endpoints (if location1/2/3 not provided)
 *   - min: Minimum random number (default: 0)
 *   - max: Maximum random number (default: Number.MAX_SAFE_INTEGER)
 * Requires x402 USDC payment (sum of all 3 endpoint prices)
 */
router.get('/cascade',
  manualPaymentRequired(PRICE_CONDITIONS + PRICE_ROADWEATHER + PRICE_FORECASTS, 'Cascade Endpoints - All Weather Data + Random Number'),
  async (req, res) => {
    try {
      const { location, location1, location2, location3 } = req.query;
      const min = parseInt(req.query.min) || 0;
      const max = parseInt(req.query.max) || Number.MAX_SAFE_INTEGER;
      
      // Determine locations for each endpoint
      const conditionsLocation = location1 || location;
      const roadWeatherLocation = location2 || location;
      const forecastsLocation = location3 || location;
      
      if (!conditionsLocation || !roadWeatherLocation || !forecastsLocation) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Location parameter(s) required. Provide either "location" for all endpoints, or "location1", "location2", "location3" for different locations. Format: "city,state" (e.g., "minneapolis,mn"), coordinates, or ZIP code'
        });
      }

      if (min >= max) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'min must be less than max'
        });
      }

      console.log(`🔄 Cascade request: conditions=${conditionsLocation}, roadweather=${roadWeatherLocation}, forecasts=${forecastsLocation}`);

      // Fetch all three endpoints in parallel
      const [conditionsData, roadWeatherData, forecastsData] = await Promise.all([
        xweatherService.getConditions(conditionsLocation).catch(err => {
          console.error('Conditions fetch error:', err.message);
          return { error: err.message };
        }),
        xweatherService.getRoadWeather(roadWeatherLocation, req.query.filter || '').catch(err => {
          console.error('Road weather fetch error:', err.message);
          return { error: err.message };
        }),
        xweatherService.getForecasts(
          forecastsLocation,
          req.query.filter || 'day',
          parseInt(req.query.limit) || 7,
          req.query.fields || ''
        ).catch(err => {
          console.error('Forecasts fetch error:', err.message);
          return { error: err.message };
        })
      ]);

      // Check if any fetch failed
      const errors = [];
      if (conditionsData.error) errors.push(`Conditions: ${conditionsData.error}`);
      if (roadWeatherData.error) errors.push(`Road Weather: ${roadWeatherData.error}`);
      if (forecastsData.error) errors.push(`Forecasts: ${forecastsData.error}`);

      if (errors.length > 0) {
        return res.status(500).json({
          error: 'Weather API Error',
          message: 'Some endpoints failed to fetch data',
          errors: errors,
          partialData: {
            conditions: conditionsData.error ? null : conditionsData,
            roadWeather: roadWeatherData.error ? null : roadWeatherData,
            forecasts: forecastsData.error ? null : forecastsData
          }
        });
      }

      // Generate true random number from the data
      const randomResult = randomGenerator.generateFromData(
        conditionsData,
        roadWeatherData,
        forecastsData,
        min,
        max
      );

      console.log(`✅ Cascade complete. Random number: ${randomResult.randomNumber} (range: ${min}-${max})`);

      res.json({
        success: true,
        endpoint: 'cascade',
        payment: {
          charged: PRICE_CONDITIONS + PRICE_ROADWEATHER + PRICE_FORECASTS,
          currency: 'USDC',
          network: process.env.PAYMENT_NETWORK || 'base',
          breakdown: {
            conditions: PRICE_CONDITIONS,
            roadWeather: PRICE_ROADWEATHER,
            forecasts: PRICE_FORECASTS
          }
        },
        locations: {
          conditions: conditionsLocation,
          roadWeather: roadWeatherLocation,
          forecasts: forecastsLocation
        },
        data: {
          conditions: conditionsData,
          roadWeather: roadWeatherData,
          forecasts: forecastsData
        },
        random: randomResult
      });
    } catch (error) {
      console.error('Cascade error:', error);
      res.status(500).json({
        error: 'Cascade Endpoints Error',
        message: error.message
      });
    }
  }
);

export { router as weatherRouter };
export default router;

