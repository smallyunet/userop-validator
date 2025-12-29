#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { validateUserOpStructure } from './static-checks';
import { PackedUserOperation } from './types';

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: userop-validator <path-to-userop.json>');
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), args[0]);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const userOp = JSON.parse(fileContent);

        console.log(`Validating UserUserOp from: ${filePath}`);

        // 1. Static Checks
        const staticResult = validateUserOpStructure(userOp);
        if (!staticResult.isValid) {
            console.error('Static Validation Failed:');
            staticResult.errors.forEach(err => console.error(`- ${err}`));
            process.exit(1);
        } else {
            console.log('Static Validation Passed ✅');
        }

        // 2. Simulation (TODO: Need to set up VM and State)
        // For CLI, we might mock the simulation or need a separate command to initialize VM state.
        // Currently roadmap says "CLI Tool: Validate UserOp JSON file".
        // We'll wire up simulation if possible, but initializing a VM state from scratch/fork is complex.
        // For now, static checks + basic structure is a good start.

    } catch (err: any) {
        console.error(`Error processing file: ${err.message}`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
