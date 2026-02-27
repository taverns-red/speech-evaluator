/**
 * TF.js WASM Backend Setup — initializes the TensorFlow.js WASM backend for Node.js.
 *
 * Must be imported BEFORE any TF.js model loading or inference.
 * Uses the WASM backend instead of @tensorflow/tfjs-node because
 * the native bindings are incompatible with Node.js v25+ (removed util.isNullOrUndefined).
 *
 * @module
 */

import "@tensorflow/tfjs-backend-wasm";
import * as tf from "@tensorflow/tfjs";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let initialized = false;

/**
 * Initialize the TF.js WASM backend. Safe to call multiple times — only runs once.
 */
export async function initTfjsWasm(): Promise<void> {
    if (initialized) return;

    // Point WASM loader at the installed package
    const wasmDir = join(
        dirname(fileURLToPath(import.meta.url)),
        "../node_modules/@tensorflow/tfjs-backend-wasm/dist/",
    );
    setWasmPaths(wasmDir);

    await tf.setBackend("wasm");
    await tf.ready();

    initialized = true;
}
