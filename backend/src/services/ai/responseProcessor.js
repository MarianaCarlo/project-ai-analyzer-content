const ALLOWED_CATEGORIES = ['news', 'technical', 'personal', 'business', 'other'];

function processResponse(modelOutput) {
  const raw = modelOutput && modelOutput.raw;

  if (!raw || typeof raw.summary !== 'string' || !ALLOWED_CATEGORIES.includes(raw.category)) {
    return {
      summary: 'Unable to generate a summary for this content.',
      category: 'other',
      confidence: 0,
    };
  }

  const confidence = typeof raw.confidence === 'number'
    ? Math.min(Math.max(raw.confidence, 0), 1)
    : 0;

  return {
    summary: raw.summary.trim(),
    category: raw.category,
    confidence,
  };
}

module.exports = { processResponse };
