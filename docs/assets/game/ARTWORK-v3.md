# MAKE HOP! ground gait and atlas repair, version 3

Generated with the built-in ImageGen tool on October 16, 2026. [walk-v3.png](walk-v3.png) is a new sixteen-pose ground-scuttling cycle using the existing hop atlas as a character/style reference. The PNG is preserved byte-for-byte with true alpha transparency.

[frames-v3.json](frames-v3.json) contains the new walking poses and corrected source rectangles for the unchanged croak-v2.png and hazards-v2.png. The previous equally divided grid cut through the bottoms of rocks and moths; fragments from those sprites appeared in the next row. The updated `scripts/build-game-frames.py` locates the sixteen main alpha-connected objects across the entire atlas before assigning their grid order. Thus it captures whole sprites and leaves neighboring fragments out without repainting or editing the source PNGs. The older metadata remains preserved for provenance.

[Version 2 artwork and prompts](ARTWORK.md) document the unchanged croak and hazard images.

## Ground-scuttling prompt

Use case: illustration-story.
Asset type: a production 4-by-4 transparent sprite atlas of a continuous ground-running animation for a small 2D browser game.
Reference image role: character identity and pixel-art style ONLY. Create a NEW animation atlas.
Subject: the same tan-and-gold spadefoot toad, big golden eyes, mottled ochre skin, cream throat, squat compact body, sturdy hind legs, short front legs, crisp dark outline and richly shaded pixel art. Right-facing three-quarter view, same camera, same proportions throughout.
Action: a charming, energetic SCUTTLING RUN along the ground. The legs must visibly articulate through alternating strides, NOT a stationary bobbing pose. Keep the belly low, front and rear legs bend and extend in alternating pairs, visible forefeet reaching forward then planting and sweeping backward, hind thighs pushing off and feet recovering beneath the body. The head stays upright with a focused cheerful expression. The whole character remains grounded; no long airborne jumps.
Composition: exactly sixteen frames in a strict 4 columns by 4 rows invisible grid, one complete isolated character per cell, read left-to-right and top-to-bottom. A single seamless complete gait cycle across all sixteen frames. Frame 16 flows back into frame 1. Frames 1-4 one forward foot contact and rear push, 5-8 passing and recovery with opposite feet reaching, 9-12 opposite foot contact and rear push, 13-16 passing and recovery back to the starting stride. Small natural body compression is welcome, but each phase must be legibly different. At least one foot contacts the same baseline in every frame. Stable body scale and center, camera fixed, all toes in frame, generous transparent gutters on all four sides of each cell. The atlas is used at about 70px character height, so the changing foot silhouettes must read clearly.
Constraints: true alpha transparency. No text, grid lines, floor, background, shadows, effect trails, props or extra characters. Do not rotate or translate one unchanged sprite. No hopping flight sequence, no throat puff, no mouth-open croak. Keep exactly four limbs with anatomically consistent toes. Preserve the reference character identity.

