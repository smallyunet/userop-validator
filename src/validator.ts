import { VM } from '@ethereumjs/vm';
import { InterpreterStep } from '@ethereumjs/evm';
import { Address } from '@ethereumjs/util';
import { EntityType, ValidationViolation } from './types';

// Opcode values
const OPCODES = {
  GASPRICE: 0x3a,
  TIMESTAMP: 0x42,
  BLOCKHASH: 0x40,
  NUMBER: 0x43,
  DIFFICULTY: 0x44,
  PREVRANDAO: 0x44, // Merge renamed DIFFICULTY to PREVRANDAO
  COINBASE: 0x41,
  GASLIMIT: 0x45,
  SELFBALANCE: 0x47,
  BASEFEE: 0x48,
  CREATE: 0xf0,
  CREATE2: 0xf5,
  SLOAD: 0x54,
  SSTORE: 0x55,
};

// Banned opcodes per EIP-7562
const BANNED_OPCODES = new Set([
  OPCODES.GASPRICE,
  OPCODES.TIMESTAMP,
  OPCODES.BLOCKHASH,
  OPCODES.NUMBER,
  OPCODES.DIFFICULTY,
  OPCODES.COINBASE,
  OPCODES.GASLIMIT,
  OPCODES.SELFBALANCE,
  OPCODES.BASEFEE,
]);

// Opcode names for error messages
const OPCODE_NAMES: Record<number, string> = {
  [OPCODES.GASPRICE]: 'GASPRICE',
  [OPCODES.TIMESTAMP]: 'TIMESTAMP',
  [OPCODES.BLOCKHASH]: 'BLOCKHASH',
  [OPCODES.NUMBER]: 'NUMBER',
  [OPCODES.DIFFICULTY]: 'DIFFICULTY/PREVRANDAO',
  [OPCODES.COINBASE]: 'COINBASE',
  [OPCODES.GASLIMIT]: 'GASLIMIT',
  [OPCODES.SELFBALANCE]: 'SELFBALANCE',
  [OPCODES.BASEFEE]: 'BASEFEE',
};

export class ValidationViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationViolationError';
  }
}

/**
 * Validation context for entity-aware rule checking
 */
export interface ValidationContext {
  /** Current executing entity */
  entity: EntityType;
  /** Sender address */
  sender: Address;
  /** Factory address (if any) */
  factory?: Address;
  /** Paymaster address (if any) */
  paymaster?: Address;
  /** EntryPoint address */
  entryPoint: Address;
  /** Collected violations (non-throwing mode) */
  violations: ValidationViolation[];
  /** Whether to throw on first violation */
  throwOnViolation: boolean;
}

/**
 * Creates a validation context
 */
export function createValidationContext(options: {
  sender: Address;
  entryPoint: Address;
  factory?: Address;
  paymaster?: Address;
  throwOnViolation?: boolean;
}): ValidationContext {
  return {
    entity: EntityType.SENDER,
    sender: options.sender,
    entryPoint: options.entryPoint,
    factory: options.factory,
    paymaster: options.paymaster,
    violations: [],
    throwOnViolation: options.throwOnViolation ?? false,
  };
}

/**
 * Sets the current executing entity in the context
 */
export function setCurrentEntity(context: ValidationContext, entity: EntityType): void {
  context.entity = entity;
}

/**
 * Validates execution rules for ERC-4337 with entity awareness.
 * @param vm The VM instance.
 * @param context The validation context with entity information.
 * @returns A cleanup function to remove the listener.
 */
export function validateExecutionRules(vm: VM, context: ValidationContext): () => void {
  const stepListener = async (data: InterpreterStep, next?: (error?: unknown) => void) => {
    try {
      const opcode = data.opcode.code;
      const pc = data.pc;

      // 1. Banned Opcodes
      if (BANNED_OPCODES.has(opcode)) {
        const opcodeName = OPCODE_NAMES[opcode] || `0x${opcode.toString(16)}`;
        const violation: ValidationViolation = {
          type: 'BANNED_OPCODE',
          entity: context.entity,
          message: `Opcode ${opcodeName} is banned during validation (entity: ${context.entity})`,
          pc,
        };

        context.violations.push(violation);

        if (context.throwOnViolation) {
          throw new ValidationViolationError(violation.message);
        }
      }

      // 2. CREATE/CREATE2 restrictions (only allowed for Factory)
      if (opcode === OPCODES.CREATE || opcode === OPCODES.CREATE2) {
        if (context.entity !== EntityType.FACTORY) {
          const violation: ValidationViolation = {
            type: 'ENTITY_RESTRICTION',
            entity: context.entity,
            message: `CREATE/CREATE2 only allowed for Factory entity, current: ${context.entity}`,
            pc,
          };

          context.violations.push(violation);

          if (context.throwOnViolation) {
            throw new ValidationViolationError(violation.message);
          }
        }
      }

      // 3. Storage Rules
      if (opcode === OPCODES.SLOAD || opcode === OPCODES.SSTORE) {
        const stack = data.stack;
        if (stack.length > 0) {
          const key = stack[stack.length - 1];
          const keyHex = '0x' + key.toString(16).padStart(64, '0');
          const storageAddress = data.address;

          const violation = checkStorageAccess(context, storageAddress, keyHex, pc);
          if (violation) {
            context.violations.push(violation);

            if (context.throwOnViolation) {
              throw new ValidationViolationError(violation.message);
            }
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
  vm.evm.events?.on('step', stepListener);

  // Return cleanup function
  return () => {
    vm.evm.events?.removeListener('step', stepListener);
  };
}

/**
 * Checks if storage access is allowed for the current entity
 */
function checkStorageAccess(
  context: ValidationContext,
  storageAddress: Address,
  slot: string,
  pc: number
): ValidationViolation | null {
  const { entity, sender, factory, paymaster, entryPoint } = context;

  // EntryPoint storage is always allowed (for deposit info)
  if (storageAddress.equals(entryPoint)) {
    return null;
  }

  switch (entity) {
    case EntityType.SENDER:
      // Sender can access its own storage
      if (storageAddress.equals(sender)) {
        return null;
      }
      break;

    case EntityType.FACTORY:
      // Factory can access its own storage
      if (factory && storageAddress.equals(factory)) {
        return null;
      }
      // Factory can access sender storage (for deployment)
      if (storageAddress.equals(sender)) {
        return null;
      }
      break;

    case EntityType.PAYMASTER:
      // Paymaster can access its own storage
      if (paymaster && storageAddress.equals(paymaster)) {
        return null;
      }
      break;

    case EntityType.ENTRYPOINT:
      // EntryPoint has full access
      return null;
  }

  // Storage access not allowed
  return {
    type: 'ILLEGAL_STORAGE_ACCESS',
    entity,
    message: `Illegal storage access: ${entity} accessing slot ${slot} of ${storageAddress.toString()}`,
    pc,
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use validateExecutionRules with ValidationContext instead
 */
export function validateExecutionRulesLegacy(vm: VM, sender: Address): () => void {
  const context = createValidationContext({
    sender,
    entryPoint: new Address(new Uint8Array(20)), // Dummy EntryPoint
    throwOnViolation: true,
  });
  return validateExecutionRules(vm, context);
}
