import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { SimulationEnvironment } from './simulation';
import { PackedUserOperation } from './types';

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
        // Optional: validate entryPoint and chainId matches?

        // Run Simulation
        const result = await this.simulationEnv.simulateValidation(userOp);

        if (!result.isValid) {
            // Transform violations into RPC error message if needed, 
            // but typical eth_validateUserOperation usually returns true or reverts?
            // "The result is boolean true if the UserOperation is valid, or an error if invalid."
            // But JSON-RPC convention: result=true if success. If fail, maybe return false or Throw Error?
            // EIP-4337 bundlers usually behave:
            // - If valid: result = true (or void?)
            // - If invalid: JSON-RPC Error object with code -32500 etc.

            // Let's throw an Error with details to return JSON-RPC Error
            const details = [
                ...result.errors,
                ...result.violations.map(v => `${v.message} (PC: ${v.pc})`)
            ].join('; ');

            throw new Error(`Validation Failed: ${details}`);
        }

        return true;
    }
}
