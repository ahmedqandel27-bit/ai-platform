/** Guard rails for one run (one user message → the agent working until it stops). */
export const MAX_GENERATIONS_PER_RUN = 24
export const MAX_TURNS_PER_RUN = 40
/** Generations the agent may have in flight at once. */
export const MAX_PARALLEL_GENERATIONS = 6
