import { SimulationEnvironment } from '../src/simulation';
import { createAddressFromString } from '@ethereumjs/util';

describe('SimulationEnvironment', () => {
    let simEnv: SimulationEnvironment;

    beforeEach(() => {
        simEnv = new SimulationEnvironment();
    });

    it('should initialize VM successfully', async () => {
        await simEnv.init();
        expect(simEnv.getVM()).toBeDefined();
    });

    it('should throw if getting VM before init', () => {
        expect(() => simEnv.getVM()).toThrow('SimulationEnvironment not initialized');
    });

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
});
