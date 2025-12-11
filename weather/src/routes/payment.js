import { Router } from 'express';
import { paymentVerifier } from '../services/payment-verifier.js';

const router = Router();

/**
 * POST /api/payment/verify
 * Verify a payment transaction on Base mainnet
 */
router.post('/verify', async (req, res) => {
  try {
    const { txHash, expectedAmount, expectedRecipient } = req.body;

    if (!txHash) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Transaction hash (txHash) is required'
      });
    }

    const verification = await paymentVerifier.verifyPayment(
      txHash,
      expectedAmount?.toString() || null,
      expectedRecipient
    );

    res.json({
      success: verification.verified,
      ...verification
    });
  } catch (error) {
    console.error('Payment verification endpoint error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/payment/status/:txHash
 * Get transaction status
 */
router.get('/status/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    const status = await paymentVerifier.getTransactionStatus(txHash);
    res.json(status);
  } catch (error) {
    console.error('Transaction status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

export { router as paymentRouter };
export default router;

