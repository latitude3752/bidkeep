// Test-only stand-in for the "server-only" package, which unconditionally
// throws outside Next's bundler (Next aliases it to a no-op when building
// the server graph; this mirrors that for Vitest). See vitest.config.ts.
export {};
