// Every state change goes through a named transition, such as `submitRequest` or
// `approveRequest`, so any of them can later move into a Cloud Function without changing the
// interface. This is the Milestone 2 stub; transitions themselves arrive with the systems.

import type { Result } from "./validation";

export interface Transition<TInput, TState, TOutput> {
  readonly name: string;
  /** Applies the change to a copy of `state`, or reports why it cannot. Never partially applies. */
  apply(
    state: TState,
    input: TInput,
  ): Result<{ readonly state: TState; readonly output: TOutput }>;
}

export function defineTransition<TInput, TState, TOutput>(
  transition: Transition<TInput, TState, TOutput>,
): Transition<TInput, TState, TOutput> {
  return transition;
}

/** Runs transitions somewhere: in the browser now, possibly a Cloud Function later. */
export interface TransitionRunner {
  run<TInput, TOutput>(name: string, input: TInput): Promise<Result<TOutput>>;
}
