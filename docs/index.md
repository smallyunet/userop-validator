# UserOp Validator Documentation

[![npm version](https://img.shields.io/npm/v/userop-validator.svg)](https://www.npmjs.com/package/userop-validator)

**UserOp Validator** is a robust, standalone validation library for [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) UserOperations. It is designed to act as a reference implementation for the validation logic performed by Bundlers, ensuring that UserOperations are safe to include in a bundle.

It fully implements the strict validation rules defined in [EIP-7562](https://eips.ethereum.org/EIPS/eip-7562), protecting the network from DoS attacks.

## Key Features

- **Static Analysis**: Validates the structure, types, and required fields of a `PackedUserOperation` before execution.
- **Execution Simulation**: Simulates the `validateUserOp` execution using a real EVM (`@ethereumjs/vm`) environment.
- **Opcode Banning**: Enforces restrictions on banned opcodes (e.g., `GASPRICE`, `TIMESTAMP`) during validation.
- **Storage Rules**: strict enforcement of EIP-7562 storage access rules:
    - **Sender**: Can only access its own storage.
    - **Factory**: Restricted access to own storage and contract deployment.
    - **Paymaster**: Restricted access to own storage and EntryPoint deposit info.
- **Gas & Economics**:
    - Calculates intrinsically required `preVerificationGas`.
    - Validates `verificationGasLimit` and fee parameters against network standards.
- **CLI Tool**: Built-in command-line interface for validating UserOp JSON files.

## Installation

Install the package via npm:

```bash
npm install userop-validator
```

## Usage

### 1. Command Line Interface (CLI)

The easiest way to check a `UserOperation` is using the CLI. You can provide a JSON file containing the `PackedUserOperation` object.

**Example JSON (`userop.json`):**
```json
{
  "sender": "0x...",
  "nonce": "0x...",
  "initCode": "0x...",
  "callData": "0x...",
  "accountGasLimits": "0x...",
  "preVerificationGas": "0x...",
  "gasFees": "0x...",
  "paymasterAndData": "0x...",
  "signature": "0x..."
}
```

**Run Validation:**

```bash
# Using npx
npx userop-validator ./userop.json

# Output:
# Validating UserOp from: ./userop.json
# Static Validation Passed ✅
```

### 2. Library Integration

You can integrate the validator into your own TypeScript/JavaScript projects (e.g., a custom Bundler, a Wallet, or a testing tool).

#### Static Checks
Perform cheap, fast checks on the structure and limits.

```typescript
import { validateUserOpStructure } from 'userop-validator/dist/static-checks';

const userOp = { ... }; // Your PackedUserOperation object
const result = validateUserOpStructure(userOp);

if (!result.isValid) {
    console.error("Validation Errors:", result.errors);
} else {
    console.log("Structure is valid!");
}
```

#### Execution Simulation (Full Validation)
To perform the deep validation (simulating the EVM execution), you need to set up a VM instance and use the validator context.

```typescript
import { VM } from '@ethereumjs/vm';
import { Address } from '@ethereumjs/util';
import { 
    validateExecutionRules, 
    createValidationContext, 
    EntityType 
} from 'userop-validator/dist/validator';

// 1. Initialize VM (forked or new)
const vm = await VM.create();

// 2. Prepare Context
// Defines who is executing and what rules to apply
const context = createValidationContext({
    sender: Address.fromString("0xSenderAddress..."),
    entryPoint: Address.fromString("0xEntryPointAddress..."),
    paymaster: Address.fromString("0xPaymasterAddress..."), // optional
    factory: Address.fromString("0xFactoryAddress..."),     // optional
});

// 3. Attach Validator Hook
// This injects the EIP-7562 rules into the EVM step loop
const cleanup = validateExecutionRules(vm, context);

try {
    // 4. Run the simulation
    // e.g., vm.runCall({ ... }) calling EntryPoint.validateUserOp
    await vm.runCall({
        to: context.entryPoint,
        data: Buffer.from("..."), // encoded validateUserOp call
        // ...
    });
    
    // Check for violations collected during execution
    if (context.violations.length > 0) {
        console.error("Validation Violations:", context.violations);
    }
} finally {
    // 5. Cleanup hooks
    cleanup();
}
```

## Validation Details

### Storage Rules (EIP-7562)
The validator tracks every `SLOAD` and `SSTORE` operation.
- **Associated Storage**: Checks if the slot belongs to the entity (e.g., `slot == address`).
- **External Access**: Prevents entities from reading/writing unrestricted slots in other contracts.

### Gas Validation
- **Pre-verification Gas**: We calculate the "intrinsic" gas cost of the UserOp based on its calldata size (zeros vs non-zeros) and a fixed overhead (21000).
- **Limits**: We verify that the specified `preVerificationGas` is sufficient to cover this cost.

## Contributing

Contributions are welcome!

1. Clone the repository.
2. Run `npm install`.
3. Run tests with `npm test`.

## License

MIT
