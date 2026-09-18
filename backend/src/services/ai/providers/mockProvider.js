async function invoke({ userMessage }) {
  return {
    raw: {
      summary: 'Mock summary generated without calling a real AI provider.',
      category: 'other',
      confidence: 0.5,
    },
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

module.exports = { invoke };
