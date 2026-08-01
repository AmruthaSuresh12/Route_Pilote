# Route Pilote 🧭  
### A Bloomberg Terminal for your supply chain.

Route Pilote is an AI-powered supply chain risk intelligence platform that predicts freight delays, cost spikes, and disruption risks before they impact a shipment.

It combines a fleet of AI agents, live web intelligence, and natural-language interaction to help users analyze shipments, compare alternatives, receive proactive alerts, and ask follow-up questions in real time.

[🌐 Live Demo](https://route-pilote.vercel.app)  
[🎥 1-Minute Tutorial Video](https://github.com/user-attachments/assets/e8b4c563-fa34-498a-ae57-084f8446a034)


---

## 📽️ 1-Minute Tutorial Video

> Replace this with your actual GitHub-hosted or YouTube video link.

[https://github.com/your-username/your-repo/assets/your-video-file](https://github.com/user-attachments/assets/e8b4c563-fa34-498a-ae57-084f8446a034)

---

## ✨ What Route Pilote Does

Route Pilote turns a shipment into an AI-driven decision workflow:

- **Analyze a shipment** using natural language
- **Run 12 specialized AI agents** in parallel
- **Use live web intelligence** for freight, port, weather, tariff, and commodity signals
- **Generate a risk score, cost forecast, delay forecast, and action plan**
- **Warn users proactively** with an AI Predictive Alert Center
- **Let users compare alternatives** with a What-If Scenario Simulator
- **Answer follow-up questions** through the AI Shipment Copilot

---

## 🚀 Core Features

### 1) Multi-Agent Risk Analysis
Route Pilote uses specialized agents to study:
- Product & material breakdown
- Commodity pricing
- Freight rates
- Port congestion
- Weather disruption
- Geopolitical risk
- Supplier health
- Regulatory and tariff changes

### 2) AI Predictive Alert Center
Users receive proactive alerts when risk changes meaningfully, with:
- severity indicators
- reasons for the alert
- suggested actions
- auto-reroute support
- alert history

### 3) What-If Scenario Simulator
Users can compare alternate shipment decisions without redoing the analysis:
- change shipping mode
- change destination port
- change departure date
- compare cost vs delay vs risk
- identify the best option

### 4) AI Shipment Copilot
Users can ask questions about the current shipment, such as:
- Why is risk high?
- Why was this port recommended?
- How can cost be reduced?
- What is the biggest risk?
- Summarize the shipment in simple language

### 5) Live Intelligence & Transparent Reasoning
Every result is backed by live web research and source-aware analysis, making the system explainable and easy to trust.

---

## 🧠 How It Works

```text
Shipment Input
   ↓
Conversational Intake
   ↓
12 AI Agents
   ↓
Live Web Intelligence (Tavily)
   ↓
Gemini / Mistral Reasoning
   ↓
Risk Engine + Forecasts
   ↓
Dashboard + Alerts + Copilot + Scenarios


🛠️ Tech Stack
Frontend: Next.js 16, React 19, TypeScript
Styling: Tailwind CSS v4
Charts: Recharts
Maps: Leaflet
Motion: Framer Motion
AI: Google Gemini, Mistral fallback
Search Intelligence: Tavily
Deployment: Vercel


📁 Project Structure
src/
  app/
    api/
      analyze/
      copilot/
      parse/
    globals.css
    layout.tsx
    page.tsx
  components/
    AgentConsole.tsx
    AlertCenter.tsx
    AnalyzeForm.tsx
    Dashboard.tsx
    DependencyGraph.tsx
    Header.tsx
    IntakeChat.tsx
    RouteMap.tsx
    ScenarioSimulator.tsx
    ShipmentCopilot.tsx
  lib/
    agents.ts
    drivers.ts
    geo.ts
    openai.ts
    orchestrator.ts
    tavily.ts
    types.ts
    utils.ts



▶️ Run Locally
git clone https://github.com/Ruchit0807/Route-Pilote.git
cd Route-Pilote
npm install
npm run dev

Open:
http://localhost:3000



🔑 Environment Variables

Create a .env.local file and add:

Variable	            Purpose
GEMINI_API_KEY	      Primary AI reasoning model
GEMINI_MODEL	        Optional Gemini model name
MISTRAL_API_KEY	      Backup AI reasoning model
MISTRAL_MODEL	        Optional Mistral model name
TAVILY_API_KEY	      Live web search and extraction
TAVILY_SEARCH_DEPTH	  Search depth setting


🎯 Why This Project Stands Out

Most logistics tools only tell you where a shipment is.

Route Pilote tells you:

what is likely to go wrong
why it is happening
how much it may cost
how long it may delay the shipment
what action to take next

That makes it a predictive supply chain intelligence system, not just a tracking dashboard.


🔮 Future Roadmap
Continuous shipment monitoring
Portfolio risk dashboard
Exportable executive reports
Smarter alert automation
Expanded scenario comparisons


📄 License

This project is built for hackathon/demo use.
