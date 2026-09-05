import pkg from "../../package.json" with { type: "json" };

export const APP_NAME: string = pkg.name;
export const APP_VERSION: string = pkg.version;
/** Sent on every upstream request (legacy format `datagouv-mcp/<version>`). */
export const USER_AGENT = `${APP_NAME}/${APP_VERSION}`;
