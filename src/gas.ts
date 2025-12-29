import { PackedUserOperation } from './types';
// import { toBuffer } from '@ethereumjs/util';

/**
 * Constants for gas calculation
 */
export const CallsBaseGas = 21000;
export const CallsNonZeroByteGas = 16;
export const CallsZeroByteGas = 4;

/**
 * Calculates the pre-verification gas for a UserOperation.
 * Formula: 21000 + calldata cost + overhead
 * Note: This is a simplified calculation.
 */
export function calcPreVerificationGas(userOp: PackedUserOperation): bigint {
    const p = userOp;
    // TODO: Handle unpacking if needed, but for PackedUserOp, the fields are packed.
    // We need to estimate the cost of the UserOp struct when put into calldata of handleOps.

    // For simplicity, we'll calculate the cost of the *packed* UserOp fields as checks.
    // In reality, the bundler estimates this based on the `handleOps` calldata size.

    // Iterate over all fields in PackedUserOp and sum up bytes
    // But wait, the userOp parameter *is* the struct.

    // Let's assume the overhead is fixed for now (e.g. 5000)
    const overhead = 5000; // Fixed overhead

    // Calculate calldata cost of the UserOp itself
    // We need to serialize it to bytes to count zeros/non-zeros.
    // Or just iterate the hex strings.

    let cost = BigInt(CallsBaseGas + overhead);

    const fields = [
        p.sender,
        p.nonce,
        p.initCode,
        p.callData,
        p.accountGasLimits,
        p.preVerificationGas,
        p.gasFees,
        p.paymasterAndData,
        p.signature
    ];

    for (const field of fields) {
        const hex = field.toString().startsWith('0x') ? field.toString().slice(2) : BigInt(field).toString(16);
        // Ensure even length
        const cleanHex = hex.length % 2 !== 0 ? '0' + hex : hex;

        for (let i = 0; i < cleanHex.length; i += 2) {
            const byte = parseInt(cleanHex.substring(i, i + 2), 16);
            if (byte === 0) {
                cost += BigInt(CallsZeroByteGas);
            } else {
                cost += BigInt(CallsNonZeroByteGas);
            }
        }
    }

    return cost;
}
