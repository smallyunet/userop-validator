# UserOp Validator Roadmap

This roadmap outlines the development plan for building a robust ERC-4337 UserOperation validator, compliant with EIP-7562.

## Phase 1: Foundation & Static Checks ✅
- [x] **Type Definitions**: Define TypeScript interfaces for `UserOperation`, `PackedUserOperation`, and related structures.
- [x] **Static Sanity Checks**:
    - Validate required fields exist and are of correct types.
    - Check `verificationGasLimit`, `callGasLimit`, `preVerificationGas` are within reasonable bounds.
    - Verify `sender` address format.
    - Validate signature length/format.
- [x] **VM Setup**:
    - Initialize a persistent `VM` instance.
    - Deploy a mock or real `EntryPoint` contract code into the VM state for simulation.

## Phase 2: Execution Simulation (Validation Phase) ✅
- [x] **Basic Opcode Banning**: Implement `validateExecutionRules` to ban `GASPRICE`, `TIMESTAMP`, etc. (Completed in `../src/validator.ts`)
- [x] **Simulation Loop**:
    - Implement `simulateValidation(userOp)` function.
    - Handle `initCode`: If present, simulate the deployment of the sender account (Factory validation).
    - Simulate `EntryPoint.validateUserOp` call.
    - Simulate `Paymaster.validatePaymasterUserOp` (if paymaster is used).
- [x] **Context-Aware Hooks**:
    - Update the event hook to know *which* entity is currently executing (Sender, Factory, or Paymaster) to apply specific rules.

## Phase 3: Advanced Storage Rules (EIP-7562) ✅
- [x] **Storage Access Tracking**:
    - Enhance the `step` listener to track *all* storage slots accessed during validation.
- [x] **Associated Storage Rules**:
    - Implement logic to allow access to the entity's own storage.
    - Implement "Mapping" pattern detection (e.g., `mapping(address => value)`).
    - Allow access to `EntryPoint` storage (specifically the entity's deposit info).
- [x] **Entity-Specific Restrictions**:
    - **Factory**: Can only access its own storage and the specific slot of the contract being deployed.
    - **Paymaster**: Can only access its own storage and the sender's entry in the EntryPoint.

## Phase 4: Gas & Economics ✅
- [x] **Pre-verification Gas**: Implement the calculation logic for `preVerificationGas` (calldata cost + overhead).
- [x] **Gas Limit Verification**: Ensure `verificationGasLimit` is sufficient but not excessive.
- [x] **Fee Validation**: Check `maxFeePerGas` and `maxPriorityFeePerGas` against current network conditions (simulated).
- [x] **Balance Checks**: Verify the Sender or Paymaster has sufficient deposit in the EntryPoint.

## Phase 5: Interface & Testing ✅
- [x] **CLI Tool**: Create a command-line interface to validate a UserOp JSON file.
- [x] **Unit Testing**: Write test cases for:
    - Valid UserOps.
    - UserOps using banned opcodes.
    - UserOps accessing illegal storage.
    - UserOps with insufficient gas.
- [x] **Error Reporting**: Improve error messages to be granular (e.g., "Illegal storage access at PC 0x123: Slot 0x...").

## Phase 6: Reputation System (Optional/Advanced)
- [ ] Implement a local reputation store.
- [ ] Track throttling/banning for Paymasters and Factories based on validation failures.
