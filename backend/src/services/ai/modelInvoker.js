const anthropicProvider = require('./providers/anthropicProvider');
const mockProvider = require('./providers/mockProvider');

function getProvider() {
  const providerName = process.env.LLM_PROVIDER || 'anthropic';
  return providerName === 'mock' ? mockProvider : anthropicProvider;
}

async function invoke(promptPackage) {
  const provider = getProvider();
  return provider.invoke(promptPackage);
}

module.exports = { invoke };
