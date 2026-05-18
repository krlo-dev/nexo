const { processMessage } = require('../services/agentService');

const agentChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.id;

    if (!message || message.trim().length < 1) {
      return res.json({ success: false, error: 'Mensaje vacío.' });
    }

    const result = await processMessage(userId, message.trim(), history);
    return res.json({ success: true, data: { response: result.response } });
  } catch {
    return res.json({ success: false, error: 'Error procesando el mensaje.' });
  }
};

module.exports = { agentChat };
