/**
 * Represents a hexadecimal string starting with '0x'
 */
export type HexString = string;

/**
 * ERC-4337 UserOperation (v0.7 PackedUserOperation)
 * Based on https://eips.ethereum.org/EIPS/eip-4337
 */
export interface PackedUserOperation {
  /**
   * The account making the operation
   */
  sender: HexString;

  /**
   * The nonce of the account.
   * High 192 bits are key, low 64 bits are sequence.
   */
  nonce: bigint | HexString;

  /**
   * The initCode of the account (needed if account is not yet on-chain)
   */
  initCode: HexString;

  /**
   * The data to execute
   */
  callData: HexString;

  /**
   * Packed account gas limits:
   * verificationGasLimit (16 bytes) | callGasLimit (16 bytes)
   */
  accountGasLimits: HexString;

  /**
   * Packed pre-verification gas:
   * preVerificationGas (byte-packed)
   */
  preVerificationGas: bigint | HexString;

  /**
   * Packed gas fees:
   * maxPriorityFeePerGas (16 bytes) | maxFeePerGas (16 bytes)
   */
  gasFees: HexString;

  /**
   * Paymaster and data:
   * paymaster + paymasterVerificationGasLimit + paymasterPostOpGasLimit + paymasterData
   */
  paymasterAndData: HexString;

  /**
   * Signature of the operation
   */
  signature: HexString;
}

/**
 * Result of static validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Entity types involved in UserOperation validation
 */
export enum EntityType {
  /** The account making the operation */
  SENDER = 'SENDER',
  /** Factory contract deploying the account */
  FACTORY = 'FACTORY',
  /** Paymaster sponsoring the operation */
  PAYMASTER = 'PAYMASTER',
  /** EntryPoint contract */
  ENTRYPOINT = 'ENTRYPOINT',
}

/**
 * Result of simulation validation
 */
export interface SimulationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** List of validation errors (if any) */
  errors: string[];
  /** List of validation violations detected during execution */
  violations: ValidationViolation[];
  /** Gas used during simulation */
  gasUsed?: bigint;
  /** Execution trace (if enabled) */
  trace?: ExecutionTrace;
}

/**
 * Represents a specific validation violation
 */
export interface ValidationViolation {
  /** Type of violation */
  type: 'BANNED_OPCODE' | 'ILLEGAL_STORAGE_ACCESS' | 'ENTITY_RESTRICTION';
  /** Which entity caused the violation */
  entity: EntityType;
  /** Detailed message */
  message: string;
  /** Program counter where violation occurred */
  pc?: number;
  /** Storage address accessed (for storage violations) */
  storageAddress?: string;
  /** Storage slot accessed (for storage violations) */
  slot?: string;
}

/**
 * EIP-4337 standardized validation error codes
 */
export enum ValidationErrorCode {
  /** EntryPoint rejected the UserOperation */
  REJECTED_BY_EP = -32500,
  /** Paymaster rejected the UserOperation */
  REJECTED_BY_PAYMASTER = -32501,
  /** Banned opcode used during validation */
  BANNED_OPCODE = -32502,
  /** Illegal storage access during validation */
  INVALID_STORAGE = -32503,
  /** Entity is throttled (reputation system) */
  ENTITY_THROTTLED = -32504,
  /** Entity is banned (reputation system) */
  ENTITY_BANNED = -32505,
  /** Invalid signature */
  INVALID_SIGNATURE = -32506,
  /** Invalid nonce */
  INVALID_NONCE = -32507,
}

/**
 * Single step in execution trace
 */
export interface TraceStep {
  /** Program counter */
  pc: number;
  /** Opcode name */
  opcode: string;
  /** Gas cost for this step */
  gasCost: number;
  /** Call depth */
  depth: number;
}

/**
 * Execution trace for debugging
 */
export interface ExecutionTrace {
  /** All execution steps */
  steps: TraceStep[];
}

/**
 * Result of batch validation for a single UserOperation
 */
export interface BatchValidationResult {
  /** Index of the UserOperation in the batch */
  index: number;
  /** Whether this UserOperation is valid */
  isValid: boolean;
  /** Error code if invalid */
  errorCode?: ValidationErrorCode;
  /** Error message if invalid */
  error?: string;
}
