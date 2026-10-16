# MAKE HOP! artwork, version 2

Generated with the built-in ImageGen tool on October 16, 2026. The existing hop atlas was a character/style reference. The PNG outputs are preserved byte-for-byte with genuine alpha transparency; only frame-coordinate metadata is derived from their alpha bounds.

- [Croak animation](croak-v2.png): sixteen bracing, inhaling, roaring, and recovery poses.
- [Desert objects](hazards-v2.png): four rock variants, four tumbleweed poses, four moth poses, four firefly poses.
- [Frame metadata](frames-v2.json): four-by-four cell bounds and SHA-256 hashes.
- Existing [character provenance](../../../previews/spadefoot-scenes/ARTWORK-v2.md) records the original atlases and owner-supplied character reference.

## Croak prompt

Use case: illustration-story. Asset type: a production 4-by-4 sprite atlas for a small 2D browser game, true transparent background.
Use the supplied toad sprite sheet only as a character and pixel-art style reference. Create a NEW sprite atlas with exactly sixteen sequential frames of this same tan-and-gold spadefoot toad facing right, in a heroic, comically overpowered croak animation. Keep the big golden eyes, mottled ochre skin, cream throat, squat body, and crisp shaded pixel-art appearance.
Composition: a strict 4 columns by 4 rows grid of equally sized invisible cells, read left-to-right and top-to-bottom. One complete isolated toad per cell, consistently sized, feet registered to the same baseline inside every cell, generous transparent margins. All sixteen poses must be visibly distinct and temporally coherent. Frames 1-4: brace feet and inhale, throat inflating. Frames 5-8: enormous puffed throat, squint with determination, lean back slightly to wind up. Frames 9-12: explosive open-mouthed roar toward the right, body leans forward, front feet firmly planted. Frames 13-16: throat deflates, pleased mischievous expression, recover to original stance. Emphasize expressive silhouettes readable at 75 pixels tall.
No shockwaves, no particles, no text, no grid lines, no shadows or floor, no scenery, no laptop, no props, no additional characters. Preserve actual alpha transparency. Do not reproduce the jumping poses in the reference; the new motion is bracing, inhaling, and roaring.

## Desert-object prompt

Use case: illustration-story. Asset type: a production 4-by-4 sprite atlas of desert objects for a charming 2D browser game, true transparent background.
Use the supplied toad sprite sheet only as a style reference: crisp, richly shaded, warm 16-bit pixel art with bold readable silhouettes and dark contour pixels. Do not include any toads.
Composition: exactly sixteen isolated objects in a strict 4 columns by 4 rows grid of equally sized invisible cells. One complete object per cell, centered, generous transparent margins, no overlap. Row 1 contains four different angular desert rock formations, magenta-purple stone with coral highlights, varying squat silhouettes. Row 2 contains four consecutive rolling poses of the SAME round golden-brown tumbleweed, intricate but legible twig loops, different rotational orientations, equal diameter. Row 3 contains four consecutive wing-flap poses of the SAME large purple desert moth, side view facing left, thick antennae and cream/coral wing markings, clearly a moth not a bird; equal body size across frames. Row 4 contains four consecutive wing-flap poses of the SAME tiny luminous gold firefly, side view, warm yellow luminous abdomen with pale mint wings, readable and cute. Maintain consistent object scale within each row. All objects are for a game and must remain recognizable at 30-60 pixels tall.
No background, floor, cast shadows, grid lines, text, labels, UI, toads, humanoids, or scenery. True alpha transparency, not a painted checkerboard.

