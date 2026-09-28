// Integration test of migrations 0001–0004 against a LOCAL Supabase (never production):
//   npx supabase start && psql "$DB_URL" -f supabase/migrations/000*.sql
//   SUPABASE_URL=http://127.0.0.1:54321 ANON=<anon key> npm run test:db
import { createClient } from "@supabase/supabase-js";
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.ANON;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) process.exitCode = 1; };
async function user(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signUp({ email, password: "password123" });
  if (error) throw error;
  return { c, id: data.user.id };
}
const stamp = Date.now();
const owner = await user(`owner${stamp}@test.dev`);
const member = await user(`member${stamp}@test.dev`);
const outsider = await user(`out${stamp}@test.dev`);

// Sign-up trigger: profile + personal team (owner)
const { data: ownTeams } = await owner.c.from("team_members").select("team_id, role");
ok(ownTeams.length === 1 && ownTeams[0].role === "owner", "sign-up creates a personal team with owner role");
const team = ownTeams[0].team_id;

// Invite by email
const { error: addErr } = await owner.c.rpc("add_team_member", { p_team: team, p_email: `MEMBER${stamp}@test.dev`, p_role: "member" });
ok(!addErr, "owner adds member by email (case-insensitive)" + (addErr ? " " + addErr.message : ""));
const { error: badAdd } = await member.c.rpc("add_team_member", { p_team: team, p_email: `out${stamp}@test.dev`, p_role: "member" });
ok(!!badAdd, "member cannot invite");
const { error: noUser } = await owner.c.rpc("add_team_member", { p_team: team, p_email: "nobody@x.dev", p_role: "member" });
ok(!!noUser && /sign up/.test(noUser.message), "unknown email gives a clear error");
const { data: list } = await member.c.rpc("team_members_list", { p_team: team });
ok(list?.length === 2, "members can list the team");
const { data: outList } = await outsider.c.rpc("team_members_list", { p_team: team });
ok((outList ?? []).length === 0, "outsiders cannot list the team");

// Role guards
const { error: selfPromote } = await member.c.rpc("update_team_member", { p_team: team, p_user: member.id, p_role: "admin", p_daily_cap: null });
ok(!!selfPromote, "member cannot promote themselves");
const { error: lastOwner } = await owner.c.rpc("update_team_member", { p_team: team, p_user: owner.id, p_role: "member", p_daily_cap: null });
ok(!!lastOwner && /at least one owner/.test(lastOwner.message), "last owner cannot be demoted");
const { error: capErr } = await owner.c.rpc("update_team_member", { p_team: team, p_user: member.id, p_role: "member", p_daily_cap: 50 });
ok(!capErr, "owner sets member daily cap");

// Settings: admin-only writes
const { error: memberSettings } = await member.c.from("team_settings").insert({ team_id: team, disabled_models: ["soul-2"] });
ok(!!memberSettings, "member cannot write team settings");
const { error: ownerSettings } = await owner.c.from("team_settings").upsert({ team_id: team, model_costs: { "soul-2": { perRun: 2 } } });
ok(!ownerSettings, "owner writes team settings");
const { data: seenSettings } = await member.c.from("team_settings").select("model_costs").eq("team_id", team).single();
ok(seenSettings?.model_costs?.["soul-2"]?.perRun === 2, "member reads team settings");

// Projects & jobs
const { data: project, error: pErr } = await owner.c.from("projects").insert({ team_id: team, name: "Watch campaign" }).select().single();
ok(!pErr && project, "owner creates a project");
const { error: outProj } = await outsider.c.from("projects").insert({ team_id: team, name: "hack" });
ok(!!outProj, "outsider cannot create a project in the team");

const job = (u, extra) => ({ user_id: u.id, client_id: crypto.randomUUID(), surface: "image", model_id: "soul-2", platform_path: "x", status: "completed", cost: 2, team_id: team, ...extra });
const { error: j1 } = await member.c.from("jobs").insert(job(member, { project_id: project.id }));
ok(!j1, "member files a job in the team project" + (j1 ? " " + j1.message : ""));
const { error: j2 } = await member.c.from("jobs").insert(job(member, {}));
ok(!j2, "member files a job without project");
const { error: j3 } = await outsider.c.from("jobs").insert(job(outsider, { project_id: project.id }));
ok(!!j3, "outsider cannot file into the team's project");
const { error: j4 } = await member.c.from("jobs").insert(job(owner, {}));
ok(!!j4, "cannot insert a job as someone else");

const { data: ownerSeesProject } = await owner.c.from("jobs").select("id").eq("project_id", project.id);
ok(ownerSeesProject?.length === 1, "teammates see jobs filed in a shared project");
const { data: ownerSeesPrivate } = await owner.c.from("jobs").select("id").eq("user_id", member.id).is("project_id", null);
ok((ownerSeesPrivate ?? []).length === 0, "teammates do NOT see unfiled (private) jobs");
const { data: outsiderSees } = await outsider.c.from("jobs").select("id").eq("project_id", project.id);
ok((outsiderSees ?? []).length === 0, "outsiders see nothing");

// Usage & spend
const since = new Date(Date.now() - 86400000).toISOString();
const { data: ownerUsage } = await owner.c.rpc("team_usage", { p_team: team, p_since: since });
ok(ownerUsage?.reduce((a, r) => a + Number(r.credits), 0) === 4, "owner sees the whole team's usage (4 credits)");
const { data: memberUsage } = await member.c.rpc("team_usage", { p_team: team, p_since: since });
ok(memberUsage?.every((r) => r.user_id === member.id), "member usage is limited to their own rows");
const { data: spend } = await member.c.rpc("spend_status", { p_team: team });
ok(Number(spend?.[0]?.month_spent) === 4 && Number(spend?.[0]?.today_spent) === 4 && Number(spend?.[0]?.daily_cap) === 50, "spend_status: month, today and cap");

// Prompts
const { error: pr1 } = await member.c.from("prompts").insert({ team_id: team, title: "Hook", body: "A cinematic hook", tags: ["ads"], surface: "video" });
ok(!pr1, "member saves a team prompt");
const { data: prs } = await owner.c.from("prompts").select("id, created_by");
ok(prs?.length === 1, "team sees the prompt");
await outsider.c.from("prompts").delete().eq("id", prs[0].id).select();
const { data: stillThere } = await owner.c.from("prompts").select("id");
ok(stillThere?.length === 1, "outsider cannot delete it");

// Leaving / removal
const { error: rm } = await owner.c.rpc("remove_team_member", { p_team: team, p_user: member.id });
ok(!rm, "owner removes member");
const { data: afterRm } = await member.c.from("jobs").select("id").eq("project_id", project.id);
ok(afterRm?.length === 1, "removed member still sees their own job");
const { data: projAfter } = await member.c.from("projects").select("id").eq("id", project.id);
ok((projAfter ?? []).length === 0, "removed member loses access to team projects");
