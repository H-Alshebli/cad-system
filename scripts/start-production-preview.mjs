import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { parseEnv } from "node:util";

const envFile = ".env.production-preview.local";

if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}. Copy .env.production-preview.example to ${envFile} and add the production Firebase values.`);
  process.exit(1);
}

const fileEnvironment = parseEnv(readFileSync(envFile, "utf8"));
const nextBin = "node_modules/next/dist/bin/next";
const child = spawn(process.execPath, [nextBin, "dev", "-p", "3001"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...fileEnvironment,
    NEXT_PUBLIC_HCAD_ENV: "production",
    NEXT_PUBLIC_HCAD_PRODUCTION_PREVIEW: "true",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
