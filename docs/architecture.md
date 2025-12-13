# Architecture Overview

## Core Components

### 1. Validator (`src/validator.ts`)
The core logic for enforcing EIP-7562 rules. It hooks into the EVM execution loop to monitor opcodes and storage access.

### 2. Simulation Engine
Uses `@ethereumjs/vm` to create a sandboxed environment. It mimics the behavior of an ERC-4337 Bundler during the validation phase.

### 3. Rule Sets
- **Opcode Rules**: Static list of banned opcodes.
- **Storage Rules**: Dynamic checks based on the current execution context (Sender vs. Factory vs. Paymaster).

## Data Flow

1. **Input**: `UserOperation` JSON + State (optional).
2. **Static Validation**: Check fields, types, and basic limits.
3. **Simulation Setup**:
   - Fork/Initialize VM.
   - Set up EntryPoint.
4. **Execution Monitoring**:
   - Attach `validateExecutionRules` hook.
   - Run `validateUserOp`.
   - Capture violations.
5. **Output**: Validation Result (Success/Failure with reasons).
