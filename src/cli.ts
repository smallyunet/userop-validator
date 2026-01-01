#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { validateUserOpStructure } from './static-checks';
import { SimulationEnvironment } from './simulation';
import { PackedUserOperation } from './types';

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: userop-validator <path-to-userop.json> [--rpc <rpc-url>]');
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), args[0]);

    // Parse Optional RPC argument
    let rpcUrl: string | undefined;
    const rpcIndex = args.indexOf('--rpc');
    if (rpcIndex !== -1 && rpcIndex + 1 < args.length) {
        rpcUrl = args[rpcIndex + 1];
    }

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

        // 2. Simulation
        const runSimulation = args.includes('--simulate');
        if (runSimulation) {
            console.log('Starting Simulation...');
            if (rpcUrl) {
                console.log(`Using RPC connection: ${rpcUrl}`);
            }
            const env = new SimulationEnvironment({ rpcUrl });
            await env.init();

            // We assume userOp is valid PackedUserOperation since static checks passed
            const result = await env.simulateValidation(userOp as PackedUserOperation);

            if (result.isValid) {
                console.log('Simulation Passed ✅');
            } else {
                console.error('Simulation Failed ❌');
                result.errors.forEach(err => console.error(`[Error] ${err}`));
                result.violations.forEach(v => console.error(`[Violation] ${v.message} at PC ${v.pc}`));
                process.exit(1);
            }
        }

        // 2. Simulation (TODO: Need to set up VM and State)
        // For CLI, we might mock the simulation or need a separate command to initialize VM state.
        // Currently roadmap says "CLI Tool: Validate UserOp JSON file".
        // We'll wire up simulation if possible, but initializing a VM state from scratch/fork is complex.
        // For now, static checks + basic structure is a good start.

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error processing file: ${message}`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
