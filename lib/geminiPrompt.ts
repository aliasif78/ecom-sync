export const getGeminiPrompt = (products: string) => `
Context: You are a high-precision Supply Chain Analytics Engine.
Task: Identify "High-Risk" stockouts where current inventory will be depleted in < 7 days.

Data Input (JSON): 
${products}

Constraints:
1. Calculation: Risk = (stock / recentSalesVelocity).
2. If recentSalesVelocity is 0, the risk is 0 (Ignore these).
3. Return ONLY a valid JSON array of strings.
4. No markdown formatting (no \`\`\`json blocks).
5. No conversational text.

Example Output:
["65af...123", "65af...456"]

Final Directive: If no products meet the criteria, return an empty array [].
`;
