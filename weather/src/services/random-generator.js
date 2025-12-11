import crypto from 'crypto';

/**
 * Cascade Endpoints Random Number Generator
 * Generates true random numbers based on weather data entropy
 */
class RandomGenerator {
  /**
   * Generate a random number from weather data
   * Uses cryptographic hashing to ensure true randomness from data entropy
   * 
   * @param {object} conditionsData - Weather conditions data
   * @param {object} roadWeatherData - Road weather data
   * @param {object} forecastsData - Weather forecasts data
   * @param {number} min - Minimum value (default: 0)
   * @param {number} max - Maximum value (default: Number.MAX_SAFE_INTEGER)
   * @returns {object} Random number and proof
   */
  generateFromData(conditionsData, roadWeatherData, forecastsData, min = 0, max = Number.MAX_SAFE_INTEGER) {
    try {
      // Create entropy string from all weather data
      const entropyString = this.createEntropyString(conditionsData, roadWeatherData, forecastsData);
      
      // Add timestamp for additional entropy
      const timestamp = Date.now();
      const fullEntropy = `${entropyString}:${timestamp}`;
      
      // Create cryptographic hash (SHA-256) from entropy
      const hash = crypto.createHash('sha256').update(fullEntropy).digest('hex');
      
      // Convert hash to BigInt for large number support
      const hashBigInt = BigInt('0x' + hash);
      
      // Generate random number in range [min, max]
      const range = BigInt(max) - BigInt(min) + 1n;
      const randomBigInt = hashBigInt % range;
      const randomNumber = Number(randomBigInt) + min;
      
      // Create proof object
      const proof = {
        method: 'cascade_endpoints_random',
        entropySource: 'weather_data',
        hashAlgorithm: 'SHA-256',
        hash: hash,
        timestamp: timestamp,
        dataPoints: this.countDataPoints(conditionsData, roadWeatherData, forecastsData)
      };
      
      return {
        randomNumber: randomNumber,
        min: min,
        max: max,
        proof: proof
      };
    } catch (error) {
      console.error('Random generation error:', error);
      throw new Error('Failed to generate random number from data');
    }
  }

  /**
   * Create entropy string from weather data
   * Extracts unpredictable values from all three data sources
   */
  createEntropyString(conditionsData, roadWeatherData, forecastsData) {
    const parts = [];
    
    // Extract from conditions data
    if (conditionsData?.response?.[0]) {
      const cond = conditionsData.response[0];
      if (cond.periods?.[0]) {
        const p = cond.periods[0];
        parts.push(
          p.tempC?.toString() || '',
          p.humidity?.toString() || '',
          p.pressureMB?.toString() || '',
          p.windSpeedKPH?.toString() || '',
          p.timestamp?.toString() || '',
          p.dewpointC?.toString() || ''
        );
      }
      if (cond.loc) {
        parts.push(cond.loc.lat?.toString() || '', cond.loc.long?.toString() || '');
      }
    }
    
    // Extract from road weather data
    if (roadWeatherData?.response?.[0]) {
      const road = roadWeatherData.response[0];
      if (road.periods?.length > 0) {
        road.periods.slice(0, 5).forEach(period => {
          parts.push(period.timestamp?.toString() || '', period.summaryIndex?.toString() || '');
        });
      }
      if (road.loc) {
        parts.push(road.loc.lat?.toString() || '', road.loc.long?.toString() || '');
      }
    }
    
    // Extract from forecasts data
    if (forecastsData?.response?.[0]) {
      const forecast = forecastsData.response[0];
      if (forecast.periods?.length > 0) {
        forecast.periods.slice(0, 3).forEach(period => {
          parts.push(
            period.timestamp?.toString() || '',
            period.maxTempC?.toString() || '',
            period.minTempC?.toString() || '',
            period.humidity?.toString() || '',
            period.precipMM?.toString() || ''
          );
        });
      }
      if (forecast.loc) {
        parts.push(forecast.loc.lat?.toString() || '', forecast.loc.long?.toString() || '');
      }
    }
    
    // Join all parts with delimiter
    return parts.filter(p => p).join(':');
  }

  /**
   * Count data points used for entropy
   */
  countDataPoints(conditionsData, roadWeatherData, forecastsData) {
    let count = 0;
    
    if (conditionsData?.response?.[0]?.periods) {
      count += conditionsData.response[0].periods.length;
    }
    if (roadWeatherData?.response?.[0]?.periods) {
      count += roadWeatherData.response[0].periods.length;
    }
    if (forecastsData?.response?.[0]?.periods) {
      count += forecastsData.response[0].periods.length;
    }
    
    return count;
  }

  /**
   * Generate random number in specific range
   */
  generateInRange(min, max) {
    const hash = crypto.createHash('sha256')
      .update(crypto.randomBytes(32))
      .digest('hex');
    
    const hashBigInt = BigInt('0x' + hash);
    const range = BigInt(max) - BigInt(min) + 1n;
    const randomBigInt = hashBigInt % range;
    
    return Number(randomBigInt) + min;
  }
}

export const randomGenerator = new RandomGenerator();
export default randomGenerator;

