# Lessons Learned

## 2026-02-25: Initial Project Evaluation

1. **Monolithic frontend is a maintenance risk**: The 3887-line `index.html` with inline CSS (~1060 lines) and JS (~2500 lines) makes it hard to reason about styling vs behavior. Extracting CSS into a separate file is the first step toward maintainability.

2. **Type contracts must match client code**: The `video_stream_ready` message type requires `width` and `height` fields, but the client never sends them. The server ignores them, so no runtime crash, but this is a protocol violation that could bite future developers who trust the type definition.

3. **Property-based testing is highly effective**: 1506 tests across 43 files with extensive fast-check property tests caught edge cases in video processing (frame gaps, resolution changes, temporal integrity) that unit tests alone would miss.

4. **Always check footer/version indicators**: The footer said "Phase 2" despite Phase 4 being fully implemented. These cosmetic details erode user confidence.
