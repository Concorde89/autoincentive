---
name: polymarket-monitor
description: Subscribe to Polymarket prediction market alerts via x402 micropayments. Use when user wants real-time alerts for arbitrage opportunities, whale trades, price moves, volume spikes, or market resolutions on Polymarket. Requires Base USDC for payment.
---

# Polymarket Monitor

Real-time Polymarket alerts delivered via Telegram. Pay with x402 (Base USDC).

## Quick Start

```bash
# 1. User must first start the bot (Telegram requirement)
# Tell user: "Start @autoincentivepoly_bot on Telegram first"

# 2. Subscribe (30-day example)
curl -X POST "https://polymarket.x402endpoints.online/polymarket-monitor/subscribe/30?telegram_id=USER_TELEGRAM_ID"
# Returns 402 with x402 payment instructions
# Complete payment, alerts begin immediately
```

## Endpoints

| Endpoint | Method | Cost |
|----------|--------|------|
| `/polymarket-monitor/plans` | GET | Free |
| `/polymarket-monitor/status?telegram_id=ID` | GET | Free |
| `/polymarket-monitor/subscribe/10?telegram_id=ID` | POST | $1 USDC |
| `/polymarket-monitor/subscribe/30?telegram_id=ID` | POST | $2.50 USDC |
| `/polymarket-monitor/subscribe/90?telegram_id=ID` | POST | $6 USDC |

Base URL: `https://polymarket.x402endpoints.online`

## Pricing

- 10 days: $1 USDC
- 30 days: $2.50 USDC
- 90 days: $6 USDC

All tiers include all alert types.

## Alert Types

- 🎯 Arbitrage (>1% spread)
- 📈 Price moves (>10% in 30min)
- 🐋 Whale orders (>$25K)
- 💧 Liquidity drops (>30%)
- ⚡ Volume spikes (>5x average)
- 🆕 Hot new markets
- ⏰ Resolution alerts

10-20 quality alerts per day.

## x402 Payment Flow

1. POST to subscribe endpoint
2. Receive 402 response with payment details:
   - `x-402-payto`: Payment address
   - `x-402-amount`: Amount in wei
   - `x-402-network`: base
   - `x-402-asset`: USDC
3. Execute USDC transfer on Base
4. Retry request with `x-402-payment` header containing tx proof
5. Receive 200 OK, subscription active

Facilitator: `facilitator.x402endpoints.online`
Payment Address: `0xf8c8D60Bc7433999A2ca5b026d9d194B9150b5dd`

## Pre-Subscription Requirement

**Critical**: User must send `/start` to @autoincentivepoly_bot before subscribing. Telegram bots cannot DM users who haven't initiated conversation.

Prompt user:
> "Before subscribing, open Telegram and send /start to @autoincentivepoly_bot. Then give me your Telegram ID (get it from @userinfobot)."

## Check Subscription Status

```bash
curl "https://polymarket.x402endpoints.online/polymarket-monitor/status?telegram_id=123456789"
```

Response:
```json
{
  "active": true,
  "expires_at": "2026-03-06T15:30:00Z",
  "plan": "30"
}
```

## Example Agent Flow

```
User: "I want Polymarket alerts"

Agent:
1. Check if user started bot: "Have you started @autoincentivepoly_bot on Telegram?"
2. Get telegram_id: "What's your Telegram ID? (Message @userinfobot to get it)"
3. Confirm plan: "Plans: 10 days ($1), 30 days ($2.50), 90 days ($6). Which one?"
4. Execute x402 payment to subscribe endpoint
5. Confirm: "Done! You'll receive alerts via Telegram."
```

## Built By

AutoIncentive — https://autoincentive.online
X: @Autoincentiv3
