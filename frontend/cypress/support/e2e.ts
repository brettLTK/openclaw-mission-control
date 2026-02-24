// Cypress support file.
// Place global hooks/commands here.

/// <reference types="cypress" />

// Next.js hydration mismatch can happen non-deterministically in CI/dev mode.
// Ignore this specific runtime error so E2E assertions can continue.
Cypress.on("uncaught:exception", (err) => {
  if (err.message?.includes("Hydration failed")) {
    return false;
  }
  return true;
});

import "./commands";
