import { NextResponse } from "next/server";
import { ACTION_CATALOG } from "@/lib/engine/catalog";

export async function GET() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5);

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "EcoAction AI",
    version: "2.1.0",
    engine: {
      status: "operational",
      type: "Multi-Criteria Decision Analysis (MCDA) + Google Gemini 2.5 Flash",
      mode: hasGemini ? "hybrid_ai_deterministic" : "offline_deterministic_rule_based",
      catalogActionsCount: ACTION_CATALOG.length,
      localization: {
        primaryRegion: "Pune, Maharashtra, India",
        primaryCurrency: "INR (₹)",
        secondaryCurrency: "USD ($)",
        tariffs: {
          msedclResidentialPerUnit: "₹8.50/kWh",
          msedclCommercialPerUnit: "₹11.50/kWh",
          westernGridCarbonFactor: "0.71 kg CO2e/kWh",
          pmcWasteSegregationCompliance: true,
        },
      },
    },
    security: {
      rateLimiter: "Active (40 req/min sliding window per IP)",
      payloadGuard: "Active (Max 50KB)",
      xssSanitization: "Active (Regex tag stripping & control char filtering)",
      promptInjectionDefense: "Active (Structured XML containment fences)",
      contentSecurityPolicy: "Enforced via HTTP headers",
      strictTransportSecurity: "Enforced (max-age=63072000)",
      clientSecretExposure: "Zero (100% server-side isolated)",
    },
  });
}
