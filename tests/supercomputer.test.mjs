import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

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

const plan = await import("../lib/supercomputer/plan.ts");
const { heuristicPlan } = await import("../lib/supercomputer/heuristic.ts");
const { PlanDraftSchema } = await import("../lib/supercomputer/plan-schema.ts");
const { getModel } = await import("../generation/catalog/index.ts");

const step = (over) => ({ id: "s1", tool: "generate_image", title: "t", model: "auto", prompt: "a watch", settings: [], start_frame: "", end_frame: "", references: [], ...over });
const draft = (steps) => ({ reply: "ok", title: "Plan", steps });

test("unknown models fall back to Auto; known models are kept", () => {
  const p = plan.normalizePlan(draft([step({ model: "gpt-image-9" }), step({ id: "s2", tool: "generate_video", model: "kling-3-pro" })]), []);
  assert.equal(p.steps[0].auto, true);
  assert.equal(getModel(p.steps[0].model).surface, "image");
  assert.equal(p.steps[1].model, "kling-3-pro");
  assert.equal(p.steps[1].auto, false);
});

test("image → video chaining: start frame must point at an EARLIER image step", () => {
  const p = plan.normalizePlan(
    draft([
      step({ id: "v0", tool: "generate_video", start_frame: "step:k1" }), // forward reference → dropped
      step({ id: "k1" }),
      step({ id: "v1", tool: "generate_video", start_frame: "step:k1" }),
      step({ id: "v2", tool: "generate_video", start_frame: "step:v1" }), // video output as frame → dropped
    ]),
    [],
  );
  const byId = Object.fromEntries(p.steps.map((s) => [s.id, s]));
  assert.equal(byId.v0.startFrame, null);
  assert.deepEqual(byId.v1.startFrame, { type: "step", id: "k1" });
  assert.ok(getModel(byId.v1.model).roles.start);
  assert.equal(byId.v2.startFrame, null);
  assert.deepEqual(plan.dependencies(byId.v1), ["k1"]);
});

test("upload references must exist and be images", () => {
  const uploads = [{ url: "https://cdn.example.com/a.png", kind: "image" }, { url: "https://cdn.example.com/b.mp4", kind: "video" }];
  const p = plan.normalizePlan(draft([step({ references: ["upload:0", "upload:1", "upload:7"] })]), uploads);
  assert.deepEqual(p.steps[0].references, [{ type: "upload", index: 0 }]);
  assert.ok((getModel(p.steps[0].model).roles.reference ?? 0) > 0, "auto picks a model that accepts references");
});

test("settings are coerced into the model schema; ratios snap to the nearest option", () => {
  const p = plan.normalizePlan(
    draft([step({ tool: "generate_video", model: "seedance-2", settings: [{ key: "duration", value: "99" }, { key: "aspectRatio", value: "4:5" }, { key: "generateAudio", value: "false" }, { key: "bogus", value: "1" }] })]),
    [],
  );
  const s = p.steps[0].settings;
  assert.equal(s.duration, 15);
  assert.equal(s.aspectRatio, "3:4");
  assert.equal(s.generateAudio, false);
  assert.equal("bogus" in s, false);
});

test("plans are capped and ids made unique", () => {
  const many = Array.from({ length: 12 }, () => step({ id: "x" }));
  const p = plan.normalizePlan(draft(many), []);
  assert.equal(p.steps.length, plan.MAX_STEPS);
  assert.equal(new Set(p.steps.map((s) => s.id)).size, p.steps.length);
});

test("write_script steps carry no model", () => {
  const p = plan.normalizePlan(draft([step({ tool: "write_script", model: "soul-2" })]), []);
  assert.equal(p.steps[0].model, "");
});

test("sanitizePlan drops tampered steps and re-resolves models", () => {
  const p = plan.sanitizePlan({ title: "r", steps: [{ id: "a", tool: "rm -rf", prompt: "x" }, { id: "b", tool: "generate_image", model: "nope", auto: false, prompt: "x", settings: {}, references: [{ type: "step", id: "zzz" }] }] });
  assert.equal(p.steps.length, 1);
  assert.equal(p.steps[0].references.length, 0);
  assert.equal(getModel(p.steps[0].model).surface, "image");
});

test("reconcileStep switches model and keeps settings valid", () => {
  const [s] = plan.normalizePlan(draft([step({ tool: "generate_video", model: "seedance-2", settings: [{ key: "duration", value: "12" }] })]), []).steps;
  const next = plan.reconcileStep(s, "kling-3-turbo");
  assert.equal(next.model, "kling-3-turbo");
  assert.ok(next.settings.duration >= 3 && next.settings.duration <= 15);
});

test("keyword planner: Arabic ad brief → 3 shots + 4:5 poster", () => {
  const d = heuristicPlan("اعملي إعلان 15 ثانية لبراند ساعات فخم، 3 لقطات، وصورة بوستر 4:5", 0);
  assert.ok(PlanDraftSchema.safeParse(d).success);
  const videos = d.steps.filter((s) => s.tool === "generate_video");
  const images = d.steps.filter((s) => s.tool === "generate_image");
  assert.equal(videos.length, 3);
  assert.equal(images.length, 1);
  assert.deepEqual(images[0].settings, [{ key: "aspectRatio", value: "4:5" }]);
  assert.ok(videos.every((v) => v.settings.some((x) => x.key === "duration" && x.value === "5")));
  assert.match(d.reply, /[؀-ۿ]/);
});

test("keyword planner: animate an upload → one video with the upload as start frame", () => {
  const d = heuristicPlan("Animate this product image into a 9:16 reel", 1);
  assert.equal(d.steps.length, 1);
  assert.equal(d.steps[0].tool, "generate_video");
  assert.equal(d.steps[0].start_frame, "upload:0");
});

test("keyword planner: chit-chat gets a question, no steps", () => {
  const d = heuristicPlan("hello there", 0);
  assert.equal(d.steps.length, 0);
});

test("text-to-video keeps an explicitly chosen Seedance model (no reference-mode trap)", () => {
  const p = plan.normalizePlan(draft([step({ tool: "generate_video", model: "seedance-2" })]), []);
  assert.equal(p.steps[0].model, "seedance-2");
  assert.equal(p.steps[0].auto, false);
  const auto = plan.autoPick("video", { start: false, end: false, refs: 0 });
  assert.ok(auto && plan.accepts(auto, { start: false, end: false, refs: 0 }));
});
