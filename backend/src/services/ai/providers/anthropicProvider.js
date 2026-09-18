const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const classifyTool = {
  name: 'submit_summary',
  description: 'Submit the summary and classification of the analyzed content.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'A concise 2-4 sentence summary.' },
      category: {
        type: 'string',
        enum: ['news', 'technical', 'personal', 'business', 'other'],
      },
      confidence: { type: 'number', description: 'Confidence score between 0 and 1.' },
    },
    required: ['summary', 'category', 'confidence'],
  },
};

async function invoke({ system, userMessage, model, maxTokens }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [classifyTool],
    tool_choice: { type: 'tool', name: 'submit_summary' },
  });

  const toolUseBlock = response.content.find((block) => block.type === 'tool_use');

  return {
    raw: toolUseBlock ? toolUseBlock.input : null,
    usage: response.usage,
  };
}

module.exports = { invoke };
