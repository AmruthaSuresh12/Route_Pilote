import { NextResponse } from "next/server";
import { chatCompletion, aiContext, getActiveModelUsed } from "@/lib/openai";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { messages, analysisResult } = await req.json();
    if (!messages || !analysisResult) {
      return new Response("Missing messages or analysisResult", { status: 400 });
    }

    const result = analysisResult as AnalysisResult;

    const systemPrompt = `You are the Route Pilote AI Shipment Copilot, an experienced senior supply chain risk analyst and logistics advisor.
Your goal is to help the user understand the shipment analysis result and answer natural language questions about it.

Here is the context of the shipment analysis:
- Product: ${result.input.product}
- ProductCategory: ${result.productCategory}
- HS Codes: ${result.hsCodes.join(", ")}
- Route: ${result.input.origin} to ${result.input.destination}
- Weight: ${result.input.weightKg} kg
- Ship Date: ${result.input.shipDate}
- Mode: ${result.input.shippingMode || "Ocean"}
- Container Size: ${result.input.containerSize || "40ft HC"}
- Global Risk Score: ${result.riskScore}/100
- Expected Transit Delay: ${result.expectedDelayDays[0]} to ${result.expectedDelayDays[1]} days

Executive Summary:
${result.executiveSummary}

Risk Factors:
${result.riskFactors.map(f => `- [${f.category.toUpperCase()}] Score: ${f.score}/100. Detail: ${f.detail}. Actionable: ${f.actionable}`).join("\n")}

Port Recommendations:
Selected Port: ${result.portRecommendation?.recommended || "N/A"}
Rationale: ${result.portRecommendation?.rationale || "N/A"}
Alternative options: ${result.portRecommendation?.options.map(o => `${o.name} (Congestion: ${o.congestionScore}/100, Wait: ${o.waitDays}d, Cost: $${o.freightCost})`).join(", ")}

Route Optimization options:
${result.routes.map(r => `- ${r.method}: Cost: $${r.cost}, Transit: ${r.transitDays} days, Recommended: ${r.recommended}. Note: ${r.note}`).join("\n")}

Action Plan items:
${result.actionPlan.map(a => `- [${a.urgency.toUpperCase()}] ${a.action} (Deadline: ${a.deadline}). Rationale: ${a.why}`).join("\n")}

Cost Forecast (landed cost projections):
${result.costForecasts.map(c => `- ${c.horizonDays} days: Product Cost: ${c.productCostPct}%, Freight Cost: ${c.freightCostPct}%, Landed Cost: ${c.landedCostPct}%`).join("\n")}

Strict Guidelines:
1. ONLY answer questions related to this specific shipment and its analysis data.
2. If the user asks general questions unrelated to this shipment, politely redirect them back to the shipment analysis.
3. Be professional, concise, clear, and business-focused. Avoid overly verbose explanations.
4. Explain the "why" behind recommendations (e.g. why routing via a port or delaying ship dates reduces risk/cost) rather than just repeating numbers.
5. You can use standard markdown lists, bolding, and paragraphs for structure. Keep it clean and highly readable.`;

    let answer = "";
    let aiModelUsed = "Google Gemini";

    await aiContext.run({ modelUsed: "Google Gemini" }, async () => {
      answer = await chatCompletion({
        system: systemPrompt,
        messages: messages.slice(-10), // keep last 10 messages for context window efficiency
        fallback: "I apologize, but I am unable to connect to the reasoning models to analyze this request right now.",
      });
      aiModelUsed = getActiveModelUsed();
    });

    return NextResponse.json({ answer, aiModelUsed });
  } catch (err) {
    console.error("[copilot api] error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
