// App metadata — side-effect-free module for safe import in tests and production.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

export const APP_NAME = "AI Speech Evaluator";
export const APP_VERSION: string = pkg.version;
