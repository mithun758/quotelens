// Friendly, actionable messages for anything that can fail during a live demo.
// The raw error is logged on the server; the person sees what happened and what to do.
import Anthropic from "@anthropic-ai/sdk";

export class UserFacingError extends Error {}

export function friendlyError(error: unknown, action = "That"): string {
  if (error instanceof UserFacingError) return error.message;
  console.error(`[${action}]`, error);
  if (error instanceof Anthropic.APIConnectionTimeoutError) return `${action} took too long: the AI model did not respond in time. Try again.`;
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy right now. Wait a few seconds and try again.";
  if (error instanceof Anthropic.APIConnectionError) return "Could not reach the AI service. Check the connection and try again.";
  if (error instanceof Anthropic.InternalServerError || (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500)) {
    return "The AI service had a temporary problem. Try again in a moment.";
  }
  if (error instanceof Anthropic.APIError) return `${action} failed: the AI service rejected the request (${error.status}).`;
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed? ?out|timeout/i.test(message)) return `${action} took too long: the database did not respond in time. Try again.`;
  if (/fetch failed|ECONNRESET|ENOTFOUND|network/i.test(message)) return "Could not reach the database. Try again in a moment.";
  // Our own validation and state messages are already written for the person.
  return message;
}
