import test from "node:test";
import assert from "node:assert/strict";
import { evaluateUserContext } from "../lib/engine/scorer";
import { UserContext } from "../lib/engine/types";
import { SAMPLE_SCENARIOS } from "../lib/engine/scenarios";

test("Scenario 1: Pune Homeowner prioritizing electricity & geyser savings", () => {
  const scenario = SAMPLE_SCENARIOS.find(s => s.id === "scenario_pune_homeowner")!;
  assert.ok(scenario, "Pune Homeowner scenario preset should exist");

  const result = evaluateUserContext(scenario.context);
  
  assert.strictEqual(result.topThree.length, 3, "Should return top 3 actions");
  assert.ok(result.rankedActions.length >= 3, "Should have active ranked actions");
  assert.strictEqual(result.currency, "INR", "Should default to INR for Pune");
  assert.strictEqual(result.currencySymbol, "₹");
  assert.strictEqual(result.topThree[0].rank, 1, "First action should be rank 1");

  // Cumulative savings should be positive numbers in INR
  assert.ok(result.cumulativeSavings.minInr > 0, "Min INR saved must be > 0");
  assert.ok(result.cumulativeSavings.maxInr >= result.cumulativeSavings.minInr);
  assert.ok(result.cumulativeSavings.maxCo2eKg > 0, "CO2e saved must be > 0");
});

test("Scenario 2: Pune Urban Renter strictly enforces ₹0 budget and tenant safety", () => {
  const scenario = SAMPLE_SCENARIOS.find(s => s.id === "scenario_pune_renter")!;
  const result = evaluateUserContext(scenario.context);

  assert.strictEqual(result.topThree.length, 3);

  // Every top 3 action MUST be renter friendly!
  for (const action of result.topThree) {
    assert.strictEqual(
      action.renterFriendly, 
      true, 
      `Action ${action.id} must be 100% renter friendly for a tenant`
    );
  }

  // Non-renter friendly actions must be filtered out for renters
  const hardwiredActions = result.rankedActions.filter(a => !a.renterFriendly);
  assert.strictEqual(
    hardwiredActions.length, 
    0, 
    "Non-renter actions must be filtered out for renters"
  );

  // Top action on zero budget should have minCostInr of ₹0
  assert.strictEqual(
    result.topThree[0].minCostInr,
    0,
    "Top recommendation on zero-cost budget must have ₹0 upfront capital cost"
  );
});

test("Scenario 3: FC Road Café targets commercial refrigeration and food waste", () => {
  const scenario = SAMPLE_SCENARIOS.find(s => s.id === "scenario_pune_cafe")!;
  const result = evaluateUserContext(scenario.context);

  assert.strictEqual(result.topThree.length, 3);

  // Should only recommend business-applicable actions
  for (const action of result.topThree) {
    assert.ok(
      action.applicableEntities.includes("small_business"),
      `Action ${action.id} must be applicable to small_business`
    );
  }

  // High commercial impact actions should be present
  const titles = result.topThree.map(a => `${a.title} ${a.puneContextTitle || ""}`);
  const hasCommercialRelevant = titles.some(t => 
    t.toLowerCase().includes("cooler") || 
    t.toLowerCase().includes("chiller") || 
    t.toLowerCase().includes("refrigerat") || 
    t.toLowerCase().includes("waste") ||
    t.toLowerCase().includes("curtain")
  );
  assert.ok(hasCommercialRelevant, "Should recommend commercial cooling or waste actions");
});

test("Action completion & dynamic recalculation promotes next best action", () => {
  const baseContext: UserContext = {
    entityType: "household",
    subType: "single_family",
    tenancy: "owner",
    budgetTier: "low",
    urgency: "immediate",
    primaryGoal: "lower_electric",
    situationNotes: "Testing dynamic recalculation in Pune",
    completedActionIds: [],
    currency: "INR",
  };

  const initialResult = evaluateUserContext(baseContext);
  const initialFirstAction = initialResult.topThree[0];
  const initialSecondAction = initialResult.topThree[1];

  // User completes the first action
  const updatedContext: UserContext = {
    ...baseContext,
    completedActionIds: [initialFirstAction.id],
  };

  const recalculatedResult = evaluateUserContext(updatedContext);

  // The completed action should be in completedActions list
  assert.strictEqual(recalculatedResult.completedActions.length, 1);
  assert.strictEqual(recalculatedResult.completedActions[0].id, initialFirstAction.id);

  // The active recommendations should NOT contain the completed action
  assert.ok(
    !recalculatedResult.topThree.some(a => a.id === initialFirstAction.id),
    "Completed action must be removed from active top 3"
  );

  // The previously second-ranked action should now be promoted to rank 1
  assert.strictEqual(
    recalculatedResult.topThree[0].id,
    initialSecondAction.id,
    "Second action should be promoted to Rank #1 after completing the first"
  );
  assert.strictEqual(recalculatedResult.topThree[0].rank, 1);
});

test("Explainability reasons and assumptions are always provided in INR & USD", () => {
  const inrContext: UserContext = {
    entityType: "household",
    subType: "apartment",
    tenancy: "renter",
    budgetTier: "low",
    urgency: "immediate",
    primaryGoal: "balanced",
    situationNotes: "Baner Pune",
    completedActionIds: [],
    currency: "INR",
  };

  const inrResult = evaluateUserContext(inrContext);
  assert.ok(inrResult.assumptionsSummary.some(a => a.includes("MSEDCL")));
  assert.strictEqual(inrResult.currencySymbol, "₹");

  const usdContext: UserContext = {
    ...inrContext,
    currency: "USD",
  };
  const usdResult = evaluateUserContext(usdContext);
  assert.ok(usdResult.assumptionsSummary.some(a => a.includes("EIA")));
  assert.strictEqual(usdResult.currencySymbol, "$");
});
