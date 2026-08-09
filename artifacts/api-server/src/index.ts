import app from "./app";
import { logger } from "./lib/logger";
import { scheduleWeeklyDigests } from "./lib/digest";
import { scheduleSessionNotifications } from "./lib/sessionNotifications";
import { reconcilePayments } from "./lib/sessionPayments";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  scheduleWeeklyDigests();
  scheduleSessionNotifications();
  // Payment reconciliation: retries pending provider refunds/charges left by
  // crashes or provider failures (durable payment-state model).
  setInterval(() => {
    reconcilePayments().catch(() => {});
  }, 5 * 60_000);
});
