// No-op mock for the `server-only` package in the Vitest test environment.
// In Next.js production builds, `server-only` throws if imported from
// client-side code. In tests, we disable that enforcement to allow testing
// server-side modules directly.
export {};
