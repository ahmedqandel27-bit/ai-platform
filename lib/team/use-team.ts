"use client"

import { useQuery } from "@tanstack/react-query"

import { isSupabaseConfigured } from "@/lib/env"
import { listProjects, type Project } from "@/lib/projects/actions"
import { loadTeamContext } from "./actions"
import type { TeamContext } from "./types"

export const TEAM_QUERY = ["team"] as const
export const PROJECTS_QUERY = ["projects"] as const

/** Active team context (null in preview mode or while signed out). */
export function useTeam() {
  return useQuery<TeamContext | null>({
    queryKey: TEAM_QUERY,
    queryFn: () => loadTeamContext(),
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
  })
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: PROJECTS_QUERY,
    queryFn: async () => {
      const result = await listProjects()
      return result.ok ? (result.data ?? []) : []
    },
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
  })
}
