import type { PlanDraft, PlanStepDraft } from "./plan-schema"

/** Keyword planner (no LLM): Arabic + English request shapes → a basic plan draft. */
const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" }
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  واحد: 1, واحدة: 1, اتنين: 2, اثنين: 2, تلات: 3, ثلاث: 3, ثلاثة: 3, تلاتة: 3, اربع: 4, أربع: 4, اربعة: 4, خمس: 5, خمسة: 5, ست: 6, ستة: 6,
}

const IMAGE_WORDS = /(صور|صورة|بوستر|بوسترات|تصميم|image|images|photo|poster|visual|thumbnail|keyframe)/i
const VIDEO_WORDS = /(فيديو|فديو|إعلان|اعلان|ريلز|ريل|لقط|مقطع|video|clip|reel|ad\b|commercial|shot|animation|animate|حرك)/i
const SCRIPT_WORDS = /(سكريبت|سكربت|كابشن|هوك|script|caption|hook|voice.?over|storyboard)/i

export function heuristicPlan(input: string, uploadCount: number): PlanDraft {
  const text = input.replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d)
  const arabic = /[؀-ۿ]/.test(text)
  const wantsVideo = VIDEO_WORDS.test(text)
  // "Animate this image" is a video request, not an image one.
  const wantsImage = IMAGE_WORDS.test(text) && !(wantsVideo && /حرك|animate/i.test(text))
  const wantsScript = SCRIPT_WORDS.test(text)

  if (!wantsVideo && !wantsImage) {
    return {
      reply: arabic
        ? "قولّي عايز تعمل إيه: صور، فيديو، ولا الاتنين؟ واكتب الموضوع والمقاس (مثلاً 9:16) وعدد اللقطات."
        : "Tell me what to make — images, video or both — with the subject, format (e.g. 9:16) and number of shots.",
      title: "",
      steps: [],
    }
  }

  const count = (pattern: RegExp): number | null => {
    const m = pattern.exec(text)
    if (!m) return null
    const raw = m[1]!.toLowerCase()
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? n : (WORD_NUMBERS[raw] ?? null)
  }
  const shots = Math.min(4, Math.max(1, count(/(\d+|\p{L}+)\s*(?:لقطات|لقطة|مشاهد|مشهد|shots?|scenes?)/iu) ?? 1))
  const images = Math.min(4, Math.max(1, count(/(\d+|\p{L}+)\s*(?:صور|صورة|بوستر|posters?|images?|photos?)/iu) ?? 1))
  const seconds = count(/(\d+)\s*(?:ثانية|ثواني|ثوان|sec|secs|seconds|s\b)/iu)
  const perShot = Math.min(15, Math.max(3, Math.round((seconds ?? 5 * shots) / shots)))

  // Aspect ratios: one next to an image word goes to the images, the rest to video.
  let imageAspect = ""
  let videoAspect = ""
  for (const m of text.matchAll(/(\d{1,2}):(\d{1,2})/g)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index)
    if (IMAGE_WORDS.test(before) && !imageAspect) imageAspect = m[0]
    else if (!videoAspect) videoAspect = m[0]
    else if (!imageAspect) imageAspect = m[0]
  }

  const subject = text.trim().replace(/\s+/g, " ").slice(0, 600)
  const steps: PlanStepDraft[] = []
  const uploadRef = uploadCount > 0 ? "upload:0" : ""

  if (wantsVideo) {
    for (let i = 1; i <= shots; i++) {
      steps.push({
        id: `v${i}`,
        tool: "generate_video",
        title: arabic ? `لقطة ${i}` : `Shot ${i}`,
        model: "auto",
        prompt: `${shots > 1 ? `Shot ${i} of ${shots}. ` : ""}Cinematic commercial footage: ${subject}. Smooth camera movement, premium lighting, high detail.`,
        settings: [
          ...(videoAspect ? [{ key: "aspectRatio", value: videoAspect }] : []),
          { key: "duration", value: String(perShot) },
        ],
        start_frame: i === 1 ? uploadRef : "",
        end_frame: "",
        references: [],
      })
    }
  }
  if (wantsImage) {
    for (let i = 1; i <= (wantsVideo ? 1 : images); i++) {
      steps.push({
        id: `i${i}`,
        tool: "generate_image",
        title: arabic ? (wantsVideo ? "بوستر" : `صورة ${i}`) : wantsVideo ? "Poster" : `Image ${i}`,
        model: "auto",
        prompt: `High-end advertising visual: ${subject}. Studio-quality lighting, sharp detail, clean composition.`,
        settings: imageAspect ? [{ key: "aspectRatio", value: imageAspect }] : [],
        start_frame: "",
        end_frame: "",
        references: uploadRef ? [uploadRef] : [],
      })
    }
  }

  const summary = steps.length
  return {
    reply: arabic
      ? `دي خطة مبدئية (${summary} خطوات) من غير مساعد ذكي — عدّل البرومبتات والإعدادات قبل التشغيل.${wantsScript ? " كتابة السكريبت محتاجة LLM متظبط على السيرفر." : ""}`
      : `Here's a basic plan (${summary} steps) made without an AI planner — review prompts and settings before running.${wantsScript ? " Script writing needs an LLM configured on the server." : ""}`,
    title: arabic ? "خطة إنتاج" : "Production plan",
    steps,
  }
}
