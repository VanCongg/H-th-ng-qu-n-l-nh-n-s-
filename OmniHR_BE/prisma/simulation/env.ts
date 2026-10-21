import "dotenv/config";

/**
 * Environment the simulated API runs with. Imported before anything from src/:
 * ConfigModule reads process.env when app.module is first loaded, so setting
 * these any later would be too late.
 */

// Wording suggestion reasons with an LLM is not part of what is simulated.
process.env.AI_SUGGESTION_EXPLANATIONS = "false";

// HRGenie's chats can go to their own planner instance (a rule-based one keeps
// an LLM quota out of a few thousand simulated questions).
if (process.env.SIMULATION_AI_SERVICE_URL) {
  process.env.AI_SERVICE_URL = process.env.SIMULATION_AI_SERVICE_URL;
}

// The API's cache lives in Redis; writing through the services keeps it fresh
// only if the simulator talks to the same Redis.
process.env.REDIS_HOST ??= "localhost";

// Retention runs in the API; a simulated past must not be pruned by real time.
process.env.AUDIT_RETENTION_JOB = "false";
