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
}
