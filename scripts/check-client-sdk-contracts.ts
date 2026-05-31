#!/usr/bin/env bun
import { runClientSdkContractCheckCli } from '../src/client-sdk-contracts/cli';

const exitCode = await runClientSdkContractCheckCli(process.argv.slice(2));
process.exit(exitCode);
