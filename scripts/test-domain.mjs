import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".test-state",{recursive:true});
await build({entryPoints:["tests/domain.test.ts"],bundle:true,platform:"node",format:"esm",outfile:".test-state/domain-test.mjs"});
const result=spawnSync(process.execPath,["--test",".test-state/domain-test.mjs"],{stdio:"inherit"});
process.exitCode=result.status??1;
