/**
 * x402 Payment Middleware
 * Creates middleware that enforces USDC payments via the x402 protocol
 * 
 * Documentation: https://docs.corbits.dev/api/reference/overview
 * x402 Protocol: https://www.x402.org/
 */

// USDC contract addresses by network
const USDC_ADDRESSES = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-mainnet': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
};

// Chain IDs
const CHAIN_IDS = {
  'base': 8453,
  'base-mainnet': 8453,
  'base-sepolia': 84532
};

/**
 * Get network configuration from environment
 */
export function getNetworkConfig() {
  const networkName = (process.env.PAYMENT_NETWORK || 'base-mainnet').toLowerCase();
  // Default to Base mainnet for production
  const isMainnet = !networkName.includes('sepolia') && !networkName.includes('test');
  return {
    name: isMainnet ? 'base' : 'base-sepolia',
    chainId: isMainnet ? 8453 : 84532,
    usdcAddress: isMainnet ? USDC_ADDRESSES['base-mainnet'] : USDC_ADDRESSES['base-sepolia']
  };
}

/**
 * Creates x402-compliant payment requirement object
 * @param {number} priceInUsdcUnits - Price in smallest USDC units (6 decimals)
 * @param {string} description - Description of what's being purchased
 * @param {object} req - Express request object
 */
function createPaymentRequirement(priceInUsdcUnits, description, req) {
  const recipientAddress = process.env.PAYMENT_RECIPIENT_ADDRESS;
  const facilitatorUrl = process.env.FACILITATOR_URL || 'https://x402.org/facilitator';
  const network = getNetworkConfig();
  
  // x402 version 1 compliant response
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: network.name,
        maxAmountRequired: priceInUsdcUnits.toString(),
        resource: req.originalUrl,
        description: description,
        mimeType: 'application/json',
        payTo: recipientAddress,
        maxTimeoutSeconds: 300,
        asset: network.usdcAddress,
        extra: {
          name: 'USDC',
          decimals: 6,
          chainId: network.chainId
        }
      }
    ],
    facilitator: facilitatorUrl,
    error: null
  };
}

/**
 * x402 Payment Required Middleware
 * Returns HTTP 402 with payment requirements if no valid payment header is present
 * 
 * @param {number} priceInUsdcUnits - Price in smallest USDC units (6 decimals)
 * @param {string} description - Description of what's being purchased
 */
export function manualPaymentRequired(priceInUsdcUnits, description) {
  return async (req, res, next) => {
    const recipientAddress = process.env.PAYMENT_RECIPIENT_ADDRESS;
    const facilitatorUrl = process.env.FACILITATOR_URL || 'https://x402.org/facilitator';
    const network = getNetworkConfig();
    
    if (!recipientAddress || recipientAddress === '0xYourEVMWalletAddress') {
      return res.status(500).json({ 
        error: 'Payment configuration error',
        message: 'Server payment recipient not configured. Set PAYMENT_RECIPIENT_ADDRESS in .env'
      });
    }

    // Check for x402 payment header
    const paymentHeader = req.headers['x-payment'];
    
    if (!paymentHeader) {
      // Return 402 Payment Required with x402-compliant payment details
      const paymentRequirement = createPaymentRequirement(priceInUsdcUnits, description, req);
      
      // Set informative headers
      res.setHeader('X-Payment-Network', network.name);
      res.setHeader('X-Payment-Currency', 'USDC');
      res.setHeader('X-Payment-Amount', priceInUsdcUnits.toString());
      res.setHeader('X-Payment-Recipient', recipientAddress);
      res.setHeader('X-Payment-Facilitator', facilitatorUrl);
      
      return res.status(402).json(paymentRequirement);
    }

      // Payment header present - verify on-chain transaction
      try {
        // Parse the payment header
        let paymentPayload;
        try {
          // Try base64 first
          paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
        } catch {
          // Try direct JSON
          try {
            paymentPayload = JSON.parse(paymentHeader);
          } catch {
            paymentPayload = { raw: paymentHeader };
          }
        }

        // Check if payment payload contains transaction hash
        const txHash = paymentPayload.txHash || paymentPayload.transactionHash || paymentPayload.hash;
        
        if (txHash) {
          // Verify on-chain transaction
          const { paymentVerifier } = await import('../services/payment-verifier.js');
          const verification = await paymentVerifier.verifyPayment(
            txHash,
            priceInUsdcUnits.toString(),
            recipientAddress
          );

          if (!verification.verified) {
            console.error('❌ Payment verification failed:', verification.error);
            const paymentRequirement = createPaymentRequirement(priceInUsdcUnits, description, req);
            return res.status(402).json({
              ...paymentRequirement,
              error: {
                code: 'PAYMENT_VERIFICATION_FAILED',
                message: verification.error || 'Payment verification failed',
                txHash: txHash
              }
            });
          }

          // Payment verified on-chain
          console.log(`✅ Payment verified on-chain for ${req.originalUrl}:`, {
            txHash: txHash,
            amount: verification.transaction.amountUSDC + ' USDC',
            blockNumber: verification.transaction.blockNumber,
            from: verification.transaction.from,
            to: verification.transaction.to
          });

          // Store verified payment info
          req.x402Payment = {
            txHash: txHash,
            verified: true,
            verification: verification.transaction,
            priceCharged: priceInUsdcUnits,
            network: network.name,
            recipient: recipientAddress,
            timestamp: new Date().toISOString()
          };
        } else {
          // No transaction hash - treat as test payment
          console.log(`⚠️  Test payment (no txHash) for ${req.originalUrl}`);
          req.x402Payment = {
            payload: paymentPayload,
            priceCharged: priceInUsdcUnits,
            network: network.name,
            recipient: recipientAddress,
            timestamp: new Date().toISOString(),
            test: true
          };
        }

        // Continue to route handler
        next();

    } catch (error) {
      console.error('Payment processing error:', error);
      
      // Return 402 with requirements on processing failure
      const paymentRequirement = createPaymentRequirement(priceInUsdcUnits, description, req);
      return res.status(402).json({
        ...paymentRequirement,
        error: {
          code: 'PAYMENT_PROCESSING_ERROR',
          message: error.message
        }
      });
    }
  };
}

/**
 * Alias for manualPaymentRequired for compatibility
 * @param {number} priceInUsdcUnits - Price in smallest USDC units (6 decimals)
 * @param {string} description - Description of what's being purchased
 */
export function createPaymentMiddleware(priceInUsdcUnits, description = 'Weather API Access') {
  return manualPaymentRequired(priceInUsdcUnits, description);
}

/**
 * Middleware to add payment info to all responses
 */
export function addPaymentHeaders(req, res, next) {
  const network = getNetworkConfig();
  res.setHeader('X-Payment-Network', network.name);
  res.setHeader('X-Payment-Currency', 'USDC');
  res.setHeader('X-Payment-Facilitator', process.env.FACILITATOR_URL || 'https://x402.org/facilitator');
  next();
}

/**
 * Get current pricing configuration
 */
export function getPricingConfig() {
  return {
    currentWeather: parseInt(process.env.PRICE_CURRENT_WEATHER || '1000'),
    forecast: parseInt(process.env.PRICE_FORECAST || '2000'),
    alerts: parseInt(process.env.PRICE_ALERTS || '1500')
  };
}

export default {
  createPaymentMiddleware,
  manualPaymentRequired,
  addPaymentHeaders,
  getNetworkConfig,
  getPricingConfig
};
