import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve extensionless relative imports and the "@/" alias like the app bundler does.
const ROOT = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const spec = specifier.startsWith("@/") ? ROOT + specifier.slice(2) : specifier;
    try { return nextResolve(spec, context); }
    catch (error) {
      if (!spec.startsWith(".") && !spec.startsWith("file:")) throw error;
      if (error.code === "ERR_UNSUPPORTED_DIR_IMPORT") return nextResolve(`${spec}/index.ts`, context);
      if (error.code === "ERR_MODULE_NOT_FOUND") return nextResolve(`${spec}.ts`, context);
      throw error;
    }
  },
});

const { MODELS, getModel } = await import("../generation/catalog/index.ts");
const media = await import("../lib/studio/media.ts");
const { planeFromRun, isTerminal } = await import("../generation/run-types.ts");
const { toPlatform } = await import("../generation/to-platform.ts");
const { toGenerationError } = await import("../generation/errors.ts");
const { PlatformError } = await import("../generation/platform.ts");
const { MissingCredentialsError } = await import("../generation/credentials.ts");

const file = (id, kind) => ({ id, url: `https://cdn.example.com/${id}`, kind });

test("both studios expose every installed model", () => {
  const image = MODELS.filter((m) => m.surface === "image");
  const video = MODELS.filter((m) => m.surface === "video");
  assert.equal(image.length + video.length, MODELS.length);
  assert.ok(image.length > 0 && video.length > 0);
});

test("images route to references first, then frames when the model has no reference slot", () => {
  const flux = getModel("flux-2");
  assert.deepEqual(media.addMedia(flux, [], file("a", "image")).map((m) => m.role), ["reference"]);

  const kling25 = getModel("kling-2.5"); // start frame only
  const one = media.addMedia(kling25, [], file("a", "image"));
  assert.deepEqual(one.map((m) => m.role), ["start"]);
  assert.throws(() => media.addMedia(kling25, one, file("b", "image")), /maximum 1/);

  const kling3 = getModel("kling-3-pro"); // start + end
  const two = media.addMedia(kling3, media.addMedia(kling3, [], file("a", "image")), file("b", "image"));
  assert.deepEqual(two.map((m) => m.role), ["start", "end"]);
});

test("unsupported kinds are rejected and duplicates ignored", () => {
  const soul = getModel("soul-2");
  assert.throws(() => media.addMedia(soul, [], file("a", "image")), /does not accept/);
  const flux = getModel("flux-2");
  const once = media.addMedia(flux, [], file("a", "image"));
  assert.equal(media.addMedia(flux, once, file("a", "image")).length, 1);
});

test("video files fill the source slot first, then become video references", () => {
  const edit = getModel("seedance-2.5-edit");
  const first = media.addMedia(edit, [], file("v1", "video"));
  const second = media.addMedia(edit, first, file("v2", "video"));
  assert.deepEqual(second.map((m) => m.role), ["source", "video"]);
  const swapped = media.setRole(edit, second, "v2", "source");
  assert.deepEqual(swapped.map((m) => [m.id, m.role]), [["v1", "video"], ["v2", "source"]]);
});

test("a start frame on Seedance maps to image-to-video with image_url", () => {
  const model = getModel("seedance-2");
  const items = media.addMedia(model, [], file("a", "image"));
  const reassigned = media.setRole(model, items, "a", "start");
  const plane = planeFromRun({ model: model.id, prompt: "dolly in", settings: { aspectRatio: "16:9", duration: 5, generateAudio: true, resolution: "720p" }, media: reassigned, inputMode: "frames" });
  const req = toPlatform(plane);
  assert.equal(req.path, "bytedance/seedance-2.0/image-to-video");
  assert.equal(req.body.image_url, "https://cdn.example.com/a");
});

test("platform errors map to stable codes", () => {
  assert.equal(toGenerationError(new MissingCredentialsError()).code, "missing_key");
  assert.equal(toGenerationError(new PlatformError(401, { detail: "bad" })).code, "invalid_key");
  assert.equal(toGenerationError(new PlatformError(429, {})).code, "rate_limited");
  assert.equal(toGenerationError(new PlatformError(422, { detail: "x" })).code, "invalid_input");
  assert.equal(toGenerationError(new PlatformError(503, {})).code, "platform_error");
  assert.equal(toGenerationError(new Error("A prompt is required")).code, "invalid_input");
});

test("terminal statuses", () => {
  for (const s of ["completed", "failed", "nsfw", "canceled", "error"]) assert.ok(isTerminal(s));
  for (const s of ["submitting", "queued", "in_progress"]) assert.ok(!isTerminal(s));
});

test("team key allowlist fails closed and matches e-mails or @domains exactly", async () => {
  const { isAllowedForTeamKey } = await import("../generation/team-key-policy.ts");
  const list = "@theviralempire.agency, Freelancer@Gmail.com";
  assert.equal(isAllowedForTeamKey("sara@theviralempire.agency", list), true);
  assert.equal(isAllowedForTeamKey("SARA@TheViralEmpire.Agency", list), true);
  assert.equal(isAllowedForTeamKey("freelancer@gmail.com", list), true);
  assert.equal(isAllowedForTeamKey("someone@gmail.com", list), false);
  assert.equal(isAllowedForTeamKey("x@evil-theviralempire.agency", list), false);
  assert.equal(isAllowedForTeamKey("x@theviralempire.agency.evil.com", list), false);
  assert.equal(isAllowedForTeamKey("sara@theviralempire.agency", ""), false);
  assert.equal(isAllowedForTeamKey("sara@theviralempire.agency", undefined), false);
  assert.equal(isAllowedForTeamKey(null, list), false);
});

test("Supabase URL is reduced to its origin (REST URL / trailing slash pasted by mistake)", async () => {
  const { normalizeSupabaseUrl } = await import("../lib/env.ts");
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co"), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/"), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl(" https://abc.supabase.co/rest/v1/ "), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/auth/v1"), "https://abc.supabase.co");
  assert.equal(normalizeSupabaseUrl("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
  assert.equal(normalizeSupabaseUrl(""), "");
  assert.equal(normalizeSupabaseUrl(undefined), "");
});
