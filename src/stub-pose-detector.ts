/**
 * StubPoseDetector — returns realistic neutral pose detection results.
 *
 * This is a placeholder that enables the VideoProcessor's pose-only grading
 * path without real ML inference. Replace with a real implementation
 * (MediaPipe/TF.js) per issue #27.
 *
 * Returns a standing-neutral pose with 17 MoveNet keypoints centered in frame.
 */

import type { PoseDetector, PoseDetection } from "./video-processor.js";

/**
 * Generate a neutral standing pose centered in the frame.
 * Keypoint layout follows the MoveNet 17-keypoint topology.
 */
function neutralPose(width: number, height: number): PoseDetection {
    const cx = width / 2;
    const cy = height / 2;

    // Approximate proportions for a centered standing figure
    const keypoints = [
        { name: "nose", x: cx, y: cy - height * 0.35, confidence: 0.9 },
        { name: "left_eye", x: cx + 15, y: cy - height * 0.37, confidence: 0.85 },
        { name: "right_eye", x: cx - 15, y: cy - height * 0.37, confidence: 0.85 },
        { name: "left_ear", x: cx + 30, y: cy - height * 0.35, confidence: 0.7 },
        { name: "right_ear", x: cx - 30, y: cy - height * 0.35, confidence: 0.7 },
        { name: "left_shoulder", x: cx + 60, y: cy - height * 0.2, confidence: 0.9 },
        { name: "right_shoulder", x: cx - 60, y: cy - height * 0.2, confidence: 0.9 },
        { name: "left_elbow", x: cx + 80, y: cy - height * 0.05, confidence: 0.8 },
        { name: "right_elbow", x: cx - 80, y: cy - height * 0.05, confidence: 0.8 },
        { name: "left_wrist", x: cx + 70, y: cy + height * 0.05, confidence: 0.75 },
        { name: "right_wrist", x: cx - 70, y: cy + height * 0.05, confidence: 0.75 },
        { name: "left_hip", x: cx + 40, y: cy + height * 0.1, confidence: 0.9 },
        { name: "right_hip", x: cx - 40, y: cy + height * 0.1, confidence: 0.9 },
        { name: "left_knee", x: cx + 40, y: cy + height * 0.25, confidence: 0.85 },
        { name: "right_knee", x: cx - 40, y: cy + height * 0.25, confidence: 0.85 },
        { name: "left_ankle", x: cx + 40, y: cy + height * 0.38, confidence: 0.8 },
        { name: "right_ankle", x: cx - 40, y: cy + height * 0.38, confidence: 0.8 },
    ];

    return { keypoints, confidence: 0.85 };
}

export class StubPoseDetector implements PoseDetector {
    async detect(
        _imageData: Buffer,
        width: number,
        height: number,
    ): Promise<PoseDetection | null> {
        return neutralPose(width, height);
    }
}
