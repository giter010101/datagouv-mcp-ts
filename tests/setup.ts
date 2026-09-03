import { MockAgent, setGlobalDispatcher } from "undici";

/**
 * Offline projects only (see `vitest.config.ts`): route Node's global `fetch`
 * through an undici `MockAgent` with outbound connections disabled. Any test that
 * forgets to inject `fetchImpl` (or a `MockAgent`) fails fast with
 * `UND_MOCK_ERR_MOCK_NOT_MATCHED` instead of silently hitting data.gouv.fr.
 *
 * Loopback is still allowed: the HTTP transport e2e tests bind a real port on
 * 127.0.0.1 and talk to it with `fetch`.
 */
const agent = new MockAgent();
agent.disableNetConnect();
agent.enableNetConnect(/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/);
setGlobalDispatcher(agent);

process.env.LOG_LEVEL ??= "silent";
