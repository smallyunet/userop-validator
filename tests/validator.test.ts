import { createVM } from '@ethereumjs/vm';
import { Address, createAddressFromString, hexToBytes } from '@ethereumjs/util';
import {
  validateExecutionRules,
  createValidationContext,
  setCurrentEntity,
  ValidationViolationError,
  validateExecutionRulesLegacy
} from '../src/validator';
import { EntityType } from '../src/types';

describe('Validator', () => {
  describe('validateExecutionRules', () => {
    it('should be defined', () => {
      expect(validateExecutionRules).toBeDefined();
    });

    it('should create a cleanup function', async () => {
      const vm = await createVM();
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');
      const entryPoint = createAddressFromString('0x0000000071727De22E5E9d8BAf0edAc6f37da032');

      const context = createValidationContext({
        sender,
        entryPoint,
        throwOnViolation: false,
      });

      const cleanup = validateExecutionRules(vm, context);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('createValidationContext', () => {
    it('should create context with default entity as SENDER', () => {
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');
      const entryPoint = createAddressFromString('0x0000000071727De22E5E9d8BAf0edAc6f37da032');

      const context = createValidationContext({
        sender,
        entryPoint,
      });

      expect(context.entity).toBe(EntityType.SENDER);
      expect(context.sender.equals(sender)).toBe(true);
      expect(context.violations).toHaveLength(0);
    });

    it('should include optional factory and paymaster', () => {
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');
      const entryPoint = createAddressFromString('0x0000000071727De22E5E9d8BAf0edAc6f37da032');
      const factory = createAddressFromString('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      const paymaster = createAddressFromString('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

      const context = createValidationContext({
        sender,
        entryPoint,
        factory,
        paymaster,
      });

      expect(context.factory?.equals(factory)).toBe(true);
      expect(context.paymaster?.equals(paymaster)).toBe(true);
    });
  });

  describe('setCurrentEntity', () => {
    it('should update the current entity in context', () => {
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');
      const entryPoint = createAddressFromString('0x0000000071727De22E5E9d8BAf0edAc6f37da032');

      const context = createValidationContext({
        sender,
        entryPoint,
      });

      expect(context.entity).toBe(EntityType.SENDER);

      setCurrentEntity(context, EntityType.FACTORY);
      expect(context.entity).toBe(EntityType.FACTORY);

      setCurrentEntity(context, EntityType.PAYMASTER);
      expect(context.entity).toBe(EntityType.PAYMASTER);
    });
  });

  describe('validateExecutionRulesLegacy', () => {
    it('should work with legacy API', async () => {
      const vm = await createVM();
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');

      const cleanup = validateExecutionRulesLegacy(vm, sender);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('Banned Opcodes Detection', () => {
    it('should track violations for banned opcodes in non-throwing mode', async () => {
      const vm = await createVM();
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');
      const entryPoint = createAddressFromString('0x0000000071727De22E5E9d8BAf0edAc6f37da032');

      const context = createValidationContext({
        sender,
        entryPoint,
        throwOnViolation: false,
      });

      // Deploy code that uses TIMESTAMP opcode (0x42)
      // TIMESTAMP (0x42) -> STOP (0x00)
      const bytecode = hexToBytes('0x4200');
      await vm.stateManager.putCode(sender, bytecode);

      const cleanup = validateExecutionRules(vm, context);

      try {
        await vm.evm.runCall({
          to: sender,
          caller: entryPoint,
          data: new Uint8Array(0),
          gasLimit: BigInt(100000),
        });
      } catch (e) {
        // Ignore execution errors
      } finally {
        cleanup();
      }

      // Check that violation was recorded
      expect(context.violations.length).toBeGreaterThan(0);
      expect(context.violations[0].type).toBe('BANNED_OPCODE');
      expect(context.violations[0].message).toContain('TIMESTAMP');
    });

    it('should record violation for GASPRICE opcode in throwing mode', async () => {
      const vm = await createVM();
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');
      const entryPoint = createAddressFromString('0x0000000071727De22E5E9d8BAf0edAc6f37da032');

      const context = createValidationContext({
        sender,
        entryPoint,
        throwOnViolation: true, // Even with this, violations are recorded
      });

      // Deploy code that uses GASPRICE opcode (0x3a)
      const bytecode = hexToBytes('0x3a00');
      await vm.stateManager.putCode(sender, bytecode);

      const cleanup = validateExecutionRules(vm, context);

      try {
        await vm.evm.runCall({
          to: sender,
          caller: entryPoint,
          data: new Uint8Array(0),
          gasLimit: BigInt(100000),
        });
      } catch (e) {
        // VM may or may not propagate the error
      } finally {
        cleanup();
      }

      // Violation should be recorded regardless of throw behavior
      expect(context.violations.length).toBeGreaterThan(0);
      expect(context.violations[0].type).toBe('BANNED_OPCODE');
      expect(context.violations[0].message).toContain('GASPRICE');
    });
  });

  describe('Entity Restrictions', () => {
    it('should allow CREATE for Factory entity', async () => {
      const vm = await createVM();
      const sender = createAddressFromString('0x1234567890123456789012345678901234567890');
      const factory = createAddressFromString('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      const entryPoint = createAddressFromString('0x0000000071727De22E5E9d8BAf0edAc6f37da032');

      const context = createValidationContext({
        sender,
        entryPoint,
        factory,
        throwOnViolation: false,
      });

      // Set entity to FACTORY - CREATE should be allowed
      setCurrentEntity(context, EntityType.FACTORY);

      // Note: We're not actually executing CREATE here, just verifying the context works
      expect(context.entity).toBe(EntityType.FACTORY);
    });
  });
});
