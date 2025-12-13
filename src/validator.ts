import { VM } from '@ethereumjs/vm';
import { InterpreterStep } from '@ethereumjs/evm';
import { Address } from '@ethereumjs/util';

// Opcode values
const OPCODES = {
  GASPRICE: 0x3a,
  TIMESTAMP: 0x42,
  BLOCKHASH: 0x40,
  NUMBER: 0x43,
  DIFFICULTY: 0x44,
  PREVRANDAO: 0x44, // Merge renamed DIFFICULTY to PREVRANDAO
  COINBASE: 0x41,
  SLOAD: 0x54,
  SSTORE: 0x55,
};

export class ValidationViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationViolationError';
  }
}

/**
 * Validates execution rules for ERC-4337.
 * @param vm The VM instance.
 * @param sender The address of the Sender (UserOperation.sender).
 * @returns A cleanup function to remove the listener.
 */
export function validateExecutionRules(vm: VM, sender: Address): () => void {
  const stepListener = async (data: InterpreterStep, next?: (error?: any) => void) => {
    try {
      const opcode = data.opcode.code;

      // 1. Banned Opcodes
      if (
        opcode === OPCODES.GASPRICE ||
        opcode === OPCODES.TIMESTAMP ||
        opcode === OPCODES.BLOCKHASH ||
        opcode === OPCODES.NUMBER ||
        opcode === OPCODES.DIFFICULTY ||
        opcode === OPCODES.COINBASE
      ) {
        throw new ValidationViolationError(`Opcode ${data.opcode.fullName} (${opcode}) is banned during validation.`);
      }

      // 2. Storage Rules
      if (opcode === OPCODES.SLOAD || opcode === OPCODES.SSTORE) {
        // Stack items are BigInt in recent ethereumjs versions
        // SLOAD: key is at stack[stack.length - 1]
        // SSTORE: key is at stack[stack.length - 1]
        const stack = data.stack;
        if (stack.length > 0) {
          const key = stack[stack.length - 1]; // Peek top
          const keyHex = '0x' + key.toString(16);
          
          // Check if the storage being accessed belongs to the sender
          // data.address is the address of the account whose storage is being accessed
          const currentStorageAddress = data.address;

          if (!currentStorageAddress.equals(sender)) {
             console.warn(
              `[Validation Warning] Storage access violation: accessing slot ${keyHex} of contract ${currentStorageAddress.toString()} which is not the sender ${sender.toString()}`
            );
            // In strict mode, we might throw here:
            // throw new ValidationViolationError(...);
          } else {
             // Log valid access for debugging
             // console.log(`[Validation] Valid storage access: slot ${keyHex} of sender.`);
          }
        }
      }

      if (next) next();
    } catch (err) {
      if (next) next(err);
      else throw err;
    }
  };

  // Attach the listener
  vm.evm.events.on('step', stepListener);

  // Return cleanup function
  return () => {
    vm.evm.events.removeListener('step', stepListener);
  };
}

// Example integration
export async function runValidationExample(vm: VM, sender: Address, code: Buffer) {
  console.log('Starting validation...');
  
  // 1. Attach the validator
  const cleanup = validateExecutionRules(vm, sender);

  try {
    // 2. Run the call (simulating validation phase)
    // Note: In a real UserOp validation, you'd be calling 'validateUserOp' on the sender.
    await vm.runCall({
      to: sender,
      caller: Address.zero(), // EntryPoint
      data: code,
      gasLimit: BigInt(1000000),
    });
    console.log('Validation passed.');
  } catch (error) {
    if (error instanceof ValidationViolationError) {
      console.error('Validation failed:', error.message);
    } else {
      console.error('Execution error:', error);
    }
  } finally {
    // 3. Cleanup
    cleanup();
  }
}
