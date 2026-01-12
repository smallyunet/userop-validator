import { SimulationEnvironment } from '../src/simulation';
import { createAddressFromString, hexToBytes } from '@ethereumjs/util';
import { PackedUserOperation } from '../src/types';

describe('SimulationEnvironment', () => {
    let simEnv: SimulationEnvironment;

    beforeEach(() => {
        simEnv = new SimulationEnvironment();
    });

    describe('Initialization', () => {
        it('should initialize VM successfully', async () => {
            await simEnv.init();
            expect(simEnv.getVM()).toBeDefined();
        });

        it('should throw if getting VM before init', () => {
            expect(() => simEnv.getVM()).toThrow('SimulationEnvironment not initialized');
        });

        it('should accept custom EntryPoint address', () => {
            const customEntryPoint = '0x1234567890123456789012345678901234567890';
            const customSimEnv = new SimulationEnvironment({ entryPointAddress: customEntryPoint });
            // Should not throw during construction
            expect(customSimEnv).toBeDefined();
        });
    });

    describe('Mock Deployment', () => {
        it('should deploy mock EntryPoint code', async () => {
            await simEnv.init();
            const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

            await simEnv.deployMockEntryPoint(entryPointAddress);

            const vm = simEnv.getVM();
            const address = createAddressFromString(entryPointAddress);
            const code = await vm.stateManager.getCode(address);

            expect(code.length).toBeGreaterThan(0);
            expect(Buffer.from(code).toString('hex')).toBe('00');
        });

        it('should deploy custom code at address', async () => {
            await simEnv.init();
            const address = createAddressFromString('0x1234567890123456789012345678901234567890');
            const code = hexToBytes('0x6001600101');

            await simEnv.deployCode(address, code);

            const vm = simEnv.getVM();
            const deployedCode = await vm.stateManager.getCode(address);
            expect(Buffer.from(deployedCode).toString('hex')).toBe('6001600101');
        });
    });

    describe('simulateValidation', () => {
        const createValidUserOp = (): PackedUserOperation => ({
            sender: '0x1234567890123456789012345678901234567890',
            nonce: '0x0',
            initCode: '0x',
            callData: '0x',
            accountGasLimits: '0x0000000000000000000000000000000000000000000000000000000000000000',
            preVerificationGas: '0x0',
            gasFees: '0x0000000000000000000000000000000000000000000000000000000000000000',
            paymasterAndData: '0x',
            signature: '0x'
        });

        it('should return SimulationResult with isValid', async () => {
            await simEnv.init();
            const userOp = createValidUserOp();

            const result = await simEnv.simulateValidation(userOp);

            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('violations');
        });

        it('should validate UserOp without initCode or paymaster', async () => {
            await simEnv.init();
            const userOp = createValidUserOp();

            const result = await simEnv.simulateValidation(userOp);

            // Should complete without fatal errors (sender has no code, but that's OK)
            expect(result.errors).toHaveLength(0);
        });

        it('should parse factory from initCode', async () => {
            await simEnv.init();
            const userOp = createValidUserOp();

            // initCode with factory address + some calldata
            const factory = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            userOp.initCode = factory + '1234567890';

            const result = await simEnv.simulateValidation(userOp);

            // Factory validation should run (no fatal errors expected)
            expect(result).toHaveProperty('isValid');
        });

        it('should parse paymaster from paymasterAndData', async () => {
            await simEnv.init();
            const userOp = createValidUserOp();

            // paymasterAndData: paymaster (20 bytes) + verificationGasLimit (16 bytes) + postOpGasLimit (16 bytes) + data
            const paymaster = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
            const gasLimits = '00'.repeat(32); // 16 + 16 bytes
            userOp.paymasterAndData = paymaster + gasLimits + '1234';

            const result = await simEnv.simulateValidation(userOp);

            // Paymaster validation should run
            expect(result).toHaveProperty('isValid');
        });

        it('should detect banned opcodes during validation', async () => {
            await simEnv.init();
            const userOp = createValidUserOp();
            const sender = createAddressFromString(userOp.sender);

            // Deploy code that uses TIMESTAMP (banned opcode)
            const bannedBytecode = hexToBytes('0x4200'); // TIMESTAMP + STOP
            await simEnv.deployCode(sender, bannedBytecode);

            const result = await simEnv.simulateValidation(userOp);

            // Should detect the banned opcode
            expect(result.violations.length).toBeGreaterThan(0);
            expect(result.violations[0].type).toBe('BANNED_OPCODE');
        });
    });
});
