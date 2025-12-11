import axios from 'axios';

const XWEATHER_BASE_URL = 'https://data.api.xweather.com';

/**
 * XWeather API Service
 * Documentation: https://www.xweather.com/docs/weather-api/getting-started/authentication
 */
class XWeatherService {
  constructor() {
    // Credentials will be read dynamically on each request
    // This allows .env to be loaded after module import
  }

  /**
   * Get credentials dynamically
   */
  getCredentials() {
    const clientId = process.env.XWEATHER_CLIENT_ID;
    const clientSecret = process.env.XWEATHER_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('XWeather API credentials not configured. Set XWEATHER_CLIENT_ID and XWEATHER_CLIENT_SECRET in .env');
    }
    
    return { clientId, clientSecret };
  }

  /**
   * Build authenticated URL for XWeather API
   */
  buildUrl(endpoint, params = {}) {
    const { clientId, clientSecret } = this.getCredentials();
    const url = new URL(`${XWEATHER_BASE_URL}${endpoint}`);
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('client_secret', clientSecret);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    return url.toString();
  }

  /**
   * Make authenticated request to XWeather API
   */
  async request(endpoint, params = {}) {
    // Credentials are checked in getCredentials()

    try {
      const url = this.buildUrl(endpoint, params);
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.description || error.message;
        
        throw new Error(`XWeather API error (${status}): ${message}`);
      }
      throw new Error(`XWeather API request failed: ${error.message}`);
    }
  }

  /**
   * Find location using places/closest endpoint
   * @param {string} location - Location query
   */
  async findLocation(location) {
    // Check if it's already coordinates
    const coordMatch = location.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const [lat, lon] = [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])];
      const data = await this.request('/places/closest', { p: `${lat},${lon}`, limit: 1 });
      if (data.success && data.response && data.response.length > 0) {
        return data.response[0];
      }
    }

    // Try as ZIP code first (5 digits)
    if (/^\d{5}(-\d{4})?$/.test(location)) {
      const data = await this.request(`/observations/${location}`);
      if (data.success && data.response) {
        return { place: data.response.place, loc: data.response.loc };
      }
    }

    // Try places/closest with the location string
    try {
      const data = await this.request('/places/closest', { p: location, limit: 1 });
      if (data.success && data.response && data.response.length > 0) {
        return data.response[0];
      }
    } catch (error) {
      // If closest fails, try direct observations
    }

    // Fallback: try observations endpoint directly
    const obsData = await this.request(`/observations/${encodeURIComponent(location)}`);
    if (obsData.success && obsData.response) {
      return { place: obsData.response.place, loc: obsData.response.loc };
    }

    throw new Error(`Location "${location}" not found. XWeather API requires "city,state" format (e.g., "dallas,tx", "new york,ny"). Try using coordinates (lat,lon), ZIP code, or "city,state" format.`);
  }

  /**
   * Get current weather conditions
   * @param {string} location - Location query (city name, zip code, lat,lon)
   */
  async getCurrentWeather(location) {
    // First, find the location
    const foundLocation = await this.findLocation(location);
    
    // Use coordinates or location ID for observations
    let obsEndpoint;
    if (foundLocation.loc) {
      obsEndpoint = `/observations/${foundLocation.loc.lat},${foundLocation.loc.long}`;
    } else {
      obsEndpoint = `/observations/${encodeURIComponent(location)}`;
    }

    const data = await this.request(obsEndpoint);
    
    if (!data.success || !data.response) {
      throw new Error('No weather data available for this location');
    }

    const obs = Array.isArray(data.response) ? data.response[0] : data.response;
    
    return {
      location: {
        name: obs.place?.name || location,
        state: obs.place?.state,
        country: obs.place?.country,
        coordinates: {
          lat: obs.loc?.lat,
          lon: obs.loc?.long
        }
      },
      timestamp: obs.ob?.timestamp || obs.ob?.dateTimeISO,
      conditions: {
        temperature: {
          value: obs.ob?.tempC,
          unit: 'C',
          feelsLike: obs.ob?.feelslikeC
        },
        temperatureF: {
          value: obs.ob?.tempF,
          unit: 'F',
          feelsLike: obs.ob?.feelslikeF
        },
        humidity: obs.ob?.humidity,
        weather: obs.ob?.weather,
        weatherShort: obs.ob?.weatherShort,
        weatherCoded: obs.ob?.weatherCoded,
        icon: obs.ob?.icon,
        wind: {
          speedKph: obs.ob?.windSpeedKPH,
          speedMph: obs.ob?.windSpeedMPH,
          direction: obs.ob?.windDir,
          directionDeg: obs.ob?.windDirDEG
        },
        pressure: {
          mb: obs.ob?.pressureMB,
          in: obs.ob?.pressureIN
        },
        visibility: {
          km: obs.ob?.visibilityKM,
          mi: obs.ob?.visibilityMI
        },
        uvIndex: obs.ob?.uvi,
        dewPoint: {
          c: obs.ob?.dewpointC,
          f: obs.ob?.dewpointF
        }
      },
      source: 'XWeather API'
    };
  }

  /**
   * Get weather forecast using forecasts endpoint
   * @param {string} location - Location query (e.g., "minneapolis,mn", "40.7128,-74.0060", "10001")
   * @param {string} filter - Filter parameter (e.g., "day", "1hr", "6hr")
   * @param {number} limit - Number of forecast periods (default 7)
   * @param {string} fields - Optional fields parameter
   */
  async getForecasts(location, filter = 'day', limit = 7, fields = '') {
    const encodedLocation = encodeURIComponent(location);
    const params = {
      format: 'json',
      filter: filter,
      limit: limit
    };
    
    if (fields) {
      params.fields = fields;
    }
    
    const data = await this.request(`/forecasts/${encodedLocation}`, params);
    
    if (!data.success || !data.response || !Array.isArray(data.response) || data.response.length === 0) {
      throw new Error('No forecast data available for this location');
    }

    const forecastData = data.response[0];
    const periods = forecastData.periods || [];
    
    return {
      location: {
        name: forecastData.place?.name || location,
        state: forecastData.place?.state,
        country: forecastData.place?.country,
        coordinates: {
          lat: forecastData.loc?.lat,
          lon: forecastData.loc?.long
        }
      },
      interval: forecastData.interval,
      periods: periods.map(period => ({
        timestamp: period.timestamp,
        validTime: period.validTime,
        dateTimeISO: period.dateTimeISO,
        temperature: {
          maxC: period.maxTempC,
          maxF: period.maxTempF,
          minC: period.minTempC,
          minF: period.minTempF,
          avgC: period.avgTempC,
          avgF: period.avgTempF,
          currentC: period.tempC,
          currentF: period.tempF
        },
        feelsLike: {
          maxC: period.maxFeelslikeC,
          maxF: period.maxFeelslikeF,
          minC: period.minFeelslikeC,
          minF: period.minFeelslikeF,
          avgC: period.avgFeelslikeC,
          avgF: period.avgFeelslikeF,
          currentC: period.feelslikeC,
          currentF: period.feelslikeF
        },
        wetBulbGlobeTemp: {
          c: period.wetBulbGlobeTempC,
          f: period.wetBulbGlobeTempF
        },
        dewPoint: {
          maxC: period.maxDewpointC,
          maxF: period.maxDewpointF,
          minC: period.minDewpointC,
          minF: period.minDewpointF,
          avgC: period.avgDewpointC,
          avgF: period.avgDewpointF,
          currentC: period.dewpointC,
          currentF: period.dewpointF
        },
        humidity: {
          max: period.maxHumidity,
          min: period.minHumidity,
          current: period.humidity
        },
        precipitation: {
          probability: period.pop,
          mm: period.precipMM,
          in: period.precipIN,
          iceAccum: period.iceaccum,
          iceAccumMM: period.iceaccumMM,
          iceAccumIN: period.iceaccumIN
        },
        snow: {
          cm: period.snowCM,
          in: period.snowIN
        },
        pressure: {
          mb: period.pressureMB,
          in: period.pressureIN
        },
        wind: {
          direction: period.windDir,
          directionDeg: period.windDirDEG,
          speedKts: period.windSpeedKTS,
          speedKph: period.windSpeedKPH,
          speedMph: period.windSpeedMPH,
          speedMps: period.windSpeedMPS,
          gustKts: period.windGustKTS,
          gustKph: period.windGustKPH,
          gustMph: period.windGustMPH,
          gustMps: period.windGustMPS,
          dirMax: period.windDirMax,
          dirMaxDeg: period.windDirMaxDEG,
          speedMaxKts: period.windSpeedMaxKTS,
          speedMaxKph: period.windSpeedMaxKPH,
          speedMaxMph: period.windSpeedMaxMPH,
          speedMaxMps: period.windSpeedMaxMPS,
          dirMin: period.windDirMin,
          dirMinDeg: period.windDirMinDEG,
          speedMinKts: period.windSpeedMinKTS,
          speedMinKph: period.windSpeedMinKPH,
          speedMinMph: period.windSpeedMinMPH,
          speedMinMps: period.windSpeedMinMPS
        },
        wind80m: {
          direction: period.windDir80m,
          directionDeg: period.windDir80mDEG,
          speedKts: period.windSpeed80mKTS,
          speedKph: period.windSpeed80mKPH,
          speedMph: period.windSpeed80mMPH,
          speedMps: period.windSpeed80mMPS,
          gustKts: period.windGust80mKTS,
          gustKph: period.windGust80mKPH,
          gustMph: period.windGust80mMPH,
          gustMps: period.windGust80mMPS
        },
        sky: {
          coverage: period.sky,
          cloudsCoded: period.cloudsCoded
        },
        weather: {
          description: period.weather,
          primary: period.weatherPrimary,
          primaryCoded: period.weatherPrimaryCoded,
          coded: period.weatherCoded,
          icon: period.icon
        },
        visibility: {
          km: period.visibilityKM,
          mi: period.visibilityMI
        },
        solar: {
          uvi: period.uvi,
          radiationWM2: period.solradWM2,
          minWM2: period.solradMinWM2,
          maxWM2: period.solradMaxWM2,
          isDay: period.isDay,
          ghi: period.ghi,
          clearSkyWM2: period.solradClearSkyWM2,
          clearSkySource: period.solradClearSkySource
        },
        maxCoverage: period.maxCoverage,
        sunrise: period.sunrise,
        sunset: period.sunset,
        sunriseISO: period.sunriseISO,
        sunsetISO: period.sunsetISO
      })),
      profile: {
        timezone: forecastData.profile?.tz,
        elevationM: forecastData.profile?.elevM,
        elevationFT: forecastData.profile?.elevFT
      },
      source: 'XWeather API Forecasts Endpoint'
    };
  }

  /**
   * Get weather forecast (legacy method - kept for compatibility)
   * @param {string} location - Location query
   * @param {number} days - Number of forecast days (default 7)
   */
  async getForecast(location, days = 7) {
    // Use the new forecasts endpoint with day filter
    return this.getForecasts(location, 'day', days);
  }

  /**
   * Get weather alerts for a location
   * @param {string} location - Location query
   */
  async getAlerts(location) {
    // First, find the location
    const foundLocation = await this.findLocation(location);
    
    // Use coordinates for alerts
    let alertsEndpoint;
    if (foundLocation.loc) {
      alertsEndpoint = `/alerts/${foundLocation.loc.lat},${foundLocation.loc.long}`;
    } else {
      alertsEndpoint = `/alerts/${encodeURIComponent(location)}`;
    }

    const data = await this.request(alertsEndpoint);
    
    // Alerts may return empty if no active alerts
    const response = data.response || [];
    const alerts = Array.isArray(response) ? response : [response];
    
    return {
      location: location,
      alertCount: alerts.length,
      alerts: alerts.filter(a => a).map(alert => ({
        id: alert.id,
        name: alert.name,
        type: alert.type,
        severity: alert.severity,
        urgency: alert.urgency,
        certainty: alert.certainty,
        headline: alert.details?.headline,
        description: alert.details?.body,
        instructions: alert.details?.instructions,
        effective: alert.timestamps?.effective,
        expires: alert.timestamps?.expires,
        zones: alert.zones
      })),
      checkedAt: new Date().toISOString(),
      source: 'XWeather API'
    };
  }

  /**
   * Get current conditions using the conditions endpoint
   * @param {string} location - Location query (e.g., "minneapolis,mn", "40.7128,-74.0060", "10001")
   */
  async getConditions(location) {
    // Try to resolve location first if it's just a city name
    let resolvedLocation = location;
    
    // If it's not coordinates, ZIP, or city,state format, try to find it
    const isCoords = /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location);
    const isZIP = /^\d{5}(-\d{4})?$/.test(location);
    const hasComma = location.includes(',');
    
    if (!isCoords && !isZIP && !hasComma) {
      // Try to find the location using places/closest
      try {
        const foundLocation = await this.findLocation(location);
        if (foundLocation && foundLocation.loc) {
          resolvedLocation = `${foundLocation.loc.lat},${foundLocation.loc.long}`;
        } else if (foundLocation && foundLocation.place) {
          // Use the resolved place name
          const place = foundLocation.place;
          if (place.state) {
            resolvedLocation = `${place.name},${place.state}`;
          } else {
            resolvedLocation = place.name || location;
          }
        }
      } catch (error) {
        // If location resolution fails, try the original location
        console.warn(`Location resolution failed for "${location}", trying direct API call`);
      }
    }
    
    // Build the conditions endpoint URL
    const encodedLocation = encodeURIComponent(resolvedLocation);
    const data = await this.request(`/conditions/${encodedLocation}`, {
      format: 'json',
      plimit: 1,
      filter: '1min'
    });
    
    if (!data.success || !data.response || !Array.isArray(data.response) || data.response.length === 0) {
      // If direct call failed and we tried to resolve, suggest the format
      if (resolvedLocation !== location && !hasComma) {
        throw new Error(`Location "${location}" not found. Try using "city,state" format (e.g., "dallas,tx") or coordinates.`);
      }
      throw new Error('No conditions data available for this location');
    }

    const locationData = data.response[0];
    const period = locationData.periods && locationData.periods.length > 0 ? locationData.periods[0] : null;
    
    if (!period) {
      throw new Error('No current conditions period available');
    }

    return {
      location: {
        name: locationData.place?.name || location,
        state: locationData.place?.state,
        country: locationData.place?.country,
        coordinates: {
          lat: locationData.loc?.lat,
          lon: locationData.loc?.long
        }
      },
      timestamp: period.timestamp,
      dateTimeISO: period.dateTimeISO,
      conditions: {
        temperature: {
          value: period.tempC,
          unit: 'C',
          feelsLike: period.feelslikeC
        },
        temperatureF: {
          value: period.tempF,
          unit: 'F',
          feelsLike: period.feelslikeF
        },
        wetBulbGlobeTemp: {
          c: period.wetBulbGlobeTempC,
          f: period.wetBulbGlobeTempF
        },
        dewPoint: {
          c: period.dewpointC,
          f: period.dewpointF
        },
        humidity: period.humidity,
        pressure: {
          mb: period.pressureMB,
          in: period.pressureIN,
          seaLevelMB: period.spressureMB,
          seaLevelIN: period.spressureIN,
          altimeterMB: period.altimeterMB,
          altimeterIN: period.altimeterIN
        },
        wind: {
          direction: period.windDir,
          directionDeg: period.windDirDEG,
          speedKts: period.windSpeedKTS,
          speedKph: period.windSpeedKPH,
          speedMph: period.windSpeedMPH,
          speedMps: period.windSpeedMPS,
          gustKts: period.windGustKTS,
          gustKph: period.windGustKPH,
          gustMph: period.windGustMPH,
          gustMps: period.windGustMPS
        },
        precipitation: {
          mm: period.precipMM,
          in: period.precipIN,
          rateMM: period.precipRateMM,
          rateIN: period.precipRateIN
        },
        snow: {
          cm: period.snowCM,
          in: period.snowIN,
          rateCM: period.snowRateCM,
          rateIN: period.snowRateIN,
          depthCM: period.snowDepthCM,
          depthIN: period.snowDepthIN
        },
        visibility: {
          km: period.visibilityKM,
          mi: period.visibilityMI
        },
        sky: {
          coverage: period.sky,
          cloudsCoded: period.cloudsCoded
        },
        weather: {
          description: period.weather,
          coded: period.weatherCoded,
          primary: period.weatherPrimary,
          primaryCoded: period.weatherPrimaryCoded,
          icon: period.icon
        },
        solar: {
          radiationWM2: period.solradWM2,
          uvi: period.uvi,
          isDay: period.isDay,
          azimuth: period.solrad?.azimuthDEG,
          zenith: period.solrad?.zenithDEG,
          ghiWM2: period.solrad?.ghiWM2,
          dniWM2: period.solrad?.dniWM2,
          dhiWM2: period.solrad?.dhiWM2
        },
        probabilityOfPrecipitation: period.pop
      },
      profile: {
        timezone: locationData.profile?.tz,
        timezoneName: locationData.profile?.tzname,
        timezoneOffset: locationData.profile?.tzoffset,
        isDST: locationData.profile?.isDST,
        elevationM: locationData.profile?.elevM,
        elevationFT: locationData.profile?.elevFT
      },
      source: 'XWeather API Conditions Endpoint'
    };
  }

  /**
   * Get road weather conditions
   * @param {string} location - Location query (e.g., "minneapolis,mn", "40.7128,-74.0060", "10001")
   * @param {string} filter - Optional filter parameter
   */
  async getRoadWeather(location, filter = '') {
    // Try to resolve location first if it's just a city name
    let resolvedLocation = location;
    
    // If it's not coordinates, ZIP, or city,state format, try to find it
    const isCoords = /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location);
    const isZIP = /^\d{5}(-\d{4})?$/.test(location);
    const hasComma = location.includes(',');
    
    if (!isCoords && !isZIP && !hasComma) {
      // Try to find the location using places/closest
      try {
        const foundLocation = await this.findLocation(location);
        if (foundLocation && foundLocation.loc) {
          resolvedLocation = `${foundLocation.loc.lat},${foundLocation.loc.long}`;
        } else if (foundLocation && foundLocation.place) {
          // Use the resolved place name
          const place = foundLocation.place;
          if (place.state) {
            resolvedLocation = `${place.name},${place.state}`;
          } else {
            resolvedLocation = place.name || location;
          }
        }
      } catch (error) {
        // If location resolution fails, try the original location
        console.warn(`Location resolution failed for "${location}", trying direct API call`);
      }
    }
    
    // Build the roadweather endpoint URL
    const encodedLocation = encodeURIComponent(resolvedLocation);
    const params = {};
    if (filter) {
      params.filter = filter;
    }
    
    const data = await this.request(`/roadweather/${encodedLocation}`, params);
    
    if (!data.success || !data.response || !Array.isArray(data.response) || data.response.length === 0) {
      // If direct call failed and we tried to resolve, suggest the format
      if (resolvedLocation !== location && !hasComma) {
        throw new Error(`Location "${location}" not found. Try using "city,state" format (e.g., "dallas,tx") or coordinates.`);
      }
      throw new Error('No road weather data available for this location');
    }

    const roadWeatherData = data.response[0];
    
    return {
      id: roadWeatherData.id,
      dataSource: roadWeatherData.dataSource,
      location: {
        name: roadWeatherData.place?.name || location,
        state: roadWeatherData.place?.state,
        country: roadWeatherData.place?.country,
        coordinates: {
          lat: roadWeatherData.loc?.lat,
          lon: roadWeatherData.loc?.long
        }
      },
      road: {
        type: roadWeatherData.road?.type,
        name: roadWeatherData.road?.name
      },
      periods: (roadWeatherData.periods || []).map(period => ({
        timestamp: period.timestamp,
        dateTimeISO: period.dateTimeISO,
        summary: period.summary,
        summaryIndex: period.summaryIndex
      })),
      profile: {
        elevationM: roadWeatherData.profile?.elevM,
        elevationFT: roadWeatherData.profile?.elevFT,
        timezone: roadWeatherData.profile?.tz
      },
      source: 'XWeather API Road Weather Endpoint'
    };
  }

  /**
   * Validate location query
   * @param {string} location - Location to validate
   */
  async validateLocation(location) {
    try {
      const data = await this.request(`/places/${encodeURIComponent(location)}`);
      return data.success && data.response;
    } catch {
      return false;
    }
  }
}

export const xweatherService = new XWeatherService();
export default xweatherService;

