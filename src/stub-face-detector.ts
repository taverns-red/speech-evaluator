/**
 * StubFaceDetector — returns realistic neutral face detection results.
 *
 * This is a placeholder that enables the VideoProcessor's face-dependent
 * grading path without real ML inference. Replace with a real implementation
 * (MediaPipe/TF.js) per issue #27.
 *
 * Returns a centered face with 6 BlazeFace landmarks in neutral orientation.
 */

import type { FaceDetector, FaceDetection } from "./video-processor.js";

/**
 * Generate a neutral forward-facing face centered in the frame.
 * Landmark layout follows BlazeFace 6-landmark topology:
 * [0] right eye, [1] left eye, [2] nose, [3] mouth, [4] right ear, [5] left ear
 */
function neutralFace(width: number, height: number): FaceDetection {
    const cx = width / 2;
    const cy = height * 0.3; // Face in upper third of frame

    const faceW = width * 0.2;
    const faceH = height * 0.25;

    const landmarks = [
        [cx - faceW * 0.15, cy - faceH * 0.1],  // right eye
        [cx + faceW * 0.15, cy - faceH * 0.1],  // left eye
        [cx, cy],                  // nose
        [cx, cy + faceH * 0.2],   // mouth
        [cx - faceW * 0.4, cy],                  // right ear
        [cx + faceW * 0.4, cy],                  // left ear
    ];

    return {
        landmarks,
        boundingBox: {
            x: cx - faceW / 2,
            y: cy - faceH / 2,
            width: faceW,
            height: faceH,
        },
        confidence: 0.92,
    };
}

export class StubFaceDetector implements FaceDetector {
    async detect(
        _imageData: Buffer,
        width: number,
        height: number,
    ): Promise<FaceDetection | null> {
        return neutralFace(width, height);
    }
}
