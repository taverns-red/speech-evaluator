// E2E Test Server — starts the app without auth middleware
// Used by Playwright's webServer config to serve the frontend for browser tests.

import { createAppServer } from "./server.js";
import { createLogger } from "./logger.js";

const logger = createLogger("E2EServer");
const port = Number(process.env.PORT ?? 3099);

const server = createAppServer({
  logger,
  version: "e2e-test",
  // No authMiddleware = auth bypass for e2e tests
  // No wsAuthVerify = WebSocket connections accepted without token
});

server.listen(port).then(() => {
  logger.info(`E2E test server listening on port ${port}`);
});
