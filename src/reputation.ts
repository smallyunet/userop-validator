import { Address } from '@ethereumjs/util';

export enum ReputationStatus {
    OK = 0,
    THROTTLED = 1,
    BANNED = 2,
}

export interface ReputationEntry {
    address: string;
    opsSeen: number;
    opsFailed: number;
    lastSeenBlock: number; // For future usage with block numbers
    status: ReputationStatus;
}

export interface ReputationStore {
    /**
     * Check the status of an entity.
     * @param address The address of the entity (Paymaster or Factory)
     */
    getStatus(address: Address): ReputationStatus;

    /**
     * Update the reputation of an entity based on validation result.
     * @param address The address of the entity
     * @param success Whether the userOp validation was successful
     */
    updateStatus(address: Address, success: boolean): void;

    /**
     * Clear reputation for an address (useful for testing or manual unban)
     */
    clear(address: Address): void;

    /**
     * Get the full entry for debugging
     */
    getEntry(address: Address): ReputationEntry | undefined;
}

// Simple constants for this MVP
// If failed > seen * 0.1 (10% failure rate) and seen > 10, BAN?
// Or just simplified: MAX_FAILURES before BAN.
const MAX_FAILURES_ALLOWED = 5;
const THROTTLE_THRESHOLD = 2; // For testing purposes, low thresholds

export class InMemoryReputationStore implements ReputationStore {
    private store: Map<string, ReputationEntry> = new Map();

    getStatus(address: Address): ReputationStatus {
        const entry = this.store.get(address.toString());
        if (!entry) return ReputationStatus.OK;
        return entry.status;
    }

    updateStatus(address: Address, success: boolean): void {
        const key = address.toString();
        let entry = this.store.get(key);

        if (!entry) {
            entry = {
                address: key,
                opsSeen: 0,
                opsFailed: 0,
                lastSeenBlock: 0,
                status: ReputationStatus.OK,
            };
            this.store.set(key, entry);
        }

        entry.opsSeen++;
        if (!success) {
            entry.opsFailed++;
        }

        this.updateEntryStatus(entry);
    }

    private updateEntryStatus(entry: ReputationEntry): void {
        if (entry.opsFailed >= MAX_FAILURES_ALLOWED) {
            entry.status = ReputationStatus.BANNED;
        } else if (entry.opsFailed >= THROTTLE_THRESHOLD) {
            entry.status = ReputationStatus.THROTTLED;
        } else {
            entry.status = ReputationStatus.OK;
        }
    }

    clear(address: Address): void {
        this.store.delete(address.toString());
    }

    getEntry(address: Address): ReputationEntry | undefined {
        return this.store.get(address.toString());
    }
}
