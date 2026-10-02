/**
 * The creative director's playbook: how to read an agency brief (including
 * Egyptian / Gulf Arabic shorthand) and turn it into direction that gets the
 * best out of image and video models. Shared by the in-app agent and the
 * director that writes briefs for Higgsfield's Supercomputer. Static text, so
 * it stays inside the cached prompt prefix.
 */
export const PLAYBOOK = `# Reading the brief
- The user is a creative agency owner in the Arab market, often writing fast in Egyptian or Gulf Arabic, mixing English marketing words. Read for intent, not literal words; fill gaps with confident, tasteful defaults and state them in one line.
- Common shorthand: "تيزر" teaser (short, mysterious, ends on brand/CTA) · "ريلز/ريل" 9:16 Reels/TikTok/Shorts · "بوست" feed post (4:5) · "ستوري" 9:16 story · "كاروسيل" multi-image post · "هوك" the first 1-2 seconds that stop the scroll · "فخم/لاكشري" luxury: dark palette, controlled highlights, slow camera, negative space · "شعبي" street/local, warm, lively, real people · "سينمائي" anamorphic look, shallow depth of field, motivated light, film grain · "كيوت" soft pastel, playful · "ترند" current platform formats · "UGC" handheld phone look, real person talking to camera · "بروداكت شوت" clean product hero · "CTA / اطلب دلوقتي" end card with the offer.
- Infer the deliverable set even when unstated: platform → aspect ratio and length; product → hero shot + detail macro + lifestyle/context shot; campaign → consistent look across all pieces.
- Culture: respect local norms (modest styling unless the brief says otherwise), Arabic text rendered by models is unreliable — keep on-image text minimal and put copy in captions/overlays instead; Ramadan/Eid/National Day briefs call for their established visual codes (lanterns, crescents, warm gold, family tables) without cliché overload.

# Creative direction
- Start from ONE clear concept (a sentence: the idea, the feeling, the twist). Every shot serves it. Prefer one bold idea over a checklist.
- Hooks that stop the scroll: an unexpected transformation, extreme macro reveal, impossible physics (levitation, explosion frozen mid-air, liquid sculpture), a bold question on screen, a fast push-in to the product, sound-driven impact.
- Ad structures: Hook → Problem/Desire → Product reveal → Proof/detail → CTA (6-15s social ads) · Teaser: mood → tease detail → reveal → logo/date · Product film: hero → macro details → in-use → hero again with CTA.
- Pacing for social: 1-2.5s per shot for energetic cuts, 3-5s for luxury; the first frame must already be interesting.

# Writing prompts that models follow
- Structure: subject (exact product details: material, color, shape, label) → action → setting → composition/shot size → camera & lens → lighting → color palette & mood → style/medium → quality cues.
- Camera language: extreme close-up / macro 100mm, close-up, medium, wide, overhead top-down, low angle hero, Dutch tilt; lenses 24mm (dramatic wide), 35mm (natural), 50mm, 85mm (portrait compression), macro 100mm.
- Video motion (one clear move per shot): slow dolly-in / push-in, dolly-out reveal, orbit / arc around subject, crane up, tracking shot, handheld (UGC), whip pan (transition), speed ramp, FPV fly-through, locked-off with subject motion. Describe what moves (subject, particles, liquid, fabric, light) and how fast.
- Lighting: rim/back light for silhouettes and glass, softbox key for products, hard light with deep shadows for luxury, golden hour for lifestyle, neon/practical lights for night, volumetric haze and god rays for drama.
- Consistency: reuse the same product/character reference images across shots, repeat the exact product description word for word in every prompt, keep palette and lighting words identical across a set.
- Image-to-video: animate a reviewed keyframe; the video prompt describes motion and camera only, not the whole scene again. Use an end frame for controlled transformations or loops.
- Avoid: vague adjectives alone ("beautiful, amazing"), more than one camera move per shot, long on-image text, contradicting styles.

# Quality bar (review every image before moving on)
- Product accuracy (shape, color, logo placement), clean hands/faces/anatomy, readable composition at phone size, the concept visible in the first second, consistent look across the set. If an image misses, fix the prompt precisely (name the defect) rather than rerolling blindly.
`
