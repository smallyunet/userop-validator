import { validateUserOpStructure } from '../src/static-checks';

describe('validateUserOpStructure', () => {
    const validUserOp = {
        // Zero address is always valid
        sender: '0x0000000000000000000000000000000000000000',
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        accountGasLimits: '0x0000000000000000000000000000000000000000000000000000000000000000',
        preVerificationGas: '0x0',
        gasFees: '0x0000000000000000000000000000000000000000000000000000000000000000',
        paymasterAndData: '0x',
        signature: '0x'
    };

    test('should pass for a valid UserOp', () => {
        const result = validateUserOpStructure(validUserOp);
        if (!result.isValid) {
            console.log('Validation errors:', result.errors);
        }
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('should fail if required fields are missing', () => {
        const invalidOp = { ...validUserOp };
        // @ts-ignore
        delete invalidOp.sender;

        const result = validateUserOpStructure(invalidOp);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Missing field: sender');
    });

    test('should fail if sender address is invalid', () => {
        const invalidOp = { ...validUserOp, sender: '0xinvalid' };
        const result = validateUserOpStructure(invalidOp);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid sender address format');
    });

    test('should fail if hex strings are not valid hex', () => {
        const invalidOp = { ...validUserOp, callData: 'xyz' };
        const result = validateUserOpStructure(invalidOp);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid hex string');
    });

    test('should fail if gas limits are invalid packed format', () => {
        const invalidOp = { ...validUserOp, accountGasLimits: '0x123' }; // Too short, not 32 bytes
        const result = validateUserOpStructure(invalidOp);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Invalid accountGasLimits format'))).toBe(true);
    });

    test('should fail if gasFees are invalid packed format', () => {
        const invalidOp = { ...validUserOp, gasFees: '0x123456' };
        const result = validateUserOpStructure(invalidOp);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid gasFees format');
    });
});
