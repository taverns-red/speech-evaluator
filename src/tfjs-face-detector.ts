/**
 * TfjsFaceDetector — real face detection using BlazeFace via TF.js WASM backend.
 *
 * Implements the FaceDetector interface. Returns 6 BlazeFace landmarks
 * (right eye, left eye, nose, mouth, right ear, left ear) plus bounding box.
 *
 * Usage:
 *   const detector = new TfjsFaceDetector();
 *   await detector.init();
 *   const result = await detector.detect(jpegBuffer, width, height);
 */

import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import sharp from "sharp";
import type { FaceDetector, FaceDetection } from "./video-processor.js";

export class TfjsFaceDetector implements FaceDetector {
    private model: blazeface.BlazeFaceModel | null = null;

    /**
     * Load the BlazeFace model. Must be called once before detect().
     * Throws if model fails to load.
     */
    async init(): Promise<void> {
        this.model = await blazeface.load();
    }

    /**
     * Detect a face in a JPEG buffer.
     * Returns the highest-confidence face, or null if none detected.
     */
    async detect(
        imageData: Buffer,
        _width: number,
        _height: number,
    ): Promise<FaceDetection | null> {
        if (!this.model) {
            throw new Error("TfjsFaceDetector not initialized — call init() first");
        }

        // Decode JPEG → raw RGB pixels via sharp
        const { data, info } = await sharp(imageData)
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Create tensor from raw pixel data
        const tensor = tf.tensor3d(
            new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
            [info.height, info.width, info.channels],
            "int32",
        );

        try {
            const predictions = await this.model.estimateFaces(tensor, false);

            if (predictions.length === 0) {
                return null;
            }

            // Take highest-confidence prediction
            const pred = predictions[0];
            const probability = Array.isArray((pred as any).probability)
                ? (pred as any).probability[0]
                : (pred as any).probability ?? 0;

            // BlazeFace returns topLeft [x, y] and bottomRight [x, y]
            const topLeft = pred.topLeft as number[];
            const bottomRight = pred.bottomRight as number[];

            // BlazeFace returns 6 landmarks: right eye, left eye, nose, mouth, right ear, left ear
            const landmarks = (pred.landmarks as number[][]) ?? [];

            return {
                landmarks,
                boundingBox: {
                    x: topLeft[0],
                    y: topLeft[1],
                    width: bottomRight[0] - topLeft[0],
                    height: bottomRight[1] - topLeft[1],
                },
                confidence: probability,
            };
        } finally {
            tensor.dispose();
        }
    }
}
