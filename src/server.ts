import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { SimulationEnvironment } from './simulation';
import { PackedUserOperation, ValidationErrorCode, BatchValidationResult } from './types';

export interface ServerOptions {
    port: number;
    rpcUrl?: string; // Upstream RPC for state forking
    entryPointAddress?: string;
}

export class JsonRpcServer {
    private app: express.Express;
    private port: number;
    private simulationEnv: SimulationEnvironment;

    constructor(options: ServerOptions) {
        this.app = express();
        this.port = options.port;

        // Middleware
        this.app.use(cors());
        this.app.use(bodyParser.json());

        // Initialize Simulation Environment
        this.simulationEnv = new SimulationEnvironment({
            rpcUrl: options.rpcUrl,
            entryPointAddress: options.entryPointAddress
        });

        // Routes
        this.app.post('/', this.handleRequest.bind(this));
    }

    public async start(): Promise<void> {
        // Init VM
        await this.simulationEnv.init();

        this.app.listen(this.port, () => {
            console.log(`UserOp Validator JSON-RPC server listening on port ${this.port}`);
            if (this.simulationEnv['provider']) {
                console.log(`State Forking enabled via: ${this.simulationEnv['provider']['_getConnection']().url}`);
            }
        });
    }

    private async handleRequest(req: express.Request, res: express.Response) {
        const { jsonrpc, method, params, id } = req.body;

        if (jsonrpc !== '2.0' || !method) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32600, message: 'Invalid Request' },
                id: id || null
            });
        }

        try {
            let result: any;

            switch (method) {
                case 'eth_validateUserOperation':
                    result = await this.handleValidateUserOp(params);
                    break;
                case 'eth_validateUserOperations':
                    result = await this.handleValidateUserOps(params);
                    break;
                case 'eth_chainId': // Helpful for tools checking connection
                    result = '0x1'; // Default to Mainnet for now, or match upstream if possible
                    break;
                default:
                    return res.json({
                        jsonrpc: '2.0',
                        error: { code: -32601, message: 'Method not found' },
                        id
                    });
            }

            return res.json({
                jsonrpc: '2.0',
                result,
                id
            });

        } catch (error: any) {
            console.error('RPC Error:', error);
            return res.json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: error.message
                },
                id
            });
        }
    }

    private async handleValidateUserOp(params: any[]): Promise<boolean> {
        if (!params || params.length < 1) {
            throw new Error('Missing params: [userOp, entryPoint?, chainId?]');
        }

        const userOp = params[0] as PackedUserOperation;

        // Run Simulation
        const result = await this.simulationEnv.simulateValidation(userOp);

        if (!result.isValid) {
            // Map violations to EIP-4337 standardized error codes
            const errorCode = this.mapViolationsToErrorCode(result);
            const details = [
                ...result.errors,
                ...result.violations.map(v => `${v.message} (PC: ${v.pc})`)
            ].join('; ');

            const error = new Error(`Validation Failed: ${details}`) as any;
            error.code = errorCode;
            throw error;
        }

        return true;
    }

    /**
     * Handle batch validation of multiple UserOperations
     * Returns array of results for each UserOp
     */
    private async handleValidateUserOps(params: any[]): Promise<BatchValidationResult[]> {
        if (!params || params.length < 1 || !Array.isArray(params[0])) {
            throw new Error('Missing params: [[userOp1, userOp2, ...], entryPoint?, chainId?]');
        }

        const userOps = params[0] as PackedUserOperation[];
        const results: BatchValidationResult[] = [];

        for (let i = 0; i < userOps.length; i++) {
            const userOp = userOps[i];
            try {
                const result = await this.simulationEnv.simulateValidation(userOp);

                if (result.isValid) {
                    results.push({
                        index: i,
                        isValid: true
                    });
                } else {
                    const errorCode = this.mapViolationsToErrorCode(result);
                    const details = [
                        ...result.errors,
                        ...result.violations.map(v => `${v.message} (PC: ${v.pc})`)
                    ].join('; ');

                    results.push({
                        index: i,
                        isValid: false,
                        errorCode,
                        error: details
                    });
                }
            } catch (err: any) {
                results.push({
                    index: i,
                    isValid: false,
                    errorCode: ValidationErrorCode.REJECTED_BY_EP,
                    error: err.message || 'Unknown error'
                });
            }
        }

        return results;
    }

    /**
     * Map validation violations to standardized EIP-4337 error codes
     */
    private mapViolationsToErrorCode(result: { errors: string[]; violations: any[] }): ValidationErrorCode {
        // Check violations first for specific codes
        for (const v of result.violations) {
            if (v.type === 'BANNED_OPCODE') {
                return ValidationErrorCode.BANNED_OPCODE;
            }
            if (v.type === 'ILLEGAL_STORAGE_ACCESS') {
                return ValidationErrorCode.INVALID_STORAGE;
            }
        }

        // Check error messages for hints
        const errorText = result.errors.join(' ').toLowerCase();
        if (errorText.includes('paymaster')) {
            return ValidationErrorCode.REJECTED_BY_PAYMASTER;
        }
        if (errorText.includes('throttle')) {
            return ValidationErrorCode.ENTITY_THROTTLED;
        }
        if (errorText.includes('banned') || errorText.includes('ban')) {
            return ValidationErrorCode.ENTITY_BANNED;
        }
        if (errorText.includes('signature')) {
            return ValidationErrorCode.INVALID_SIGNATURE;
        }
        if (errorText.includes('nonce')) {
            return ValidationErrorCode.INVALID_NONCE;
        }

        // Default to EntryPoint rejection
        return ValidationErrorCode.REJECTED_BY_EP;
    }
}
