const form = document.getElementById('generator-form');
const statusBox = document.getElementById('status');
const resultBox = document.getElementById('result');
const typeSelect = document.getElementById('type');
const copyBtn = document.getElementById('copy-btn');
const apiUrls = window.location.protocol === 'file:'
  ? Array.from({ length: 6 }, (_, index) => `http://localhost:${3000 + index}/api/generate`)
  : ['/api/generate'];

const setStatus = (message, tone = 'info') => {
  statusBox.textContent = message;
  statusBox.className = `status ${tone}`;
};

typeSelect.addEventListener('change', () => {
  const type = typeSelect.value;
  const topicInput = document.getElementById('topic');
  const label = type === 'product' ? 'Product name' : 'Topic';
  topicInput.placeholder = type === 'product'
    ? 'e.g. EcoClean Water Bottle'
    : 'e.g. Sustainable remote work tips';
  topicInput.setAttribute('aria-label', label);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    type: formData.get('type'),
    topic: formData.get('topic').toString().trim(),
    audience: formData.get('audience').toString().trim() || 'general readers',
    tone: formData.get('tone').toString().trim(),
    keywords: formData.get('keywords').toString().trim(),
    length: formData.get('length').toString().trim() || 'medium'
  };

  if (!payload.topic) {
    setStatus('Please add a topic or product name.', 'error');
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Generating...';
  setStatus('Creating your content...', 'success');
  resultBox.textContent = 'Working on it...';

  try {
    let response;
    let lastError;

    for (const apiUrl of apiUrls) {
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) {
      throw lastError || new Error('Unable to connect to the server.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong while generating content.');
    }

    resultBox.textContent = data.content;
    setStatus('Content generated successfully.', 'success');
  } catch (error) {
    resultBox.textContent = 'Unable to generate content right now.';
    setStatus(
      error instanceof TypeError
        ? 'Cannot connect to the server. Run npm start and open http://localhost:3000.'
        : error.message,
      'error'
    );
  } finally {
    button.disabled = false;
    button.textContent = 'Generate content';
  }
});

copyBtn.addEventListener('click', async () => {
  const text = resultBox.textContent.trim();
  if (!text || text.includes('Your generated content will appear here')) {
    setStatus('There is no content to copy yet.', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied to clipboard.', 'success');
  } catch (error) {
    setStatus('Copy failed. You can still select the text manually.', 'error');
  }
});
