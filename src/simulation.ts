import { VM, createVM } from '@ethereumjs/vm';
import { Address, createAddressFromString, hexToBytes } from '@ethereumjs/util';
import { PackedUserOperation, SimulationResult, EntityType } from './types';
import {
    validateExecutionRules,
    createValidationContext,
    setCurrentEntity,
    ValidationContext
} from './validator';

// Standard EntryPoint address (v0.7)
const ENTRYPOINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

/**
 * Manages the simulation environment for UserOperation validation.
 * Maintains a persistent VM instance and handles mock deployments.
 */
export class SimulationEnvironment {
    private vm: VM | null = null;
    private entryPointAddress: Address;

    constructor(entryPointAddress?: string) {
        this.entryPointAddress = createAddressFromString(entryPointAddress || ENTRYPOINT_ADDRESS);
    }

    /**
     * Initializes the VM.
     * This must be called before using the VM.
     */
    async init(): Promise<void> {
        this.vm = await createVM();
    }

    /**
     * Returns the initialized VM instance.
     * Throws if init() has not been called.
     */
    getVM(): VM {
        if (!this.vm) {
            throw new Error('SimulationEnvironment not initialized. Call init() first.');
        }
        return this.vm;
    }

    /**
     * Deploys a mock EntryPoint contract to the given address.
     * @param address The address to deploy the EntryPoint to.
     */
    async deployMockEntryPoint(address: string): Promise<void> {
        const vm = this.getVM();
        const entryPointAddress = createAddressFromString(address);

        // Deploy some dummy bytecode (e.g., STOP 0x00)
        const mockCode = Buffer.from('00', 'hex');

        await vm.stateManager.putCode(entryPointAddress, mockCode);
    }

    /**
     * Deploys code at a specific address
     */
    async deployCode(address: Address, code: Uint8Array): Promise<void> {
        const vm = this.getVM();
        await vm.stateManager.putCode(address, code);
    }

    /**
     * Simulates the validation of a UserOperation.
     * This is the main entry point for validation simulation.
     * 
     * @param userOp The UserOperation to validate
     * @returns SimulationResult with validation status and any violations
     */
    async simulateValidation(userOp: PackedUserOperation): Promise<SimulationResult> {
        const vm = this.getVM();
        const sender = createAddressFromString(userOp.sender);
        const errors: string[] = [];

        // Parse factory and paymaster from packed fields
        const factory = this.parseFactory(userOp.initCode);
        const paymaster = this.parsePaymaster(userOp.paymasterAndData);

        // Create validation context
        const context = createValidationContext({
            sender,
            entryPoint: this.entryPointAddress,
            factory,
            paymaster,
            throwOnViolation: false, // Collect all violations
        });

        // Attach validation rules
        const cleanup = validateExecutionRules(vm, context);

        try {
            // Phase 1: Factory validation (if initCode is present)
            if (factory) {
                await this.simulateFactoryValidation(vm, context, userOp.initCode);
            }

            // Phase 2: Sender validation (validateUserOp)
            await this.simulateSenderValidation(vm, context);

            // Phase 3: Paymaster validation (if paymaster is present)
            if (paymaster) {
                await this.simulatePaymasterValidation(vm, context);
            }

        } catch (error) {
            if (error instanceof Error) {
                errors.push(error.message);
            } else {
                errors.push(String(error));
            }
        } finally {
            cleanup();
        }

        return {
            isValid: context.violations.length === 0 && errors.length === 0,
            errors,
            violations: context.violations,
        };
    }

    /**
     * Simulates factory deployment (Phase 1)
     */
    private async simulateFactoryValidation(
        vm: VM,
        context: ValidationContext,
        initCode: string
    ): Promise<void> {
        setCurrentEntity(context, EntityType.FACTORY);

        const factory = context.factory!;

        // initCode = factory address (20 bytes) + calldata
        const initCodeBytes = hexToBytes(initCode as `0x${string}`);
        const callData = initCodeBytes.slice(20);

        // Simulate the factory call
        await vm.evm.runCall({
            to: factory,
            caller: this.entryPointAddress,
            data: callData,
            gasLimit: BigInt(1000000),
        });
    }

    /**
     * Simulates sender validation (Phase 2)
     */
    private async simulateSenderValidation(
        vm: VM,
        context: ValidationContext,

    ): Promise<void> {
        setCurrentEntity(context, EntityType.SENDER);

        const sender = context.sender;

        // Encode validateUserOp selector + userOp hash + missingAccountFunds
        // validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        // Selector: 0x19822f7c
        const selector = '19822f7c';
        const mockUserOpHash = '00'.repeat(32);
        const mockMissingFunds = '00'.repeat(32);

        const callData = hexToBytes(`0x${selector}${mockUserOpHash}${mockMissingFunds}` as `0x${string}`);

        await vm.evm.runCall({
            to: sender,
            caller: this.entryPointAddress,
            data: callData,
            gasLimit: BigInt(1000000),
        });
    }

    /**
     * Simulates paymaster validation (Phase 3)
     */
    private async simulatePaymasterValidation(
        vm: VM,
        context: ValidationContext,

    ): Promise<void> {
        setCurrentEntity(context, EntityType.PAYMASTER);

        const paymaster = context.paymaster!;

        // paymasterAndData = paymaster (20 bytes) + verificationGasLimit (16 bytes) + postOpGasLimit (16 bytes) + data


        // Encode validatePaymasterUserOp selector
        // validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost)
        // Selector: 0x52b7512c
        const selector = '52b7512c';
        const mockUserOpHash = '00'.repeat(32);
        const mockMaxCost = '00'.repeat(32);

        const callData = hexToBytes(`0x${selector}${mockUserOpHash}${mockMaxCost}` as `0x${string}`);

        await vm.evm.runCall({
            to: paymaster,
            caller: this.entryPointAddress,
            data: callData,
            gasLimit: BigInt(1000000),
        });
    }

    /**
     * Parses factory address from initCode
     * initCode = factory (20 bytes) + calldata
     */
    private parseFactory(initCode: string): Address | undefined {
        if (!initCode || initCode === '0x' || initCode.length < 42) {
            return undefined;
        }
        // First 20 bytes (40 hex chars + '0x' prefix)
        const factoryHex = initCode.slice(0, 42);
        return createAddressFromString(factoryHex);
    }

    /**
     * Parses paymaster address from paymasterAndData
     * paymasterAndData = paymaster (20 bytes) + verificationGasLimit (16 bytes) + postOpGasLimit (16 bytes) + data
     */
    private parsePaymaster(paymasterAndData: string): Address | undefined {
        if (!paymasterAndData || paymasterAndData === '0x' || paymasterAndData.length < 42) {
            return undefined;
        }
        // First 20 bytes
        const paymasterHex = paymasterAndData.slice(0, 42);
        return createAddressFromString(paymasterHex);
    }
}
