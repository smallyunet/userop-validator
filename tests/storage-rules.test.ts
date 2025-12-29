import { validateStorageRules } from '../src/storage-rules';
import { EntityType } from '../src/types';
import { createAddressFromString } from '@ethereumjs/util';

describe('Storage Rules Validation', () => {
    const sender = createAddressFromString('0x1111111111111111111111111111111111111111');
    const factory = createAddressFromString('0x2222222222222222222222222222222222222222');
    const paymaster = createAddressFromString('0x3333333333333333333333333333333333333333');
    const entryPoint = createAddressFromString('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789');
    const randomContract = createAddressFromString('0x9999999999999999999999999999999999999999');

    const slot = '0x0000000000000000000000000000000000000000000000000000000000000000';

    it('should allow Sender to access its own storage', () => {
        const result = validateStorageRules(EntityType.SENDER, sender, sender, slot);
        expect(result.allowed).toBe(true);
    });

    it('should NOT allow Sender to access random contract storage', () => {
        const result = validateStorageRules(EntityType.SENDER, sender, randomContract, slot);
        expect(result.allowed).toBe(false);
    });

    it('should allow Factory to access its own storage', () => {
        const result = validateStorageRules(EntityType.FACTORY, sender, factory, slot, factory);
        expect(result.allowed).toBe(true);
    });

    it('should allow Factory to access Sender storage (deployment)', () => {
        const result = validateStorageRules(EntityType.FACTORY, sender, sender, slot, factory);
        expect(result.allowed).toBe(true);
    });

    it('should NOT allow Factory to access Paymaster storage', () => {
        const result = validateStorageRules(EntityType.FACTORY, sender, paymaster, slot, factory, paymaster);
        expect(result.allowed).toBe(false);
    });

    it('should allow Paymaster to access its own storage', () => {
        const result = validateStorageRules(EntityType.PAYMASTER, sender, paymaster, slot, factory, paymaster);
        expect(result.allowed).toBe(true);
    });

    it('should NOT allow Paymaster to access Sender storage', () => {
        const result = validateStorageRules(EntityType.PAYMASTER, sender, sender, slot, factory, paymaster);
        expect(result.allowed).toBe(false);
    });

    it('should allow EntryPoint entity to access anything (internal logic)', () => {
        const result = validateStorageRules(EntityType.ENTRYPOINT, sender, randomContract, slot);
        expect(result.allowed).toBe(true);
    });
});
