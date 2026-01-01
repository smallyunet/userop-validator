# Reputation System

The userop-validator implements a local reputation system compliant with EIP-7562. This system prevents Denial-of-Service (DoS) attacks by throttling or banning entities that consistently cause validation failures.

## Overview

The reputation system tracks the behavior of:
- **Paymasters**: Entities that pay for transaction gas.
- **Factories**: Contracts that deploy Smart Accounts.

Each entity is tracked in an `InMemoryReputationStore` (persistent storage can be added in future).

## Reputation States

Entities can be in one of three states:
1. **OK**: Good standing. Allowed to process UserOps.
2. **THROTTLED**: High frequent failure rate (currently > 2 consecutive failures). Allowed but rate-limited (simulated as rejection for now).
3. **BANNED**: Excessive failures (currently > 5 consecutive failures). Completely blocked for a duration (simulated as permanent ban until clear).

## Validation Logic

1. **Pre-Validation**:
   Before simulation starts, the validator checks the reputation status of the Paymaster and Factory (if present).
   - If **BANNED**: Immediate validation failure.
   - If **THROTTLED**: Immediate validation failure (rate limiting).

2. **Post-Validation**:
   After simulation:
   - If **Validation Successful**: Entity reputation is improved (seen count increases).
   - If **Validation Failed** due to Entity Rule Violation**: Entity reputation is penalized (failure count increases).

## Configuration

Current hardcoded thresholds for MVP:
- `MAX_FAILURES_ALLOWED`: 5
- `THROTTLE_THRESHOLD`: 2

## Usage

The reputation system is automatically enabled when using `SimulationEnvironment`.

```typescript
import { SimulationEnvironment } from './src/simulation';

const env = new SimulationEnvironment();
await env.init();

// Reputation is checked internally during simulateValidation
const result = await env.simulateValidation(userOp);
```
