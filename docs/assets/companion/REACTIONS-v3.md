# Companion reactions, version 3

Generated with the built-in ImageGen tool on October 16, 2026. The existing hop atlas was a character and style reference. The three new sixteen-pose sequences replace the earlier transform-based hover/tap reactions. Original PNG bytes and genuine alpha transparency are preserved; only frame metadata is derived.

- [Curious head turn](curious-v3.png): hover; turns toward the viewer, blinks, and settles.
- [Startled hop](startle-v3.png): first tap; crouch, push-off, tuck, landing, and recovery.
- [Indignant throat puff](puff-v3.png): second tap; breath, expanding throat, small croak, and recovery.
- [Frame metadata](reactions-v3.json), reproduced by `scripts/build-reaction-frames.py` with Pillow.
- [Original character provenance](../../../previews/spadefoot-scenes/ARTWORK-v2.md).

## curious prompt

Use case: illustration-story.
Asset type: production 4-by-4 transparent sprite animation atlas for a small website mascot.
Input image: character and pixel-art STYLE REFERENCE ONLY. Make a NEW atlas.
Subject: the SAME adorable squat tan-and-gold spadefoot toad, golden eyes, mottled ochre skin, cream throat, short legs, dark crisp contour pixels. Match the reference's body proportions, rich warm shaded pixel art, and three-quarter view facing right.
Composition: exactly sixteen complete isolated toads, one per equally sized invisible cell, strict 4 columns by 4 rows, read left-to-right then top-to-bottom. Consistent character scale, generous transparent gutters, no clipping. Feet remain at the same cell baseline for grounded poses; use a stable camera throughout. Frame 1 and frame 16 return to the reference's normal upright resting pose. Make progressive hand-animated anatomical changes with clearly different eyes, mouth, head and limb shapes, NOT rotated copies of the same image. Legible at 100px character height.
Constraints: true alpha transparency. No text, speech bubbles, effect lines, props, floor, shadows, backgrounds, grid lines, borders, extra characters or duplicate limb anatomy.
Animation: a curious alert head turn when a visitor approaches. Frames 1-4: sitting quietly, upper eyelids lift and both eyes widen, shoulders rise slightly. Frames 5-8: head genuinely turns toward the viewer, snout changes silhouette, eyes track the viewer, front legs straighten and body leans forward inquisitively. Frames 9-12: hold a clearly front-facing curious peek, one quick natural blink then bright open eyes. Frames 13-16: head turns back to three-quarter right and forelegs relax into the starting posture. Make the head turn unmistakable while keeping the body grounded. No whole-body tilting or rotation.

## happy prompt

Use case: illustration-story.
Asset type: production 4-by-4 transparent sprite animation atlas for a small website mascot.
Input image: character and pixel-art STYLE REFERENCE ONLY. Make a NEW atlas.
Subject: the SAME adorable squat tan-and-gold spadefoot toad, golden eyes, mottled ochre skin, cream throat, short legs, dark crisp contour pixels. Match the reference's body proportions, rich warm shaded pixel art, and three-quarter view facing right.
Composition: exactly sixteen complete isolated toads, one per equally sized invisible cell, strict 4 columns by 4 rows, read left-to-right then top-to-bottom. Consistent character scale, generous transparent gutters, no clipping. Feet remain at the same cell baseline for grounded poses; use a stable camera throughout. Frame 1 and frame 16 return to the reference's normal upright resting pose. Make progressive hand-animated anatomical changes with clearly different eyes, mouth, head and limb shapes, NOT rotated copies of the same image. Legible at 100px character height.
Constraints: true alpha transparency. No text, speech bubbles, effect lines, props, floor, shadows, backgrounds, grid lines, borders, extra characters or duplicate limb anatomy.
Animation: a surprised tiny hop in response to a tap, then sheepish recovery. Frames 1-4: neutral, suddenly huge startled eyes, front toes spread, mouth makes a tiny surprised O, hind legs crouch deeply. Frames 5-8: hind legs extend to push off, forelegs lift and spread, body springs upward with a startled expression. Frames 9-12: compact airborne tuck then feet reaching down, soft landing squash with bent limbs. Frames 13-16: blink, close the mouth into a small pleased smile, return to the normal upright resting pose. Show actual newly drawn leg poses and body squash/stretch; do not simulate the hop by rotating an unchanged toad. The floating poses may rise a little inside their cells, but keep the full body within the cell.

## croak prompt

Use case: illustration-story.
Asset type: production 4-by-4 transparent sprite animation atlas for a small website mascot.
Input image: character and pixel-art STYLE REFERENCE ONLY. Make a NEW atlas.
Subject: the SAME adorable squat tan-and-gold spadefoot toad, golden eyes, mottled ochre skin, cream throat, short legs, dark crisp contour pixels. Match the reference's body proportions, rich warm shaded pixel art, and three-quarter view facing right.
Composition: exactly sixteen complete isolated toads, one per equally sized invisible cell, strict 4 columns by 4 rows, read left-to-right then top-to-bottom. Consistent character scale, generous transparent gutters, no clipping. Feet remain at the same cell baseline for grounded poses; use a stable camera throughout. Frame 1 and frame 16 return to the reference's normal upright resting pose. Make progressive hand-animated anatomical changes with clearly different eyes, mouth, head and limb shapes, NOT rotated copies of the same image. Legible at 100px character height.
Constraints: true alpha transparency. No text, speech bubbles, effect lines, props, floor, shadows, backgrounds, grid lines, borders, extra characters or duplicate limb anatomy.
Animation: an indignant comedic throat puff after a second tap, then a small silent croak and recovery. Frames 1-4: neutral sitting posture, draws a breath, narrows eyes in mock indignation, braces forefeet wide. Frames 5-8: cream throat sac expands dramatically into a rounded pearly balloon below the jaw; cheeks become puffy, body remains grounded, back stays mottled tan. Frames 9-12: hold the enormously inflated throat with determined eyes, then open the mouth for a tiny assertive croak and visibly deflate. Frames 13-16: throat returns to normal, expression becomes a satisfied mischievous smile, feet ease back into normal resting posture. Actual throat anatomy and expression change in every pose; no scaling or tilting copies. No sonic waves or text.

