export type EntityType = "household" | "small_business";

export type HouseholdType = 
  | "single_family" 
  | "apartment" 
  | "townhouse" 
  | "dorm_room";

export type BusinessType = 
  | "cafe_restaurant" 
  | "retail_shop" 
  | "office" 
  | "studio_workshop" 
  | "services";

export type TenancyType = "renter" | "owner";

export type BudgetTier = "zero" | "low" | "medium" | "high";

export type UrgencyTier = "immediate" | "this_month" | "quarter";

export type CurrencyCode = "INR" | "USD";

export type SustainabilityGoal = 
  | "lower_electric" 
  | "heating_cooling" 
  | "zero_waste" 
  | "water_conservation" 
  | "balanced";

export type ActionCategory = "energy" | "heating_cooling" | "waste" | "water" | "habits";

export type DifficultyLevel = "easy_diy" | "moderate_diy" | "professional";

export interface UserContext {
  entityType: EntityType;
  subType: HouseholdType | BusinessType;
  tenancy: TenancyType;
  budgetTier: BudgetTier;
  urgency: UrgencyTier;
  primaryGoal: SustainabilityGoal;
  situationNotes: string;
  completedActionIds: string[];
  currency?: CurrencyCode; // Defaults to "INR" for Pune / India
}

export interface ActionDefinition {
  id: string;
  title: string;
  puneContextTitle?: string;
  category: ActionCategory;
  description: string;
  puneDescription?: string;
  difficulty: DifficultyLevel;
  renterFriendly: boolean;
  minCost: number; // in USD
  maxCost: number; // in USD
  minCostInr: number; // in INR (₹)
  maxCostInr: number; // in INR (₹)
  minAnnualSavingsDollars: number; // in USD
  maxAnnualSavingsDollars: number; // in USD
  minAnnualSavingsInr: number; // in INR (₹)
  maxAnnualSavingsInr: number; // in INR (₹)
  minCo2eSavingsKg: number;
  maxCo2eSavingsKg: number;
  paybackMonths: number; // 0 = immediate/no capital cost
  timeToImplementHours: number;
  applicableEntities: EntityType[];
  applicableGoals: SustainabilityGoal[];
  assumptions: string[];
  puneAssumptions?: string[];
  implementationSteps: string[];
  puneImplementationSteps?: string[];
  equipmentNeeded: string[];
  proTips: string[];
}

export interface ActionScoreBreakdown {
  impactScore: number;       // 0 - 100
  feasibilityScore: number;  // 0 - 100
  costEfficiencyScore: number; // 0 - 100
  urgencyFitScore: number;   // 0 - 100
  overallScore: number;      // 0 - 100
}

export interface ScoredAction extends ActionDefinition {
  scores: ActionScoreBreakdown;
  rank: number;
  matchReasons: string[];
  isCompleted: boolean;
  aiTailoredTip?: string;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  context: UserContext;
}

export interface DecisionResult {
  rankedActions: ScoredAction[];
  topThree: ScoredAction[];
  honorableMentions: ScoredAction[];
  completedActions: ScoredAction[];
  currency: CurrencyCode;
  currencySymbol: string;
  cumulativeSavings: {
    minSavings: number;
    maxSavings: number;
    minDollars: number;
    maxDollars: number;
    minInr: number;
    maxInr: number;
    minCo2eKg: number;
    maxCo2eKg: number;
  };
  assumptionsSummary: string[];
  generatedWithAI: boolean;
  aiExecutiveSummary?: string;
  localIncentiveAdvice?: string;
}
