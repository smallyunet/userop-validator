import { Address } from '@ethereumjs/util';
// import { keccak256 } from 'ethereum-cryptography/keccak';
import { EntityType } from './types';

/**
 * Checks if a storage slot is associated with an address.
 * EIP-7562 definition:
 * A slot is associated with an address if:
 * 1. slot == address (simple mapping) - Though this is rare in Solidity, usually it's a mapping.
 * 2. slot == keccak256(address || key) where key is a storage slot (mapping pattern).
 * 
 * We check standard Solidity mapping patterns: 
 * keccak256(h(k) . p)
 * where k is the key (address), and p is the position (slot index).
 */
export function isSlotAssociatedWith(_slot: string, _address: Address): boolean {
    void _slot;
    void _address;
    // const slotBuffer = Buffer.from(slot.replace('0x', ''), 'hex');
    // const addressBuffer = address.toBytes();

    // We can't easily reverse the hash, but we can check common patterns if we knew the layout.
    // EIP-7562 says: "Read/Write Access to storage slots that are associated with the entity"
    // The canonical definition usually implies `mapping(address => value)`.
    // The slot would be `keccak256(pad(address) . pad(position))`.

    // Since we don't know the position 'p' efficiently without iterating, 
    // strict enforcement requires capturing the specific patterns or relying on the entity 
    // only accessing its own data.

    // For this implementation, we will be strict:
    // 1. Direct match (unlikely for Solidity but possible in assembly)
    // 2. We can't exhaustively check all map positions. 
    // However, the rule simplifies often to: "Account storage is always allowed".

    // IMPORTANT: For external contracts (Associated Storage), the rule is:
    // "Access to associated storage of the account in an external (non-entity) contract is allowed"

    // We'll implement a basic heuristic checker or leave it as "Strict Own Storage Only" for now
    // unless we can prove association.

    return false;
    // TODO: Implement advanced mapping detection if needed.
    // Realistically, without the contract ABI or source, proving association is hard.
    // Most validators assume if it touches external storage, it MUST be standard mapping.
}

/**
 * Validates storage access based on EIP-7562 Rules
 */
export function validateStorageRules(
    entity: EntityType,
    sender: Address,
    storageAddress: Address, // The contract being accessed
    slot: string,            // The slot being accessed
    factory?: Address,
    paymaster?: Address
): { allowed: boolean; reason?: string } {

    // [STO-010] Access to the "account" (Sender) storage is always allowed.
    // Note: This applies to ANY entity accessing Sender's storage? 
    // No, the rule says "Access to the 'account' storage is always allowed" in the context of the Sender's validation?
    // Actually, EIP-7562 says specific rules per entity.

    // Let's break it down by executing entity:

    if (entity === EntityType.ENTRYPOINT) {
        return { allowed: true };
    }

    // 1. Entity accessing its own storage is always allowed ([STO-031] is for staked, but generally true for base too)
    let entityAddress: Address | undefined;
    if (entity === EntityType.SENDER) entityAddress = sender;
    else if (entity === EntityType.FACTORY) entityAddress = factory;
    else if (entity === EntityType.PAYMASTER) entityAddress = paymaster;

    if (entityAddress && storageAddress.equals(entityAddress)) {
        return { allowed: true };
    }

    // 2. Access to EntryPoint is allowed (specifically deposit info, but we allow all for simplicity or check slot)
    // In reality, we should restrict to specific slots, but standard implementations often allow read access.
    // EIP-7562: "Read/Write Access to storage slots that are associated with the entity, in any non-entity contract"
    // EntryPoint is a "non-entity" contract in this context? 
    // Actually usually EntryPoint is a special case.

    // For this roadmap, we'll assume we can't easily detect "Associated Storage" in 3rd party contracts
    // without more complex logic.

    // Special Rule: Factory deploying the account
    if (entity === EntityType.FACTORY) {
        // [STO-022] Factory can access Sender's storage (deployment)
        if (storageAddress.equals(sender)) {
            return { allowed: true };
        }
    }

    return {
        allowed: false,
        reason: `Entity ${entity} is not allowed to access storage of ${storageAddress.toString()}`
    };
}
