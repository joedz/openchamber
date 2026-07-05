export function registerQuotaRoutes(app, { getQuotaProviders }) {
  // INTERNAL-NETWORK: quota dashboard disabled. No outbound vendor usage
  // queries (Anthropic / OpenAI / Copilot / Cursor / Ollama Cloud /
  // OpenRouter / Kimi / Z.ai / Zhipu / NanoGPT / Minimax / Wafer / Google)
  // ever fire.
  const quotaDisabled = (_req, res) => {
    return res.status(404).json({
      error: 'Quota dashboard is disabled in this deployment',
      disabled: true,
    });
  };
  app.get('/api/quota/providers', quotaDisabled);
  app.get('/api/quota/:providerId', quotaDisabled);
}
