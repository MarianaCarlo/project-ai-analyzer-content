const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const summarizeTemplate = require('../services/ai/prompts/summarize.v1');
const { buildPrompt } = require('../services/ai/promptBuilder');
const modelInvoker = require('../services/ai/modelInvoker');
const { processResponse } = require('../services/ai/responseProcessor');

async function createSummary(req, res) {
  const { input_text } = req.body;

  if (!input_text) {
    return res.status(400).json({ error: 'input_text is required' });
  }

  try {
    const promptPackage = buildPrompt(summarizeTemplate, input_text);
    const modelOutput = await modelInvoker.invoke(promptPackage);
    const result = processResponse(modelOutput);

    const id = uuidv4();
    const tokensUsed = modelOutput.usage
      ? (modelOutput.usage.input_tokens || 0) + (modelOutput.usage.output_tokens || 0)
      : 0;

    const dbResult = await pool.query(
      `INSERT INTO summaries (id, user_id, input_text, summary, classification, prompt_version, model, tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, input_text, summary, classification, created_at`,
      [
        id,
        req.user.id,
        input_text,
        result.summary,
        JSON.stringify({ category: result.category, confidence: result.confidence }),
        promptPackage.promptVersion,
        promptPackage.model,
        tokensUsed,
      ]
    );

    res.status(201).json(dbResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create summary' });
  }
}

async function getSummaries(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, input_text, summary, classification, created_at
       FROM summaries
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
}

module.exports = { createSummary, getSummaries };
