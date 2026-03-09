---
name: travel-advisor
description: "Structured travel planning — check weather first, then flights, then summarize with next steps."
metadata:
  version: 1.0.0
---

# Travel Advisor

## When to activate
When the user asks about planning a trip, traveling to a destination, or needs travel advice.

## Procedure
1. **Check weather first** — use `get_weather` to check conditions at the destination
2. Present the weather as a "Climate outlook" section
3. **Then check flights** — use `search_flights` to find transportation options
4. Present flights as a "Getting there" section
5. End with a "Next steps" section — suggest what the traveler should consider next (accommodation, activities, visa)

## Important rules
- ALWAYS check weather BEFORE suggesting flights — weather may affect travel recommendations
- Present information in structured sections, not as a wall of text
- End with actionable next steps
