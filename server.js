require('dotenv').config();

const express = require('express');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();

const port = Number(process.env.PORT) || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Gemini content generator is running.'
  });
});

// Generate content
app.post('/api/generate', async (req, res) => {
  const {
    type = 'blog',
    topic = '',
    audience = 'general readers',
    tone = 'professional',
    keywords = '',
    length = 'medium'
  } = req.body || {};

  if (!topic.trim()) {
    return res.status(400).json({
      error: 'Please provide a topic or product name.'
    });
  }

  if (!apiKey || !ai) {
    return res.status(500).json({
      error: 'Gemini API key is missing. Add GEMINI_API_KEY to your .env file.'
    });
  }

  const contentLengthMap = {
    short: '500-700 words',
    medium: '800-1100 words',
    long: '1200-1500 words'
  };

  const prompt = buildPrompt({
    type,
    topic,
    audience,
    tone,
    keywords,
    length: contentLengthMap[length] || '800-1100 words'
  });

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a professional content strategist and copywriter. Write clear, engaging, original content suitable for a blog post or product description. Keep it readable and helpful.',
          temperature: 0.8
        }
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini request timed out after 60 seconds. Check your API key, model name, and internet connection.')), 60000);
      })
    ]);

    const content = response.text?.trim();

    if (!content) {
      return res.status(500).json({
        error: 'The Gemini model returned an empty response.'
      });
    }

    return res.json({ content });

  } catch (error) {
    console.error('Gemini request failed:', error);

    const status = error?.status || error?.code;
    const detail = status ? ` (${status})` : '';

    return res.status(500).json({
      error: `${error?.message || 'The Gemini request failed. Please verify your API key and model access.'}${detail}`
    });
  }
});

// Build prompt
function buildPrompt({
  type,
  topic,
  audience,
  tone,
  keywords,
  length
}) {
  const keywordBlock = keywords
    ? `Include these keywords naturally: ${keywords}.`
    : 'Use relevant, high-quality keywords naturally.';

  if (type === 'product') {
    return `
Write a persuasive product description for: ${topic}.

Audience: ${audience}.
Tone: ${tone}.
Target length: ${length}.

${keywordBlock}

Include:
- A compelling product title
- Short introduction
- Key benefits
- Feature highlights
- Strong call to action

Keep the copy truthful, easy to scan, and conversion-focused.
`;
  }

  return `
Write a high-quality blog post about: ${topic}.

Audience: ${audience}.
Tone: ${tone}.
Target length: ${length}.

${keywordBlock}

Include:
- Catchy title
- Engaging introduction
- Structured sections with subheadings
- Useful insights
- Conclusion

Make it informative, unique, readable, and polished.
`;
}

// Frontend fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const startServer = (currentPort) => {
  const server = app.listen(currentPort, () => {
    console.log(
      `Gemini content generator is running at http://localhost:${currentPort}`
    );
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = currentPort + 1;

      console.warn(
        `Port ${currentPort} is busy. Retrying on ${fallbackPort}.`
      );

      startServer(fallbackPort);
      return;
    }

    throw error;
  });
};

startServer(port);