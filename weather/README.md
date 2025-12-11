# Weather x402 API Server

A weather data API server that uses the **x402 protocol** for USDC micropayments on Base mainnet, powered by **XWeather API** and accessible via **Cloudflare Tunnel**.

> 🏆 **Built for the [x402 Hackathon](https://www.x402hackathon.com/)** (December 8, 2025 - January 5, 2026)  
> Building the next era of agents and internet-native payments.

## Features

- 🌤️ **Real-time weather data** from XWeather API
- 💳 **x402 payment protocol** for USDC micropayments on Base mainnet
- 🎲 **Cascade Endpoints** - Fetch all 3 endpoints + true random number generator
- 🔒 **Secure** with helmet.js and CORS
- 🌐 **Cloudflare Tunnel** ready for production deployment
- ✅ **On-chain payment verification** - Verifies USDC transactions on Base mainnet
- 🌐 **Production API** available at `https://weather.concorde.ro`
- 🎨 **Concept Demo** running at `https://autoincentive.online/weather` (example client implementation)

## Technologies Used

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** (v4.21.2) - Web application framework
- **x402 Protocol** - Internet-native payment protocol via [@coinbase/x402](https://www.npmjs.com/package/@coinbase/x402)
- **Faremeter Framework** - [Documentation](https://docs.corbits.dev/api/reference/overview)
- **Base Mainnet** - Ethereum L2 for USDC payments
- **XWeather API** - Weather data provider
- **Cloudflare Tunnel** - Secure public access

### Frontend
- **Vanilla JavaScript** - No framework, pure JS
- **ethers.js v6** (v6.13.5) - Ethereum library for wallet integration
- **HTML5/CSS3** - Modern web standards
- **Google Fonts** - Outfit & JetBrains Mono

### Security & Middleware
- **helmet.js** (v8.0.0) - Security headers
- **CORS** (v2.8.5) - Cross-origin resource sharing
- **dotenv** (v16.4.7) - Environment variable management

### Installed Packages
```json
{
  "@coinbase/x402": "^0.0.17",
  "@solana/web3.js": "^1.98.0",
  "axios": "^1.7.9",
  "bs58": "^6.0.0",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "ethers": "^6.13.5",
  "express": "^4.21.2",
  "helmet": "^8.0.0"
}
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# XWeather API Credentials
# Get these from https://www.xweather.com/
XWEATHER_CLIENT_ID=your_xweather_client_id
XWEATHER_CLIENT_SECRET=your_xweather_client_secret

# x402 Payment Configuration
PAYMENT_RECIPIENT_ADDRESS=0xYourBaseMainnetWalletAddress
PAYMENT_NETWORK=base-mainnet
FACILITATOR_URL=https://x402.org/facilitator

# Pricing (in USDC smallest units - 6 decimals)
# 1000 = 0.001 USDC
PRICE_CURRENT_WEATHER=1000
PRICE_ROADWEATHER=1500
PRICE_FORECAST=2000
```

### 3. Start the Server

```bash
npm start
```

Or with auto-reload for development:

```bash
npm run dev
```

**Note**: The `weather.html` file is not included on the production server. Users must create their own index page to interact with the API. See "Creating a Client Interface" section below.

## API Endpoints

### Free Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api` | GET | API information |
| `/api/pricing` | GET | View pricing details |

### Paid Endpoints (x402 USDC Payment Required)

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/weather/conditions/:location` | GET | 0.001 USDC | Current weather conditions |
| `/api/weather/roadweather/:location` | GET | 0.0015 USDC | Road weather conditions |
| `/api/weather/forecasts/:location` | GET | 0.002 USDC | Weather forecasts |
| `/api/weather/cascade` | GET | 0.0045 USDC | **Cascade Endpoints** - All 3 endpoints + true random number generator |

### Cascade Endpoints

The cascade endpoint fetches all 3 weather endpoints in parallel and generates a true random number from the weather data entropy.

**Query Parameters:**
- `location` - Single location for all endpoints (optional)
- `location1` - Location for conditions endpoint (optional)
- `location2` - Location for roadweather endpoint (optional)
- `location3` - Location for forecasts endpoint (optional)
- `min` - Minimum random number (default: 0)
- `max` - Maximum random number (default: 1000000)

**Example:**
```bash
# Same location for all
GET /api/weather/cascade?location=minneapolis,mn&min=0&max=1000000

# Different locations
GET /api/weather/cascade?location1=dallas,tx&location2=chicago,il&location3=new york,ny&min=0&max=1000000
```

**Response includes:**
- All 3 weather data sets (conditions, roadweather, forecasts)
- True random number generated from weather data entropy
- Cryptographic proof (SHA-256 hash, timestamp, data points)

### Location Formats

The `:location` parameter accepts:
- **City, State**: `minneapolis,mn`, `dallas,tx`, `new york,ny`
- **Coordinates**: `40.7128,-74.0060`
- **ZIP code**: `10001`, `90210`

**Note**: XWeather API requires "city,state" format for city names.

## x402 Payment Flow

1. **Client requests** a paid endpoint without payment
2. **Server returns** `402 Payment Required` with x402-compliant payment details
3. **Client processes payment** using MetaMask or compatible wallet
4. **Client creates USDC transaction** on Base mainnet
5. **Transaction confirmed** on-chain
6. **Client verifies payment** via `/api/payment/verify`
7. **Client retries request** with `X-Payment` header containing transaction hash
8. **Server verifies payment** on-chain and returns weather data

### Payment Verification

The server verifies all payments on-chain before serving data:
- Checks transaction status on Base mainnet
- Validates USDC transfer amount
- Confirms recipient address
- Logs transaction details

### Testing the Production API

The production API is available at: **https://weather.concorde.ro**

You can test the API endpoints directly using:
- cURL
- Postman
- Your own web interface
- x402 client libraries

**Example:**
```bash
# Get API info (free)
curl https://weather.concorde.ro/api

# Get pricing (free)
curl https://weather.concorde.ro/api/pricing

# Request weather data (will return 402 Payment Required)
curl https://weather.concorde.ro/api/weather/conditions/minneapolis,mn
```

### Concept Demo Application

A concept implementation demonstrating the API is running at: **https://autoincentive.online/weather**

This is an example client application that shows how to:
- Interact with the weather.concorde.ro API
- Handle x402 payment flows
- Process Base mainnet USDC payments
- Display weather data and cascade random numbers

You can use this as a reference when building your own client interface.

### Creating a Client Interface

The `weather.html` file is **not included** on the production server (`weather.concorde.ro`). To interact with the API, you need to create your own client interface. Here are the requirements:

1. **Create an HTML page** that can:
   - Make requests to `https://weather.concorde.ro/api/*`
   - Handle 402 Payment Required responses
   - Integrate with MetaMask or compatible wallet
   - Process Base mainnet USDC payments
   - Display weather data and cascade random numbers

2. **Payment Integration**:
   - Use ethers.js v6 for wallet connection
   - Switch to Base mainnet (Chain ID: 8453)
   - Create USDC transfer transactions
   - Verify payments via `https://weather.concorde.ro/api/payment/verify`
   - Include `X-Payment` header with transaction hash

3. **Example Client Flow**:
   ```javascript
   // 1. Request weather data from production API
   const response = await fetch('https://weather.concorde.ro/api/weather/conditions/dallas,tx');
   
   // 2. Handle 402 Payment Required
   if (response.status === 402) {
     const paymentInfo = await response.json();
     // Process payment with MetaMask
     // Verify payment
     // Retry request with X-Payment header
   }
   ```

4. **Reference Implementation**:
   - See `https://autoincentive.online/weather` for a working concept demo
   - Check the `weather.html` file in this repository for example code
   - See the x402 documentation and Faremeter Framework for complete integration examples

## Cloudflare Tunnel Setup

### 1. Install Cloudflared

**Linux:**
```bash
# Debian/Ubuntu
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

**macOS:**
```bash
brew install cloudflared
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

### 3. Create a Tunnel

```bash
cloudflared tunnel create weather-api
```

### 4. Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: weather-api
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: weather.concorde.ro
    service: http://localhost:3000
  - service: http_status:404
```

### 5. Add DNS Record

```bash
cloudflared tunnel route dns weather-api weather.concorde.ro
```

**Note**: The production API server is accessible at `weather.concorde.ro`. The concept demo application runs separately at `autoincentive.online/weather` and uses this API.

### 6. Run the Tunnel

```bash
cloudflared tunnel run weather-api
```

## Project Structure

```
Weather/
├── server.js                    # Main Express server
├── package.json                 # Dependencies and scripts
├── .env                         # Environment variables (create this)
├── .gitignore                   # Git ignore rules
├── public/
│   └── weather.html             # Example client interface (not deployed to production)
├── src/
│   ├── middleware/
│   │   └── x402.js              # x402 payment middleware
│   ├── routes/
│   │   ├── weather.js           # Weather API routes
│   │   ├── payment.js           # Payment verification routes
│   │   └── public.js            # Public routes
│   └── services/
│       ├── xweather.js           # XWeather API service
│       ├── payment-verifier.js   # On-chain payment verification
│       └── random-generator.js   # Cascade random number generator
└── README.md
```

## Getting XWeather API Credentials

1. Visit [XWeather](https://www.xweather.com/)
2. Sign up for an account
3. Create a new application
4. Copy your `client_id` and `client_secret`
5. Add them to your `.env` file

Documentation: [XWeather Authentication](https://www.xweather.com/docs/weather-api/getting-started/authentication)

## x402 Protocol Resources

- [Faremeter Framework Documentation](https://docs.corbits.dev/api/reference/overview)
- [x402 Protocol](https://www.x402.org/)
- [Coinbase x402 npm package](https://www.npmjs.com/package/@coinbase/x402)
- [x402 Hackathon](https://www.x402hackathon.com/)

## Network Configuration

### Base Mainnet (Production)

```env
PAYMENT_NETWORK=base-mainnet
FACILITATOR_URL=https://x402.org/facilitator
```

**USDC Contract**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`  
**Chain ID**: 8453  
**Explorer**: https://basescan.org

### Base Sepolia (Testnet)

```env
PAYMENT_NETWORK=base-sepolia
FACILITATOR_URL=https://x402.org/facilitator
```

## License

MIT

## Contributing

This project was built for the x402 Hackathon. Contributions and improvements are welcome!
