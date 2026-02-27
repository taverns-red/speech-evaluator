/**
 * TfjsPoseDetector — real pose estimation using MoveNet Lightning via TF.js WASM backend.
 *
 * Implements the PoseDetector interface. Returns 17 MoveNet keypoints
 * (nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles).
 *
 * Usage:
 *   const detector = new TfjsPoseDetector();
 *   await detector.init();
 *   const result = await detector.detect(jpegBuffer, width, height);
 */

import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import sharp from "sharp";
import type { PoseDetector, PoseDetection } from "./video-processor.js";

export class TfjsPoseDetector implements PoseDetector {
    private detector: poseDetection.PoseDetector | null = null;

    /**
     * Create the MoveNet Lightning detector. Must be called once before detect().
     * Throws if model fails to load.
     */
    async init(): Promise<void> {
        this.detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            },
        );
    }

    /**
     * Estimate pose in a JPEG buffer.
     * Returns the highest-confidence pose, or null if none detected.
     */
    async detect(
        imageData: Buffer,
        _width: number,
        _height: number,
    ): Promise<PoseDetection | null> {
        if (!this.detector) {
            throw new Error("TfjsPoseDetector not initialized — call init() first");
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
            const poses = await this.detector.estimatePoses(tensor);

            if (poses.length === 0) {
                return null;
            }

            const pose = poses[0];

            // Map MoveNet keypoints to our PoseDetection interface
            const keypoints = pose.keypoints.map((kp) => ({
                name: kp.name ?? "unknown",
                x: kp.x,
                y: kp.y,
                confidence: kp.score ?? 0,
            }));

            return {
                keypoints,
                confidence: pose.score ?? 0,
            };
        } finally {
            tensor.dispose();
        }
    }

    /** Release model resources. */
    dispose(): void {
        if (this.detector) {
            this.detector.dispose();
            this.detector = null;
        }
    }
}
