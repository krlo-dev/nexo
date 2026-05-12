const generateEmbedding = async (text) => {
  const res = await fetch(`${process.env.OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });
  const data = await res.json();
  return data.embedding;
};

const buildStoreText = (store) =>
  `${store.name} ${store.category} ${(store.tags || []).join(' ')} ${store.description || ''}`.trim();

module.exports = { generateEmbedding, buildStoreText };
