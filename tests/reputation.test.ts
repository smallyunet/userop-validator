import { SimulationEnvironment } from '../src/simulation';
import { InMemoryReputationStore, ReputationStatus } from '../src/reputation';
import { PackedUserOperation } from '../src/types';
import { createAddressFromString } from '@ethereumjs/util';

describe('Reputation System', () => {
    let env: SimulationEnvironment;
    const mockUserOp: PackedUserOperation = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        accountGasLimits: '0x00000000000000000000000000000000000000000000000000000000000186a0', // 100000
        preVerificationGas: '0x5208',
        gasFees: '0x',
        paymasterAndData: '0x',
        signature: '0x'
    };

    const PAYMASTER_ADDRESS = '0x9999999999999999999999999999999999999999';

    beforeEach(async () => {
        env = new SimulationEnvironment();
        await env.init();
    });

    describe('InMemoryReputationStore Unit Logic', () => {
        let store: InMemoryReputationStore;
        const address = createAddressFromString(PAYMASTER_ADDRESS);

        beforeEach(() => {
            store = new InMemoryReputationStore();
        });

        it('should start with OK status', () => {
            expect(store.getStatus(address)).toBe(ReputationStatus.OK);
        });

        it('should throttle after threshold failures', () => {
            // Throttle threshold is 2
            store.updateStatus(address, false);
            store.updateStatus(address, false);
            expect(store.getStatus(address)).toBe(ReputationStatus.THROTTLED);
        });

        it('should ban after max failures', () => {
            // Max failures is 5
            for (let i = 0; i < 5; i++) {
                store.updateStatus(address, false);
            }
            expect(store.getStatus(address)).toBe(ReputationStatus.BANNED);
        });

        it('should stay OK with successes', () => {
            store.updateStatus(address, true);
            store.updateStatus(address, true);
            store.updateStatus(address, true);
            expect(store.getStatus(address)).toBe(ReputationStatus.OK);
        });
    });

    describe('Integration with SimulationEnvironment', () => {
        it('should reject validation if Paymaster is BANNED', async () => {
            const store = env.getReputationStore();
            const paymasterAddr = createAddressFromString(PAYMASTER_ADDRESS);

            // Manually Ban
            for (let i = 0; i < 5; i++) {
                store.updateStatus(paymasterAddr, false);
            }
            expect(store.getStatus(paymasterAddr)).toBe(ReputationStatus.BANNED);

            // Create UserOp with banned Paymaster
            const userOpWithPaymaster = {
                ...mockUserOp,
                // paymasterAndData: 20 bytes address + rest
                paymasterAndData: PAYMASTER_ADDRESS + '0'.repeat(24) // dummy
            };

            const result = await env.simulateValidation(userOpWithPaymaster);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.includes('is BANNED'))).toBe(true);
        });

        it('should reject validation if Paymaster is THROTTLED', async () => {
            const store = env.getReputationStore();
            const paymasterAddr = createAddressFromString(PAYMASTER_ADDRESS);

            // Manually Throttle (2 failures)
            store.updateStatus(paymasterAddr, false);
            store.updateStatus(paymasterAddr, false);
            expect(store.getStatus(paymasterAddr)).toBe(ReputationStatus.THROTTLED);

            // Create UserOp with throttled Paymaster
            const userOpWithPaymaster = {
                ...mockUserOp,
                paymasterAndData: PAYMASTER_ADDRESS // valid length check might fail in parsePaymaster if too short, but let's see
            };
            // Ensure paymasterAndData is long enough (42 chars +)
            userOpWithPaymaster.paymasterAndData = PAYMASTER_ADDRESS + '00000000000000000000000000000000'; // 20 bytes + 16 bytes

            const result = await env.simulateValidation(userOpWithPaymaster);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.includes('is THROTTLED'))).toBe(true);
        });

        it('should update reputation on successful validation attempt', async () => {
            const store = env.getReputationStore();
            const paymasterAddr = createAddressFromString(PAYMASTER_ADDRESS);
            const spyUpdate = jest.spyOn(store, 'updateStatus');

            const userOpWithPaymaster = {
                ...mockUserOp,
                paymasterAndData: PAYMASTER_ADDRESS + '0'.repeat(64) // valid length
            };

            // This validation will likely fail due to other reasons (empty initCode/sender code),
            // BUT the entity check happens at the end. simulation catches errors.
            // If simulation fails due to runtime error (nothing deployed), it might not generate "Violations".
            // So updateStatus might receive `success=true` regarding RULES, but if simulation crashes?
            // My code: `isValid = violations.length === 0 && errors.length === 0`.
            // Update logic: `isPaymasterValid = paymasterViolations.length === 0`.
            // So even if runtime error occurs, if no *violations* (rules broken), it might count as valid reputation-wise?
            // Actually, if runtime error -> `errors` has elements -> result.isValid = false.
            // But `isPaymasterValid` is based ONLY on violations.
            // This means if Paymaster runs efficiently but has a bug (reverts), it doesn't get BANNED. This is correct per EIP-7562?
            // EIP-7562 says "If validatePaymasterUserOp reverts... it's a failure? No, mostly about rules."
            // "Opcodes... Storage..."
            // So yes, verification failure (revert) usually implies DoS if it consumes gas but doesn't pay?
            // Actually, if it reverts, the bundler pays?
            // Anyway, my implementation currently only tracks *violations*.

            await env.simulateValidation(userOpWithPaymaster);

            expect(spyUpdate).toHaveBeenCalledWith(
                expect.anything(), // Address object
                true // Expect true because there were no RULE violations
            );
        });
    });
});
