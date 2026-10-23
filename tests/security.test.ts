import test from "node:test";
import assert from "node:assert/strict";
import { evaluateUserContext } from "../lib/engine/scorer";
import { UserContext } from "../lib/engine/types";

test("Security 1: Input sanitization neutralizes HTML and script tags", () => {
  const maliciousContext: UserContext = {
    entityType: "household",
    subType: "apartment",
    tenancy: "renter",
    budgetTier: "zero",
    urgency: "immediate",
    primaryGoal: "lower_electric",
    situationNotes: "<script>alert('xss')</script><iframe src='evil.com'></iframe>Standard apartment with high geyser bills.",
    completedActionIds: [],
    currency: "INR",
  };

  const result = evaluateUserContext(maliciousContext);
  assert.ok(result.topThree.length > 0, "Engine must execute securely without crashing");
  
  // Verify that legitimate keywords like 'geyser' were extracted despite malicious wrapping
  const hasGeyserAction = result.topThree.some(a => 
    a.title.toLowerCase().includes("geyser") || 
    (a.puneContextTitle && a.puneContextTitle.toLowerCase().includes("geyser")) ||
    a.title.toLowerCase().includes("water heater")
  );
  assert.ok(hasGeyserAction, "Should extract valid keywords safely despite injected tags");
});

test("Security 2: Extreme length payload bounding", () => {
  const extremeNotes = "A".repeat(10000); // 10,000 character buffer overflow attempt
  const context: UserContext = {
    entityType: "household",
    subType: "single_family",
    tenancy: "owner",
    budgetTier: "low",
    urgency: "immediate",
    primaryGoal: "balanced",
    situationNotes: extremeNotes,
    completedActionIds: [],
    currency: "INR",
  };

  const start = performance.now();
  const result = evaluateUserContext(context);
  const elapsed = performance.now() - start;

  assert.ok(result.topThree.length === 3);
  assert.ok(elapsed < 100, `Evaluation must complete in sub-100ms even with massive inputs (took ${elapsed.toFixed(1)}ms)`);
});

test("Security 3: Tenant safeguard prevents unauthorized property damage", () => {
  const renterContext: UserContext = {
    entityType: "household",
    subType: "apartment",
    tenancy: "renter",
    budgetTier: "high", // High budget, but RENTER!
    urgency: "immediate",
    primaryGoal: "heating_cooling",
    situationNotes: "Want to install central heat pump or drill attic",
    completedActionIds: [],
    currency: "INR",
  };

  const result = evaluateUserContext(renterContext);

  // Assert that zero non-renter friendly actions are recommended to a tenant
  for (const action of result.topThree) {
    assert.strictEqual(
      action.renterFriendly,
      true,
      `Tenant must not be recommended non-renter action: ${action.id}`
    );
  }
});

test("Security 4: Budget boundary integrity under zero-cost tier", () => {
  const zeroBudgetContext: UserContext = {
    entityType: "household",
    subType: "apartment",
    tenancy: "renter",
    budgetTier: "zero",
    urgency: "immediate",
    primaryGoal: "zero_waste",
    situationNotes: "Zero budget student flat in Pune",
    completedActionIds: [],
    currency: "INR",
  };

  const result = evaluateUserContext(zeroBudgetContext);
  
  // Rank 1 action must require ₹0 upfront capital
  assert.strictEqual(
    result.topThree[0].minCostInr,
    0,
    "Zero budget tier must mandate ₹0 upfront cost for rank 1 priority"
  );
});

test("Security 5: Currency isolation between INR and USD", () => {
  const inrContext: UserContext = {
    entityType: "household",
    subType: "single_family",
    tenancy: "owner",
    budgetTier: "low",
    urgency: "immediate",
    primaryGoal: "lower_electric",
    situationNotes: "Pune",
    completedActionIds: [],
    currency: "INR",
  };

  const usdContext: UserContext = {
    ...inrContext,
    currency: "USD",
  };

  const inrRes = evaluateUserContext(inrContext);
  const usdRes = evaluateUserContext(usdContext);

  assert.strictEqual(inrRes.currency, "INR");
  assert.strictEqual(inrRes.currencySymbol, "₹");
  assert.strictEqual(usdRes.currency, "USD");
  assert.strictEqual(usdRes.currencySymbol, "$");
  assert.ok(inrRes.cumulativeSavings.minSavings > usdRes.cumulativeSavings.minSavings, "INR figures should reflect local currency scale");
});
