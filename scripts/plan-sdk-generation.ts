#!/usr/bin/env bun
import { runSdkGenerationPlanCli } from '../src/sdk-generation-plan/cli';

const exitCode = await runSdkGenerationPlanCli(process.argv.slice(2));
process.exit(exitCode);
