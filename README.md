# UserOp Validator

[![npm version](https://img.shields.io/npm/v/userop-validator.svg)](https://www.npmjs.com/package/userop-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A robust ERC-4337 UserOperation validator compliant with EIP-7562.

## Overview

This project implements a standalone validator for ERC-4337 UserOperations. It utilizes `@ethereumjs/vm` to simulate the validation phase of a UserOperation and enforces the strict rules defined in EIP-7562, including:

- **Opcode Restrictions**: Banning opcodes like `GASPRICE`, `TIMESTAMP`, `BLOCKHASH`, etc.
- **Storage Access Rules**: Enforcing storage access restrictions for Senders, Factories, and Paymasters per EIP-7562.
- **Gas Limits**: Validating `verificationGasLimit`, `preVerificationGas` (including calculation), and fee integrity.

## Installation

```bash
npm install
# To install CLI globally (optional)
npm install -g userop-validator
```

## Usage

### CLI tool

You can validate a UserOperation JSON file directly using the CLI:

```bash
# Run via npx
npx ts-node src/cli.ts path/to/userop.json

# Or if built
node dist/cli.js path/to/userop.json
```

### Library

```typescript
import { validateExecutionRules, createValidationContext } from './src/validator';
import { validateUserOpStructure } from './src/static-checks';
import { VM } from '@ethereumjs/vm';

// 1. Static Checks
const staticResult = validateUserOpStructure(userOp);
if (!staticResult.isValid) {
  console.error(staticResult.errors);
}

// 2. Execution Simulation
// ... setup VM ...
const context = createValidationContext({
    sender: senderAddress,
    entryPoint: entryPointAddress,
    // ... other context
});

const cleanup = validateExecutionRules(vm, context);
// ... run validation step ...
cleanup();
```

### Development

- **Build**: `npm run build`
- **Test**: `npm test`
- **Lint**: `npm run lint`

## Roadmap

See [ROADMAP](./docs/roadmap.md) for the detailed development plan.

## License

MIT
# userop-validator
