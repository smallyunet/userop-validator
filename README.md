# UserOp Validator

A robust ERC-4337 UserOperation validator compliant with EIP-7562.

## Overview

This project implements a standalone validator for ERC-4337 UserOperations. It utilizes `@ethereumjs/vm` to simulate the validation phase of a UserOperation and enforces the strict rules defined in EIP-7562, including:

- **Opcode Restrictions**: Banning opcodes like `GASPRICE`, `TIMESTAMP`, `BLOCKHASH`, etc.
- **Storage Access Rules**: Enforcing storage access restrictions for Senders, Factories, and Paymasters.
- **Gas Limits**: Validating `verificationGasLimit`, `preVerificationGas`, etc.

## Installation

```bash
npm install
```

## Usage

### Library

```typescript
import { validateExecutionRules } from './src/validator';
import { VM } from '@ethereumjs/vm';

// ... setup VM ...
const cleanup = validateExecutionRules(vm, senderAddress);
// ... run validation ...
cleanup();
```

### Development

- **Build**: `npm run build`
- **Test**: `npm test`
- **Lint**: `npm run lint`

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the detailed development plan.

## License

MIT
# userop-validator
