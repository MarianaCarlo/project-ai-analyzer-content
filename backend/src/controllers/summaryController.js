const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

async function createSummary(req, res) {
  const { input_text } = req.body;

  if (!input_text) {
    return res.status(400).json({ error: 'input_text is required' });
  }

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO summaries (id, user_id, input_text)
       VALUES ($1, $2, $3)
       RETURNING id, input_text, summary, classification, created_at`,
      [id, req.user.id, input_text]
    );

    res.status(201).json(result.rows[0]);
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
