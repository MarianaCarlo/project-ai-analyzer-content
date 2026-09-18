function buildPrompt(template, userInput) {
  const sanitizedInput = String(userInput).slice(0, 5000); // hard cap, defense in depth

  return {
    system: template.systemPrompt,
    userMessage: `<user_content>\n${sanitizedInput}\n</user_content>`,
    model: template.model,
    maxTokens: template.maxTokens,
    promptVersion: template.version,
  };
}

module.exports = { buildPrompt };
