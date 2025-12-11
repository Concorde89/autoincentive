import { ethers } from 'ethers';

// Base Mainnet RPC endpoint
const BASE_MAINNET_RPC = 'https://mainnet.base.org';
// USDC contract on Base Mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// USDC has 6 decimals
const USDC_DECIMALS = 6;

/**
 * Payment Verification Service
 * Verifies USDC payments on Base mainnet
 */
class PaymentVerifier {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(BASE_MAINNET_RPC);
    this.usdcAddress = USDC_ADDRESS;
    this.recipientAddress = process.env.PAYMENT_RECIPIENT_ADDRESS;
  }

  /**
   * Verify a payment transaction on Base mainnet
   * @param {string} txHash - Transaction hash
   * @param {string} expectedAmount - Expected amount in smallest USDC units
   * @param {string} expectedRecipient - Expected recipient address
   * @returns {Promise<{verified: boolean, transaction: object, error?: string}>}
   */
  async verifyPayment(txHash, expectedAmount, expectedRecipient = null) {
    try {
      console.log(`🔍 Verifying payment transaction: ${txHash}`);
      
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return {
          verified: false,
          error: 'Transaction not found or not yet confirmed'
        };
      }

      // Check if transaction is confirmed
      if (receipt.status !== 1) {
        return {
          verified: false,
          error: 'Transaction failed',
          transaction: {
            hash: txHash,
            status: receipt.status,
            blockNumber: receipt.blockNumber
          }
        };
      }

      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

      // Parse transaction to get details
      const tx = await this.provider.getTransaction(txHash);
      
      // Check if it's a USDC transfer
      // USDC transfers use the ERC20 transfer event
      const usdcInterface = new ethers.Interface([
        'function transfer(address to, uint256 amount)',
        'event Transfer(address indexed from, address indexed to, uint256 value)'
      ]);

      // Find Transfer events
      const transferEvents = receipt.logs
        .map(log => {
          try {
            return usdcInterface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter(log => log && log.name === 'Transfer');

      // Find transfer to our recipient
      const recipient = expectedRecipient || this.recipientAddress;
      const paymentTransfer = transferEvents.find(event => 
        event.args.to.toLowerCase() === recipient.toLowerCase()
      );

      if (!paymentTransfer) {
        return {
          verified: false,
          error: 'No USDC transfer found to recipient address',
          transaction: {
            hash: txHash,
            blockNumber: receipt.blockNumber,
            from: tx.from,
            to: tx.to
          }
        };
      }

      // Check amount
      const transferredAmount = paymentTransfer.args.value.toString();
      const expectedAmountBigInt = BigInt(expectedAmount);

      if (transferredAmount !== expectedAmountBigInt.toString()) {
        return {
          verified: false,
          error: `Amount mismatch. Expected ${expectedAmount}, got ${transferredAmount}`,
          transaction: {
            hash: txHash,
            amount: transferredAmount,
            expectedAmount: expectedAmount
          }
        };
      }

      // Get block timestamp
      const block = await this.provider.getBlock(receipt.blockNumber);

      console.log(`✅ Payment verified: ${ethers.formatUnits(transferredAmount, USDC_DECIMALS)} USDC from ${paymentTransfer.args.from} to ${paymentTransfer.args.to}`);

      return {
        verified: true,
        transaction: {
          hash: txHash,
          blockNumber: receipt.blockNumber,
          blockTimestamp: block.timestamp,
          from: paymentTransfer.args.from,
          to: paymentTransfer.args.to,
          amount: transferredAmount,
          amountUSDC: ethers.formatUnits(transferredAmount, USDC_DECIMALS),
          confirmations: receipt.confirmations,
          status: receipt.status
        }
      };
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        verified: false,
        error: error.message || 'Payment verification failed'
      };
    }
  }

  /**
   * Wait for transaction confirmation
   * @param {string} txHash - Transaction hash
   * @param {number} maxWaitTime - Maximum wait time in seconds (default: 120)
   * @returns {Promise<object>}
   */
  async waitForConfirmation(txHash, maxWaitTime = 120) {
    const startTime = Date.now();
    const maxWait = maxWaitTime * 1000;

    while (Date.now() - startTime < maxWait) {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (receipt) {
        return {
          confirmed: true,
          receipt: receipt,
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations
        };
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return {
      confirmed: false,
      error: 'Transaction confirmation timeout'
    };
  }

  /**
   * Get transaction status
   * @param {string} txHash - Transaction hash
   * @returns {Promise<object>}
   */
  async getTransactionStatus(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx) {
        return { status: 'not_found' };
      }

      if (!receipt) {
        return { 
          status: 'pending',
          hash: txHash,
          from: tx.from,
          to: tx.to
        };
      }

      return {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        hash: txHash,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        from: tx.from,
        to: tx.to
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

export const paymentVerifier = new PaymentVerifier();
export default paymentVerifier;

