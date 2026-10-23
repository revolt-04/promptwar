import { ACTION_CATALOG } from "./catalog";
import { 
  UserContext, 
  ActionDefinition, 
  ScoredAction, 
  ActionScoreBreakdown,
  DecisionResult,
  CurrencyCode 
} from "./types";

/**
 * Budget upper bounds for scoring reference
 */
const BUDGET_CAPS_USD: Record<string, number> = {
  zero: 0,
  low: 150,
  medium: 1000,
  high: 10000,
};

const BUDGET_CAPS_INR: Record<string, number> = {
  zero: 0,
  low: 2000,
  medium: 15000,
  high: 100000,
};

/**
 * Evaluates feasibility of an action given the user's tenancy and budget constraints.
 */
function calculateFeasibility(action: ActionDefinition, context: UserContext): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;
  const isINR = context.currency !== "USD"; // Default to INR
  const currencySymbol = isINR ? "₹" : "$";

  // 1. Tenancy Feasibility Gate
  if (context.tenancy === "renter" && !action.renterFriendly) {
    score = 0;
    reasons.push("Disqualified for tenants: Requires permanent structural or building modification");
    return { score, reasons };
  } else if (context.tenancy === "renter" && action.renterFriendly) {
    score += 5;
    reasons.push("100% tenant-safe: Zero landlord permission needed; portable upon moving");
  } else if (context.tenancy === "owner") {
    score += 5;
  }

  // 2. Budget Feasibility Gate
  const budgetCap = isINR 
    ? (BUDGET_CAPS_INR[context.budgetTier] ?? 2000)
    : (BUDGET_CAPS_USD[context.budgetTier] ?? 150);

  const minCost = isINR ? action.minCostInr : action.minCost;
  const maxCost = isINR ? action.maxCostInr : action.maxCost;

  if (context.budgetTier === "zero") {
    if (minCost === 0) {
      score += 15;
      reasons.push(`Requires ${currencySymbol}0 capital cost (uses existing tools and zero-cost habits)`);
    } else {
      score -= isINR ? (minCost / 50) : (minCost * 2);
      const threshold = isINR ? 500 : 30;
      if (minCost > threshold) {
        score = 0;
        reasons.push(`Exceeds ${currencySymbol}0 budget constraint (min cost is ${currencySymbol}${minCost})`);
        return { score, reasons };
      }
    }
  } else {
    if (maxCost <= budgetCap) {
      score += 10;
      reasons.push(`Comfortably within budget (${currencySymbol}${minCost} - ${currencySymbol}${maxCost})`);
    } else if (minCost <= budgetCap) {
      score -= 15;
      reasons.push(`Partially fits: Entry cost ${currencySymbol}${minCost}, full setup up to ${currencySymbol}${maxCost}`);
    } else {
      score -= 60;
      reasons.push(`Exceeds current budget ceiling of ${currencySymbol}${budgetCap}`);
    }
  }

  // 3. Difficulty Feasibility
  if (action.difficulty === "easy_diy") {
    score += 10;
  } else if (action.difficulty === "moderate_diy") {
    score += 0;
  } else if (action.difficulty === "professional") {
    score -= 15;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

/**
 * Evaluates impact based on financial savings, CO2e reduction, alignment with primary goal,
 * and contextual semantic keywords from user's situation notes.
 */
function calculateImpact(action: ActionDefinition, context: UserContext): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;
  const isINR = context.currency !== "USD";
  const currencySymbol = isINR ? "₹" : "$";

  // 1. Primary Goal Alignment
  const matchesGoal = action.applicableGoals.includes(context.primaryGoal);
  if (matchesGoal) {
    score += 30;
    const goalLabels: Record<string, string> = {
      lower_electric: "cutting electric utility bills",
      heating_cooling: "optimizing thermal cooling/heating comfort",
      zero_waste: "diverting municipal landfill waste",
      water_conservation: "cutting water tanker & pump power costs",
      balanced: "holistic financial & environmental savings",
    };
    reasons.push(`Directly targets your primary goal of ${goalLabels[context.primaryGoal] ?? "sustainability"}`);
  }

  // 2. Intelligent Context-Aware Semantic Keyword Extraction
  if (context.situationNotes && context.situationNotes.trim().length > 0) {
    const notesLower = context.situationNotes.toLowerCase();
    const actionText = `${action.title} ${action.puneContextTitle || ""} ${action.description} ${action.puneDescription || ""} ${action.category}`.toLowerCase();

    const semanticKeywords: { pattern: RegExp; label: string }[] = [
      { pattern: /cooler|chiller|refrigerat|freezer|milk|dairy/i, label: "refrigeration & cooling" },
      { pattern: /geyser|water heater|hot water|bath/i, label: "geyser hot water heating" },
      { pattern: /draft|window|sun|heat|balcony|insulat/i, label: "window draft & summer solar heat" },
      { pattern: /food|scrap|bakery|waste|compost|swach|pmc|vegetable/i, label: "kitchen wet waste diversion & composting" },
      { pattern: /ac|air condition|summer|cooling|temperature|bldc/i, label: "air conditioning power reduction" },
      { pattern: /paper|receipt|print|office|invoic|whatsapp/i, label: "paperless digital workflows" },
      { pattern: /water|shower|tap|tanker|aerator/i, label: "water fixture conservation" },
      { pattern: /standby|phantom|spike|charger|electronics|monitor/i, label: "standby idle electricity loads" },
    ];

    for (const kw of semanticKeywords) {
      if (kw.pattern.test(notesLower) && kw.pattern.test(actionText)) {
        score += 22;
        reasons.push(`Context match: Directly resolves ${kw.label} noted in your setup`);
        break;
      }
    }
  }

  // 3. Business Context Specificity
  if (context.entityType === "small_business" && action.id.startsWith("biz_")) {
    score += 10;
    reasons.push("Engineered specifically for commercial shop/office operations");
  }

  // 4. Financial Savings Magnitude
  const maxSavings = isINR ? action.maxAnnualSavingsInr : action.maxAnnualSavingsDollars;
  const minSavings = isINR ? action.minAnnualSavingsInr : action.minAnnualSavingsDollars;
  const highThreshold = isINR ? 25000 : 300;
  const modThreshold = isINR ? 8000 : 100;

  if (maxSavings >= highThreshold) {
    score += 20;
    reasons.push(`High financial impact: Up to ${currencySymbol}${maxSavings.toLocaleString("en-IN")}/yr estimated recurring savings`);
  } else if (maxSavings >= modThreshold) {
    score += 12;
    reasons.push(`Solid financial return: ${currencySymbol}${minSavings.toLocaleString("en-IN")} - ${currencySymbol}${maxSavings.toLocaleString("en-IN")}/yr estimated savings`);
  } else {
    score += 5;
  }

  // 5. Carbon Emissions (CO2e) Reduction
  if (action.maxCo2eSavingsKg >= 600) {
    score += 15;
    reasons.push(`High carbon mitigation: Up to ${action.maxCo2eSavingsKg} kg CO₂e avoided/yr`);
  } else if (action.maxCo2eSavingsKg >= 200) {
    score += 8;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

/**
 * Evaluates cost efficiency (payback speed and return on investment).
 */
function calculateCostEfficiency(action: ActionDefinition): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  if (action.paybackMonths === 0) {
    score = 100;
    reasons.push("Immediate payback: Generates ongoing savings from day one with zero capital cost");
  } else if (action.paybackMonths <= 3) {
    score = 92;
    reasons.push(`Ultra-fast payback: Recovers upfront costs in ~${action.paybackMonths} months`);
  } else if (action.paybackMonths <= 6) {
    score = 80;
    reasons.push("Rapid payback: Recovers investment in under 6 months");
  } else if (action.paybackMonths <= 12) {
    score = 65;
    reasons.push("Solid payback: 1-year investment amortization");
  } else {
    score = 45;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

/**
 * Evaluates urgency alignment based on time-to-implement and urgency tier.
 */
function calculateUrgencyFit(action: ActionDefinition, context: UserContext): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  if (context.urgency === "immediate") {
    if (action.timeToImplementHours <= 1.0 && action.difficulty === "easy_diy") {
      score = 95;
      reasons.push(`Instant execution: Ready to implement today in ~${Math.round(action.timeToImplementHours * 60)} minutes`);
    } else if (action.timeToImplementHours <= 2.0) {
      score = 75;
      reasons.push("Fast project: Takes approximately 1-2 hours to execute");
    } else {
      score = 40;
    }
  } else if (context.urgency === "this_month") {
    if (action.timeToImplementHours <= 2.5) {
      score = 90;
      reasons.push("Ideal monthly target: Straightforward project within a 30-day timeline");
    } else {
      score = 70;
    }
  } else {
    score = 85;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

/**
 * Scores and ranks all actions from the catalog for a specific user context.
 */
export function evaluateUserContext(context: UserContext): DecisionResult {
  const isINR = context.currency !== "USD";
  const currency: CurrencyCode = isINR ? "INR" : "USD";
  const currencySymbol = isINR ? "₹" : "$";

  // Filter out actions not applicable to entity type (household vs small_business)
  const applicableCatalog = ACTION_CATALOG.filter(action => 
    action.applicableEntities.includes(context.entityType)
  );

  // Dynamic Multi-Criteria Decision Weights
  let weightImpact = 0.35;
  let weightFeasibility = 0.30;
  let weightCost = 0.20;
  let weightUrgency = 0.15;

  if (context.budgetTier === "zero") {
    weightCost = 0.30;
    weightFeasibility = 0.35;
    weightImpact = 0.25;
    weightUrgency = 0.10;
  } else if (context.urgency === "immediate") {
    weightUrgency = 0.30;
    weightFeasibility = 0.30;
    weightImpact = 0.25;
    weightCost = 0.15;
  }

  const scoredActions: ScoredAction[] = applicableCatalog.map(action => {
    const feasibility = calculateFeasibility(action, context);
    const impact = calculateImpact(action, context);
    const costEff = calculateCostEfficiency(action);
    const urgency = calculateUrgencyFit(action, context);

    const overallScore = Math.round(
      (feasibility.score * weightFeasibility) +
      (impact.score * weightImpact) +
      (costEff.score * weightCost) +
      (urgency.score * weightUrgency)
    );

    const matchReasons = [
      ...feasibility.reasons,
      ...impact.reasons,
      ...costEff.reasons,
      ...urgency.reasons,
    ];

    const isCompleted = context.completedActionIds?.includes(action.id) ?? false;

    const scores: ActionScoreBreakdown = {
      feasibilityScore: feasibility.score,
      impactScore: impact.score,
      costEfficiencyScore: costEff.score,
      urgencyFitScore: urgency.score,
      overallScore: overallScore,
    };

    return {
      ...action,
      scores,
      rank: 0,
      matchReasons,
      isCompleted,
    };
  });

  // Separate completed and active actions
  const completedActions = scoredActions.filter(a => a.isCompleted);
  const activeActions = scoredActions
    .filter(a => !a.isCompleted && a.scores.feasibilityScore > 10)
    .sort((a, b) => b.scores.overallScore - a.scores.overallScore);

  // Assign ranks
  activeActions.forEach((action, idx) => {
    action.rank = idx + 1;
  });

  const topThree = activeActions.slice(0, 3);
  const honorableMentions = activeActions.slice(3, 8);

  // Calculate cumulative potential savings of top 3 actions
  const cumulativeSavings = topThree.reduce(
    (acc, action) => ({
      minSavings: acc.minSavings + (isINR ? action.minAnnualSavingsInr : action.minAnnualSavingsDollars),
      maxSavings: acc.maxSavings + (isINR ? action.maxAnnualSavingsInr : action.maxAnnualSavingsDollars),
      minDollars: acc.minDollars + action.minAnnualSavingsDollars,
      maxDollars: acc.maxDollars + action.maxAnnualSavingsDollars,
      minInr: acc.minInr + action.minAnnualSavingsInr,
      maxInr: acc.maxInr + action.maxAnnualSavingsInr,
      minCo2eKg: acc.minCo2eKg + action.minCo2eSavingsKg,
      maxCo2eKg: acc.maxCo2eKg + action.maxCo2eSavingsKg,
    }),
    { minSavings: 0, maxSavings: 0, minDollars: 0, maxDollars: 0, minInr: 0, maxInr: 0, minCo2eKg: 0, maxCo2eKg: 0 }
  );

  const assumptionsSummary = isINR ? [
    "Pune MSEDCL Residential Tariff baseline: ₹8.50 per unit (slab 101-300 kWh).",
    "Pune MSEDCL Commercial LT-II Tariff baseline: ₹11.50 per unit (shops, cafes, offices).",
    "Western Regional Electricity Grid carbon intensity: 0.71 kg CO₂e per kWh (CEA Baseline Database).",
    "Pune Municipal Corporation (PMC) & SWaCH mandated wet/dry waste source segregation.",
    "Payback calculations reflect simple payback: (Upfront Cost ÷ Annual Utility Savings) × 12 months.",
  ] : [
    "Electricity rates estimated at $0.16/kWh baseline (US EIA national residential average).",
    "Grid emission factor calculated at 0.385 kg CO₂e/kWh based on EPA eGRID averages.",
    "Food waste decomposition factor calculated using IPCC organic solid waste conversion ratios.",
    "All monetary figures represent estimated annual recurring operational savings.",
    "Payback calculations reflect simple payback: (Upfront Cost ÷ Annual Savings) × 12 months.",
  ];

  return {
    rankedActions: activeActions,
    topThree,
    honorableMentions,
    completedActions,
    currency,
    currencySymbol,
    cumulativeSavings,
    assumptionsSummary,
    generatedWithAI: false,
  };
}
