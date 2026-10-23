"use client";

import React, { useState, useEffect } from "react";
import { 
  UserContext, 
  DecisionResult, 
  EntityType, 
  TenancyType, 
  BudgetTier, 
  UrgencyTier, 
  SustainabilityGoal,
  CurrencyCode 
} from "@/lib/engine/types";
import { SAMPLE_SCENARIOS } from "@/lib/engine/scenarios";
import { evaluateUserContext } from "@/lib/engine/scorer";

export default function Home() {
  const [context, setContext] = useState<UserContext>({
    entityType: "household",
    subType: "apartment",
    tenancy: "renter",
    budgetTier: "zero",
    urgency: "immediate",
    primaryGoal: "lower_electric",
    situationNotes: "Rented 2BHK flat in Kothrud, Pune. High summer power bills and looking for ₹0 cost habits.",
    completedActionIds: [],
    currency: "INR",
  });

  const [result, setResult] = useState<DecisionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{ hasGeminiKey: boolean; mode: string }>({
    hasGeminiKey: false,
    mode: "deterministic_rule_based",
  });
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "catalog" | "methodology">("plan");
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("scenario_pune_renter");

  // Currency helper
  const isINR = context.currency !== "USD";
  const currencySymbol = isINR ? "₹" : "$";

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/recommend");
        if (res.ok) {
          const data = await res.json();
          setServerStatus({
            hasGeminiKey: Boolean(data.hasGeminiKey),
            mode: data.mode || "deterministic_rule_based",
          });
        }
      } catch (err) {
        console.warn("Could not check server status:", err);
      }
      runEvaluation(context, false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runEvaluation(targetContext: UserContext, preferAI = true) {
    setLoading(true);
    try {
      if (preferAI) {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(targetContext),
        });
        if (res.ok) {
          const data: DecisionResult = await res.json();
          setResult(data);
          if (data.topThree.length > 0) {
            setExpandedActionId(data.topThree[0].id);
          }
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Server evaluation failed, using local engine fallback:", err);
    }

    const fallbackResult = evaluateUserContext(targetContext);
    setResult(fallbackResult);
    if (fallbackResult.topThree.length > 0) {
      setExpandedActionId(fallbackResult.topThree[0].id);
    }
    setLoading(false);
  }

  function loadScenario(presetId: string) {
    const preset = SAMPLE_SCENARIOS.find((s) => s.id === presetId);
    if (!preset) return;
    setSelectedScenarioId(presetId);
    setContext(preset.context);
    runEvaluation(preset.context, true);
  }

  function toggleCurrency(newCurrency: CurrencyCode) {
    const updated = { ...context, currency: newCurrency };
    setContext(updated);
    runEvaluation(updated, false);
  }

  function toggleActionCompletion(actionId: string) {
    const isCompleted = context.completedActionIds.includes(actionId);
    const updatedIds = isCompleted
      ? context.completedActionIds.filter((id) => id !== actionId)
      : [...context.completedActionIds, actionId];

    const updatedContext = {
      ...context,
      completedActionIds: updatedIds,
    };

    setContext(updatedContext);
    runEvaluation(updatedContext, false);
  }

  function appendSituationTag(tag: string) {
    const current = context.situationNotes.trim();
    const updated = current ? `${current}, ${tag}` : tag;
    setContext({ ...context, situationNotes: updated });
    setSelectedScenarioId("");
  }

  function copyPlanToClipboard() {
    if (!result) return;
    const lines = [
      `🌱 ECOACTION AI — SUSTAINABILITY ACTION PLAN`,
      `Location: ${isINR ? "Pune, Maharashtra, India" : "Global"} | Target: ${context.entityType.toUpperCase()} (${context.tenancy.toUpperCase()})`,
      `Est. Annual Savings: ${currencySymbol}${result.cumulativeSavings.minSavings.toLocaleString()} - ${currencySymbol}${result.cumulativeSavings.maxSavings.toLocaleString()}/yr`,
      `Est. Carbon Avoided: ${result.cumulativeSavings.minCo2eKg} - ${result.cumulativeSavings.maxCo2eKg} kg CO₂e/yr`,
      ``,
      `--- TOP 3 PRIORITIZED ACTIONS ---`,
      ...result.topThree.map((a) => {
        const title = isINR && a.puneContextTitle ? a.puneContextTitle : a.title;
        const cost = isINR ? `${currencySymbol}${a.minCostInr} - ${currencySymbol}${a.maxCostInr}` : `${currencySymbol}${a.minCost} - ${currencySymbol}${a.maxCost}`;
        const sav = isINR ? `${currencySymbol}${a.minAnnualSavingsInr} - ${currencySymbol}${a.maxAnnualSavingsInr}` : `${currencySymbol}${a.minAnnualSavingsDollars} - ${currencySymbol}${a.maxAnnualSavingsDollars}`;
        return `#${a.rank}. ${title}\n  • Cost: ${cost} | Payback: ~${a.paybackMonths} months\n  • Est. Savings: ${sav}/yr | CO₂: ${a.minCo2eSavingsKg}-${a.maxCo2eSavingsKg} kg\n  • Steps: ${a.implementationSteps.join("; ")}\n` + (a.aiTailoredTip ? `  • Tip: ${a.aiTailoredTip}\n` : "");
      }),
      `Methodology: ${result.assumptionsSummary[0]}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const completedCount = context.completedActionIds.length;
  const totalConsidered = (result?.topThree.length ?? 0) + completedCount;

  return (
    <div className="min-h-screen flex flex-col bg-black text-[#f5f5f7]">
      {/* Apple-style Minimal Navigation */}
      <header className="no-print border-b border-white/[0.08] apple-glass sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm shadow-inner">
              🌱
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-white">EcoAction</span>
              <span className="text-[11px] text-white/40 font-mono uppercase tracking-wider">AI</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Currency Selector (Apple Segmented Control) */}
            <div className="segmented-control flex items-center text-xs">
              <button
                type="button"
                onClick={() => toggleCurrency("INR")}
                className={`px-3 py-1 rounded-full transition-all text-xs cursor-pointer ${
                  isINR
                    ? "bg-white/20 text-white font-semibold shadow-sm"
                    : "text-white/50 hover:text-white"
                }`}
              >
                ₹ INR <span className="text-[10px] text-emerald-400 font-normal">Pune</span>
              </button>
              <button
                type="button"
                onClick={() => toggleCurrency("USD")}
                className={`px-3 py-1 rounded-full transition-all text-xs cursor-pointer ${
                  !isINR
                    ? "bg-white/20 text-white font-semibold shadow-sm"
                    : "text-white/50 hover:text-white"
                }`}
              >
                $ USD
              </button>
            </div>

            {/* AI Status Badge */}
            <div 
              className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium border ${
                serverStatus.hasGeminiKey
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-white/[0.04] text-white/60 border-white/[0.08]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${serverStatus.hasGeminiKey ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"}`} />
              <span>{serverStatus.hasGeminiKey ? "Gemini 2.5 Active" : "Rule Engine (Offline)"}</span>
            </div>

            {/* Quick Utility Actions */}
            <button
              onClick={() => window.print()}
              className="p-2 rounded-full hover:bg-white/10 text-xs text-white/70 hover:text-white transition"
              title="Print Action Plan"
            >
              🖨️
            </button>
            <button
              onClick={copyPlanToClipboard}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition cursor-pointer"
            >
              {copied ? "✓ Copied" : "Copy Plan"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="no-print pt-10 pb-6 px-4 sm:px-6 max-w-6xl mx-auto w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 mb-4">
          <span>📍</span>
          <span>Optimized for Pune & Maharashtra Tariffs</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
          Small shifts. Tangible impact.
        </h1>
        <p className="text-sm sm:text-base text-white/60 max-w-2xl mx-auto leading-relaxed">
          Decide which energy-saving or waste-reduction action to take first with explainable rules, zero-cost tenant habits, and verified Pune utility benchmarks.
        </p>

        {/* 1-Click Pune Quick Scenarios */}
        <div className="mt-8 text-left">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Quick Scenarios (1-Click Test)
            </span>
            <span className="text-xs text-white/40">Select to load & prioritize instantly</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {SAMPLE_SCENARIOS.map((preset) => {
              const isSelected = selectedScenarioId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => loadScenario(preset.id)}
                  className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white/[0.09] border border-white/25 shadow-lg shadow-black/40 text-white"
                      : "apple-card text-white/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{preset.icon}</span>
                    <span className="text-xs font-semibold text-white tracking-tight leading-none">
                      {preset.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-snug line-clamp-2">
                    {preset.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Two-Column Workflow */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Configuration */}
        <div className="no-print lg:col-span-5 flex flex-col gap-5">
          <div className="apple-card rounded-3xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
              <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Configure Your Setup</span>
              </h2>
              <span className="text-[11px] text-white/40 font-mono">Step 1 of 2</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runEvaluation(context, true);
              }}
              className="flex flex-col gap-5 text-xs"
            >
              {/* Entity: Household vs Business */}
              <div>
                <label className="block text-white/70 font-medium mb-2 text-xs">
                  1. Profile
                </label>
                <div className="segmented-control grid grid-cols-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setContext({ ...context, entityType: "household", subType: "apartment" });
                      setSelectedScenarioId("");
                    }}
                    className={`py-2 rounded-full font-medium transition cursor-pointer ${
                      context.entityType === "household"
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🏡 Household
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContext({ ...context, entityType: "small_business", subType: "cafe_restaurant" });
                      setSelectedScenarioId("");
                    }}
                    className={`py-2 rounded-full font-medium transition cursor-pointer ${
                      context.entityType === "small_business"
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🏢 Small Business
                  </button>
                </div>
              </div>

              {/* Tenancy Status */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/70 font-medium text-xs">
                    2. Tenancy Status
                  </label>
                  <span className="text-[10px] text-emerald-400">Tenant Safeguard</span>
                </div>
                <div className="segmented-control grid grid-cols-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setContext({ ...context, tenancy: "renter" });
                      setSelectedScenarioId("");
                    }}
                    className={`py-2 rounded-full font-medium transition cursor-pointer ${
                      context.tenancy === "renter"
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🔑 Renting / Lease
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContext({ ...context, tenancy: "owner" });
                      setSelectedScenarioId("");
                    }}
                    className={`py-2 rounded-full font-medium transition cursor-pointer ${
                      context.tenancy === "owner"
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🏛️ Property Owner
                  </button>
                </div>
                {context.tenancy === "renter" && (
                  <p className="text-[11px] text-white/50 mt-1.5 pl-1">
                    🛡️ Tenant filter active: Structural & permanent electrical modifications excluded.
                  </p>
                )}
              </div>

              {/* Budget Tier */}
              <div>
                <label className="block text-white/70 font-medium mb-2 text-xs">
                  3. Available Upfront Budget
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: "zero", label: `${currencySymbol}0 Free` },
                    { id: "low", label: `< ${currencySymbol}${isINR ? "2,000" : "150"}` },
                    { id: "medium", label: `${currencySymbol}${isINR ? "2k-15k" : "150-1k"}` },
                    { id: "high", label: `${currencySymbol}${isINR ? "15k+" : "1k+"}` },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => {
                        setContext({ ...context, budgetTier: tier.id as BudgetTier });
                        setSelectedScenarioId("");
                      }}
                      className={`py-2 px-2 rounded-xl border text-center font-medium transition text-[11px] cursor-pointer ${
                        context.budgetTier === tier.id
                          ? "bg-white/15 border-white/30 text-white shadow-sm"
                          : "bg-white/[0.02] border-white/[0.06] text-white/50 hover:text-white"
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-white/70 font-medium mb-2 text-xs">
                  4. Implementation Urgency
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "immediate", label: "⚡ Today (<48h)" },
                    { id: "this_month", label: "📅 This Month" },
                    { id: "quarter", label: "🗓️ 3-6 Months" },
                  ].map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setContext({ ...context, urgency: u.id as UrgencyTier });
                        setSelectedScenarioId("");
                      }}
                      className={`py-2 px-2 rounded-xl border text-center font-medium transition text-[11px] cursor-pointer ${
                        context.urgency === u.id
                          ? "bg-white/15 border-white/30 text-white shadow-sm"
                          : "bg-white/[0.02] border-white/[0.06] text-white/50 hover:text-white"
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Goal */}
              <div>
                <label className="block text-white/70 font-medium mb-2 text-xs">
                  5. Primary Sustainability Goal
                </label>
                <select
                  value={context.primaryGoal}
                  onChange={(e) => {
                    setContext({ ...context, primaryGoal: e.target.value as SustainabilityGoal });
                    setSelectedScenarioId("");
                  }}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white/90 focus:outline-none focus:border-white/30 text-xs"
                >
                  <option value="lower_electric" className="bg-zinc-900 text-white">
                    ⚡ Lower Electric Bills (MSEDCL Units / kWh)
                  </option>
                  <option value="heating_cooling" className="bg-zinc-900 text-white">
                    ❄️ AC Cooling Efficiency & Thermal Comfort
                  </option>
                  <option value="zero_waste" className="bg-zinc-900 text-white">
                    ♻️ Zero-Waste & Kitchen Scrap Composting
                  </option>
                  <option value="water_conservation" className="bg-zinc-900 text-white">
                    💧 Water Saving & Tanker Dependency Reduction
                  </option>
                  <option value="balanced" className="bg-zinc-900 text-white">
                    🌱 Balanced All-Rounder (Cost + Carbon + Waste)
                  </option>
                </select>
              </div>

              {/* Situation Notes with Pune Quick Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/70 font-medium text-xs">
                    6. Situation Notes
                  </label>
                  <span className="text-[10px] text-white/40">Keyword-aware</span>
                </div>
                <textarea
                  rows={3}
                  value={context.situationNotes}
                  onChange={(e) => {
                    setContext({ ...context, situationNotes: e.target.value });
                    setSelectedScenarioId("");
                  }}
                  placeholder="Describe your space, appliances, high bill pain points..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 text-xs resize-none"
                />

                {/* Quick Pune Tags to Click and Append */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-white/40 mr-1 mt-0.5">Quick add:</span>
                  {[
                    "high geyser bills",
                    "summer AC cooling",
                    "PMC wet waste",
                    "dairy display chillers",
                    "tap aerators",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => appendSituationTag(tag)}
                      className="text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white px-2 py-0.5 rounded-full transition cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-full font-semibold text-xs bg-white text-black hover:bg-white/90 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Prioritizing Multi-Criteria Decisions...</span>
                  </>
                ) : (
                  <span>Prioritize Actions</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Prioritized Plan Dashboard */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Minimalist Segmented Tabs */}
          <div className="no-print flex items-center gap-2 border-b border-white/[0.08] pb-3">
            <button
              onClick={() => setActiveTab("plan")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                activeTab === "plan"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Action Plan
            </button>
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                activeTab === "catalog"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              All Actions ({result?.rankedActions.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("methodology")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                activeTab === "methodology"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {isINR ? "Pune Methodology" : "Assumptions"}
            </button>
          </div>

          {activeTab === "plan" && (
            <>
              {/* Apple Intelligence Executive Strategy Sheet */}
              {result && (
                <div className="apple-card rounded-3xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 flex items-center gap-1.5">
                      <span>{result.generatedWithAI ? "✨" : "⚖️"}</span>
                      <span>
                        {result.generatedWithAI
                          ? "Gemini Intelligence Synthesis"
                          : (isINR ? "Pune MSEDCL Multi-Criteria Plan" : "Multi-Criteria Decision Strategy")}
                      </span>
                    </span>
                    <span className="text-[10px] bg-white/[0.06] text-white/70 px-2 py-0.5 rounded-full border border-white/[0.08]">
                      Verified
                    </span>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed font-normal">
                    {result.aiExecutiveSummary || (
                      "Your action sequence has been strictly prioritized for lease safety and rapid payback."
                    )}
                  </p>
                  {result.localIncentiveAdvice && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-white/70 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">💡</span>
                      <div>
                        <strong className="text-white font-medium">Local Incentive Advice: </strong>
                        <span>{result.localIncentiveAdvice}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cumulative Metric Pills */}
              {result && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="apple-card rounded-2xl p-4">
                    <span className="text-[11px] text-white/50 block mb-1">Annual Savings</span>
                    <div className="text-lg font-bold text-white tracking-tight">
                      {currencySymbol}{result.cumulativeSavings.minSavings.toLocaleString()} - {currencySymbol}{result.cumulativeSavings.maxSavings.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-white/40 block mt-0.5">per year recurring</span>
                  </div>

                  <div className="apple-card rounded-2xl p-4">
                    <span className="text-[11px] text-white/50 block mb-1">Carbon Avoided</span>
                    <div className="text-lg font-bold text-emerald-400 tracking-tight">
                      {result.cumulativeSavings.minCo2eKg} - {result.cumulativeSavings.maxCo2eKg}
                    </div>
                    <span className="text-[10px] text-white/40 block mt-0.5">kg CO₂e / year</span>
                  </div>

                  <div className="apple-card rounded-2xl p-4">
                    <span className="text-[11px] text-white/50 block mb-1">Payback Speed</span>
                    <div className="text-lg font-bold text-amber-300 tracking-tight">
                      {result.topThree[0]?.paybackMonths === 0 ? "Instant" : `< ${result.topThree[0]?.paybackMonths ?? 3} mos`}
                    </div>
                    <span className="text-[10px] text-white/40 block mt-0.5">on priority action</span>
                  </div>

                  <div className="apple-card rounded-2xl p-4">
                    <span className="text-[11px] text-white/50 block mb-1">Milestones Completed</span>
                    <div className="text-lg font-bold text-white flex items-center gap-1.5 tracking-tight">
                      <span>{completedCount}</span>
                      <span className="text-xs text-white/40 font-normal">/ {totalConsidered}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1 mt-2 overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full transition-all duration-500 rounded-full" 
                        style={{ width: `${totalConsidered > 0 ? (completedCount / totalConsidered) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Completed Milestones Banner */}
              {result && result.completedActions.length > 0 && (
                <div className="apple-card rounded-2xl p-4 border border-emerald-500/20 bg-emerald-950/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                      <span>✓ Completed Milestones ({result.completedActions.length})</span>
                    </h3>
                    <button
                      onClick={() => {
                        setContext({ ...context, completedActionIds: [] });
                        runEvaluation({ ...context, completedActionIds: [] }, false);
                      }}
                      className="text-[11px] text-white/50 hover:text-white underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.completedActions.map((completed) => {
                      const title = isINR && completed.puneContextTitle ? completed.puneContextTitle : completed.title;
                      return (
                        <button
                          key={completed.id}
                          onClick={() => toggleActionCompletion(completed.id)}
                          className="inline-flex items-center gap-1.5 bg-emerald-900/40 hover:bg-emerald-900/70 text-xs px-3 py-1.5 rounded-full border border-emerald-600/30 text-emerald-200 transition cursor-pointer"
                          title="Click to restore to active plan"
                        >
                          <span>✓ {title}</span>
                          <span className="text-[10px] text-emerald-400 ml-1">×</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-emerald-300/80 mt-2">
                    Priorities dynamically recalculated. The next best action has been promoted to Rank #1 below.
                  </p>
                </div>
              )}

              {/* Top 3 Prioritized Action Cards */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Prioritized Sequence (Top 3)
                  </h2>
                  <span className="text-xs text-white/40">Ranked by leverage & payback</span>
                </div>

                {result?.topThree.map((action) => {
                  const isExpanded = expandedActionId === action.id;
                  const displayTitle = isINR && action.puneContextTitle ? action.puneContextTitle : action.title;
                  const displayDesc = isINR && action.puneDescription ? action.puneDescription : action.description;
                  const costStr = isINR 
                    ? (action.minCostInr === 0 ? "₹0 (Free)" : `₹${action.minCostInr.toLocaleString()} - ₹${action.maxCostInr.toLocaleString()}`)
                    : (action.minCost === 0 ? "$0 (Free)" : `$${action.minCost} - $${action.maxCost}`);
                  const savingsStr = isINR
                    ? `₹${action.minAnnualSavingsInr.toLocaleString()} - ₹${action.maxAnnualSavingsInr.toLocaleString()}/yr`
                    : `$${action.minAnnualSavingsDollars} - $${action.maxAnnualSavingsDollars}/yr`;

                  return (
                    <article
                      key={action.id}
                      className="apple-card rounded-3xl border border-white/[0.08] overflow-hidden"
                    >
                      <div className="p-6 pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/10">
                              #{action.rank}
                            </span>
                            <span className="text-xs font-medium text-white/60 capitalize">
                              {action.category.replace("_", " ")}
                            </span>
                          </div>

                          <span className="text-[11px] bg-white/[0.04] text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono">
                            Score: {action.scores.overallScore}/100
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-white tracking-tight mt-1 mb-2">
                          {displayTitle}
                        </h3>

                        <p className="text-xs text-white/70 leading-relaxed mb-4">
                          {displayDesc}
                        </p>

                        {/* Minimalist Metric Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
                            <span className="text-[10px] text-white/40 block mb-0.5">Upfront Cost</span>
                            <span className="font-semibold text-white">{costStr}</span>
                          </div>

                          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
                            <span className="text-[10px] text-white/40 block mb-0.5">Est. Savings</span>
                            <span className="font-semibold text-emerald-400">{savingsStr}</span>
                          </div>

                          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
                            <span className="text-[10px] text-white/40 block mb-0.5">CO₂e Avoided</span>
                            <span className="font-semibold text-white/90">
                              {action.minCo2eSavingsKg} - {action.maxCo2eSavingsKg} kg/yr
                            </span>
                          </div>

                          <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04]">
                            <span className="text-[10px] text-white/40 block mb-0.5">Payback</span>
                            <span className="font-semibold text-amber-300">
                              {action.paybackMonths === 0 ? "Immediate" : `~${action.paybackMonths} months`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Explainability Section */}
                      <div className="px-6 py-3.5 bg-white/[0.015] border-t border-b border-white/[0.06]">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-white/50 block mb-1.5">
                          Why this action is prioritized:
                        </span>
                        <ul className="space-y-1 text-xs text-white/75">
                          {action.matchReasons.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-2 leading-relaxed">
                              <span className="text-emerald-400 font-bold">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Gemini AI Tactical Tip (if present) */}
                        {action.aiTailoredTip && (
                          <div className="mt-3 p-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-xs text-white/90">
                            <div className="flex items-center gap-1.5 font-medium text-emerald-300 mb-1">
                              <span>✨</span>
                              <span>Tactical Insight:</span>
                            </div>
                            <p className="leading-relaxed text-white/80">{action.aiTailoredTip}</p>
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="p-4 bg-white/[0.02] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setExpandedActionId(isExpanded ? null : action.id)}
                          className="no-print text-xs text-white/50 hover:text-white flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>{isExpanded ? "▲ Hide Guide" : "▼ Implementation Guide & Steps"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleActionCompletion(action.id)}
                          className="no-print py-2 px-4 rounded-full text-xs font-semibold transition bg-white text-black hover:bg-white/90 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <span>✓ Mark Done</span>
                        </button>
                      </div>

                      {/* Expanded Steps */}
                      {isExpanded && (
                        <div className="p-6 bg-black/40 border-t border-white/[0.06] space-y-4 text-xs">
                          <div>
                            <h4 className="font-semibold text-white mb-2">Implementation Checklist:</h4>
                            <ol className="space-y-2 text-white/70">
                              {(isINR && action.puneImplementationSteps ? action.puneImplementationSteps : action.implementationSteps).map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                                  <span className="w-5 h-5 rounded-full bg-white/10 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-relaxed">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          {action.equipmentNeeded.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-white/80 mb-1">Tools / Supplies:</h4>
                              <p className="text-white/60">{action.equipmentNeeded.join(", ")}</p>
                            </div>
                          )}

                          {action.proTips.length > 0 && (
                            <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white/80">
                              <span className="font-semibold block mb-1 text-amber-300">💡 Pro Tip:</span>
                              <p>{action.proTips.join(" ")}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* Extended Catalog Tab */}
          {activeTab === "catalog" && (
            <div className="flex flex-col gap-3">
              <div className="apple-card p-4 rounded-2xl mb-1">
                <h3 className="font-semibold text-white text-sm mb-1">
                  Full Evaluated Action Catalog
                </h3>
                <p className="text-xs text-white/50">
                  All feasible actions scored for your profile ({result?.rankedActions.length ?? 0} actions).
                </p>
              </div>

              {result?.rankedActions.map((action) => {
                const title = isINR && action.puneContextTitle ? action.puneContextTitle : action.title;
                const cost = isINR ? (action.minCostInr === 0 ? "Free" : `₹${action.minCostInr}`) : (action.minCost === 0 ? "Free" : `$${action.minCost}`);
                const sav = isINR ? `₹${action.minAnnualSavingsInr.toLocaleString()}/yr` : `$${action.minAnnualSavingsDollars}/yr`;

                return (
                  <div
                    key={action.id}
                    className="apple-card p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white/50">#{action.rank}</span>
                        <span className="font-semibold text-white truncate">{title}</span>
                      </div>
                      <p className="text-white/50 text-[11px] line-clamp-1">{action.description}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <span className="text-[10px] text-white/40 block">Est. Savings</span>
                        <span className="font-semibold text-emerald-400">{sav}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">Cost</span>
                        <span className="font-semibold text-white">{cost}</span>
                      </div>
                      <button
                        onClick={() => toggleActionCompletion(action.id)}
                        className="py-1 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer"
                      >
                        {action.isCompleted ? "Completed" : "Done"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Methodology & Assumptions Tab */}
          {activeTab === "methodology" && (
            <div className="apple-card p-6 rounded-3xl space-y-4 text-xs text-white/70 leading-relaxed">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <span>🔬</span>
                <span>{isINR ? "Pune, Maharashtra & Regional Tariffs" : "Data Sources & Conversion Factors"}</span>
              </h3>

              <div className="space-y-3">
                {result?.assumptionsSummary.map((assumption, idx) => (
                  <div key={idx} className="p-3.5 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
                    <p className="text-white/80">{assumption}</p>
                  </div>
                ))}

                <div className="p-3.5 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
                  <h4 className="font-semibold text-white mb-1">Payback Period Formula</h4>
                  <p className="font-mono text-[11px] bg-black/40 p-2 rounded-lg border border-white/[0.06] mb-1.5 text-white/80">
                    Payback (Months) = (Upfront Equipment Cost ÷ Annual Utility Savings) × 12
                  </p>
                  <p className="text-white/50">
                    Actions with zero capital cost (e.g. thermostat adjustment, condenser dusting) yield an instant 0-month payback.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Apple Minimalist Footer */}
      <footer className="no-print mt-auto border-t border-white/[0.08] py-8 px-4 sm:px-6 text-center text-xs text-white/40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">EcoAction AI</span>
            <span>—</span>
            <span>Prompt Wars Hackathon</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-white/30">
            <span>Pune, Maharashtra</span>
            <span>•</span>
            <span>MSEDCL & PMC Baseline</span>
            <span>•</span>
            <span>Next.js 16</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
