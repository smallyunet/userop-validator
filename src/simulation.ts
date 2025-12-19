import { VM, createVM } from '@ethereumjs/vm';
import { createAddressFromString } from '@ethereumjs/util';

/**
 * Manages the simulation environment for UserOperation validation.
 * Maintains a persistent VM instance and handles mock deployments.
 */
export class SimulationEnvironment {
    private vm: VM | null = null;

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
}

