"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { AgentTurn, Effort, ToolResult } from "@/lib/agent/types"
import type { Recipe } from "./actions"
import type { Plan, PlanStep, UploadInfo } from "./plan"

export type StepStatus = "idle" | "running" | "done" | "failed" | "skipped"

export type StepState = PlanStep & {
  status: StepStatus
  runId?: string
  outputs?: { images?: string[]; video?: string }
  text?: string
  error?: string
}

export type PlanState = {
  title: string
  steps: StepState[]
  /** Files the user attached with the request (targets of "upload:<n>"). */
  uploads: UploadInfo[]
  status: "draft" | "running" | "finished"
  /** Set while a single-step retry runs, so a reload resumes only that step. */
  scope?: string
}

export type ChatUploadItem = UploadInfo & { name?: string }

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  uploads?: ChatUploadItem[]
  plan?: PlanState
  error?: string
  /** Assistant placeholder while the planner is thinking. */
  pending?: boolean
  createdAt: number
}

/** A piece of media the agent can reference by id: "u1".. uploads, "a1".. generated. */
export type AgentAsset = {
  id: string
  kind: "image" | "video" | "audio"
  url: string
  source: "upload" | "generated"
  title?: string
  model?: string
  callId?: string
}

export type AgentCallState = {
  status: "running" | "done" | "failed" | "stopped"
  runId?: string
  assetIds?: string[]
  error?: string
}

export type AgentStatus = "idle" | "thinking" | "working" | "waiting" | "done" | "stopped" | "error"

/** An agent chat: the append-only transcript plus what the UI needs to show progress. */
export type AgentState = {
  transcript: AgentTurn[]
  calls: Record<string, AgentCallState>
  assets: AgentAsset[]
  status: AgentStatus
  error?: string
  runStartedAt?: number
  runEndedAt?: number
  /** Generations and model turns used by the current run (reset on every new message). */
  generations: number
  turns: number
  /** Results already gathered for a turn that also asked the user something. */
  pending?: ToolResult[]
}

export type Session = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  agent?: AgentState
}

type State = {
  sessions: Session[]
  activeId: string | null
  /** Used only when Supabase is not configured (preview mode). */
  localRecipes: Recipe[]
  /** Last thinking model / effort picked in the Super Computer (null → server default). */
  agentModel: string | null
  agentEffort: Effort
  setAgentPrefs: (prefs: { model?: string; effort?: Effort }) => void
  patchAgent: (sessionId: string, fn: (agent: AgentState) => AgentState) => void
  newSession: () => string
  selectSession: (id: string) => void
  deleteSession: (id: string) => void
  addMessage: (sessionId: string, message: ChatMessage) => void
  patchMessage: (sessionId: string, messageId: string, patch: Partial<ChatMessage>) => void
  patchPlan: (sessionId: string, messageId: string, patch: Partial<PlanState>) => void
  patchStep: (sessionId: string, messageId: string, stepId: string, patch: Partial<StepState>) => void
  replaceStep: (sessionId: string, messageId: string, step: StepState) => void
  removeStep: (sessionId: string, messageId: string, stepId: string) => void
  setLocalRecipes: (recipes: Recipe[]) => void
}

const MAX_SESSIONS = 40

export function toPlanState(plan: Plan, uploads: UploadInfo[]): PlanState {
  return { title: plan.title, uploads, status: "draft", steps: plan.steps.map((s) => ({ ...s, status: "idle" })) }
}

function mapSession(sessions: Session[], id: string, fn: (s: Session) => Session): Session[] {
  return sessions.map((s) => (s.id === id ? { ...fn(s), updatedAt: Date.now() } : s))
}

function mapMessage(session: Session, messageId: string, fn: (m: ChatMessage) => ChatMessage): Session {
  return { ...session, messages: session.messages.map((m) => (m.id === messageId ? fn(m) : m)) }
}

function mapPlan(message: ChatMessage, fn: (p: PlanState) => PlanState): ChatMessage {
  return message.plan ? { ...message, plan: fn(message.plan) } : message
}

/**
 * Super Computer chats. Browser-local (per viewer); the generations they
 * start live in the shared runs store / jobs table like any other run.
 */
export const useSuperComputer = create<State>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      localRecipes: [],
      agentModel: null,
      agentEffort: "high",
      setAgentPrefs: ({ model, effort }) =>
        set((state) => ({ agentModel: model ?? state.agentModel, agentEffort: effort ?? state.agentEffort })),
      patchAgent: (sessionId, fn) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) => ({ ...s, agent: fn(s.agent ?? emptyAgent()) })),
        })),
      newSession: () => {
        const current = get().sessions.find((s) => s.id === get().activeId)
        if (current && current.messages.length === 0) return current.id
        const session: Session = { id: crypto.randomUUID(), title: "", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }
        set((state) => ({ sessions: [session, ...state.sessions].slice(0, MAX_SESSIONS), activeId: session.id }))
        return session.id
      },
      selectSession: (id) => set({ activeId: id }),
      deleteSession: (id) =>
        set((state) => {
          const sessions = state.sessions.filter((s) => s.id !== id)
          return { sessions, activeId: state.activeId === id ? (sessions[0]?.id ?? null) : state.activeId }
        }),
      addMessage: (sessionId, message) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) => ({
            ...s,
            title: s.title || (message.role === "user" ? message.text.slice(0, 60) : s.title),
            messages: [...s.messages, message],
          })),
        })),
      patchMessage: (sessionId, messageId, patch) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) => mapMessage(s, messageId, (m) => ({ ...m, ...patch }))),
        })),
      patchPlan: (sessionId, messageId, patch) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) =>
            mapMessage(s, messageId, (m) => mapPlan(m, (p) => ({ ...p, ...patch }))),
          ),
        })),
      patchStep: (sessionId, messageId, stepId, patch) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) =>
            mapMessage(s, messageId, (m) =>
              mapPlan(m, (p) => ({ ...p, steps: p.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) })),
            ),
          ),
        })),
      replaceStep: (sessionId, messageId, step) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) =>
            mapMessage(s, messageId, (m) => mapPlan(m, (p) => ({ ...p, steps: p.steps.map((st) => (st.id === step.id ? step : st)) }))),
          ),
        })),
      removeStep: (sessionId, messageId, stepId) =>
        set((state) => ({
          sessions: mapSession(state.sessions, sessionId, (s) =>
            mapMessage(s, messageId, (m) =>
              mapPlan(m, (p) => ({
                ...p,
                // Removing a step also detaches it from steps that consumed it.
                steps: p.steps
                  .filter((st) => st.id !== stepId)
                  .map((st) => ({
                    ...st,
                    startFrame: st.startFrame?.type === "step" && st.startFrame.id === stepId ? null : st.startFrame,
                    endFrame: st.endFrame?.type === "step" && st.endFrame.id === stepId ? null : st.endFrame,
                    references: st.references.filter((r) => !(r.type === "step" && r.id === stepId)),
                  })),
              })),
            ),
          ),
        })),
      setLocalRecipes: (localRecipes) => set({ localRecipes }),
    }),
    {
      name: "nexus-supercomputer-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        sessions: s.sessions,
        activeId: s.activeId,
        localRecipes: s.localRecipes,
        agentModel: s.agentModel,
        agentEffort: s.agentEffort,
      }),
    },
  ),
)

export function emptyAgent(): AgentState {
  return { transcript: [], calls: {}, assets: [], status: "idle", generations: 0, turns: 0 }
}

export function findMessage(sessionId: string, messageId: string): ChatMessage | undefined {
  return useSuperComputer
    .getState()
    .sessions.find((s) => s.id === sessionId)
    ?.messages.find((m) => m.id === messageId)
}
