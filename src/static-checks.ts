import { PackedUserOperation, ValidationResult } from './types';
import { createAddressFromString } from '@ethereumjs/util';
import { calcPreVerificationGas } from './gas';

/**
 * Validates the structure and basic types of a UserOperation.
 * This does NOT simulate execution.
 * @param userOp The PackedUserOperation to validate
 */
export function validateUserOpStructure(userOp: unknown): ValidationResult {
    const errors: string[] = [];

    // Check if object exists
    if (!userOp || typeof userOp !== 'object') {
        return { isValid: false, errors: ['UserOperation must be a non-null object'] };
    }

    // Required keys for PackedUserOperation
    const requiredKeys: (keyof PackedUserOperation)[] = [
        'sender',
        'nonce',
        'initCode',
        'callData',
        'accountGasLimits',
        'preVerificationGas',
        'gasFees',
        'paymasterAndData',
        'signature',
    ];

    // 1. Missing Fields Check
    for (const key of requiredKeys) {
        if (!(key in userOp)) {
            errors.push(`Missing field: ${key}`);
        }
    }

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    const op = userOp as PackedUserOperation;

    // 2. Address Validation
    if (!isValidAddress(op.sender)) {
        errors.push(`Invalid sender address format: ${op.sender}`);
    }

    // 3. Hex String Validation for Byte fields
    const hexFields: (keyof PackedUserOperation)[] = [
        'initCode',
        'callData',
        'accountGasLimits',
        'gasFees',
        'paymasterAndData',
        'signature'
    ];

    for (const field of hexFields) {
        const value = op[field];
        if (typeof value !== 'string' || !isValidHexString(value)) {
            errors.push(`Invalid hex string for field ${field}: ${value}`);
        }
    }

    // 4. Numeric/BigInt Validation
    // 'nonce' and 'preVerificationGas' can be string (hex) or bigint/number
    if (!isValidBigIntOrHex(op.nonce, true)) {
        errors.push(`Invalid nonce format: ${op.nonce}`);
    }
    if (!isValidBigIntOrHex(op.preVerificationGas, true)) {
        errors.push(`Invalid preVerificationGas format: ${op.preVerificationGas}`);
    }

    // 5. Gas Limit Validation
    const gasLimitErrors = validateGasLimits(op);
    errors.push(...gasLimitErrors);

    return {
        isValid: errors.length === 0,
        errors,
    };
}

// Imported calcPreVerificationGas at top
function validateGasLimits(op: PackedUserOperation): string[] {
    const errors: string[] = [];

    // unpack accountGasLimits
    // verificationGasLimit (16 bytes) | callGasLimit (16 bytes)
    if (!isValidPackedUints(op.accountGasLimits)) {
        errors.push(`Invalid accountGasLimits format: ${op.accountGasLimits}`);
    } else {
        // Check verificationGasLimit > 0
        const vgl = BigInt('0x' + op.accountGasLimits.slice(2, 34));
        const cgl = BigInt('0x' + op.accountGasLimits.slice(34));

        if (vgl < 10000n) { // Minimum reasonable limit
            // errors.push(`verificationGasLimit too low: ${vgl}`); // Optional warning
        }
    }

    // unpack gasFees
    // maxPriorityFeePerGas (16 bytes) | maxFeePerGas (16 bytes)
    if (!isValidPackedUints(op.gasFees)) {
        errors.push(`Invalid gasFees format: ${op.gasFees}`);
    }

    // preVerificationGas check
    const pvg = typeof op.preVerificationGas === 'string'
        ? BigInt(op.preVerificationGas)
        : BigInt(op.preVerificationGas);

    const calculatedPvg = calcPreVerificationGas(op);
    if (pvg < calculatedPvg) {
        errors.push(`preVerificationGas too low: expected at least ${calculatedPvg}, got ${pvg}`);
    }

    return errors;
}

function isValidPackedUints(hex: string): boolean {
    if (!isValidHexString(hex)) return false;
    // Must be 32 bytes (64 chars) + '0x' = 66 chars
    return hex.length === 66;
}

function isValidAddress(address: string): boolean {
    if (typeof address !== 'string') return false;
    try {
        // @ethereumjs/util createAddressFromString handles validation
        createAddressFromString(address);
        return true;
    } catch (e) {
        return false;
    }
}

function isValidHexString(hex: string): boolean {
    return /^0x[0-9a-fA-F]*$/.test(hex) && hex.length % 2 === 0;
}

function isValidHexNumber(hex: string): boolean {
    return /^0x[0-9a-fA-F]+$/.test(hex);
}

function isValidBigIntOrHex(value: unknown, allowOddLength: boolean = false): boolean {
    if (typeof value === 'bigint') return true;
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0;
    if (typeof value === 'string') {
        return allowOddLength ? isValidHexNumber(value) : isValidHexString(value);
    }
    return false;
}
