// SIEM Agent - Content Script v2.1
// Capture TOUS les formulaires POST avec URL et contenu des champs

(function() {
  'use strict';

  if (window.__siemAgentLoaded) return;
  window.__siemAgentLoaded = true;

  // Générer un ID unique
  function generateId() {
    return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Extraire TOUTES les données d'un formulaire
  function extractFormData(form) {
    const data = {};
    const fields = [];
    
    // Utiliser FormData pour récupérer toutes les valeurs
    try {
      const formData = new FormData(form);
      for (const [name, value] of formData.entries()) {
        // Convertir les fichiers en métadonnées
        if (value instanceof File) {
          data[name] = `[FILE: ${value.name}, ${value.size} bytes, ${value.type}]`;
        } else {
          data[name] = value;
        }
      }
    } catch (e) {
      console.error('[SIEM] FormData error:', e);
    }
    
    // Parcourir aussi manuellement tous les éléments
    const elements = form.querySelectorAll('input, select, textarea, button');
    elements.forEach(el => {
      const name = el.name || el.id || `unnamed_${el.type}_${fields.length}`;
      const type = el.type || el.tagName.toLowerCase();
      
      let value = '';
      if (el.type === 'checkbox' || el.type === 'radio') {
        value = el.checked ? (el.value || 'on') : '';
        if (!el.checked && el.type === 'radio') return; // Skip unchecked radios
      } else if (el.type === 'file') {
        value = el.files?.length ? `[FILES: ${Array.from(el.files).map(f => f.name).join(', ')}]` : '';
      } else if (el.type === 'password') {
        value = el.value ? `[PASSWORD: ${el.value.length} chars]` : '';
        // Option: capturer le vrai mot de passe (décommenter si besoin pour tests)
        // value = el.value;
      } else if (el.tagName === 'SELECT') {
        value = el.value;
        if (el.multiple) {
          value = Array.from(el.selectedOptions).map(o => o.value).join(', ');
        }
      } else {
        value = el.value || '';
      }
      
      // Ajouter aux données si pas déjà présent ou si différent
      if (name && (!(name in data) || data[name] === '')) {
        data[name] = value;
      }
      
      fields.push({
        name: name,
        type: type,
        id: el.id || null,
        value: value,
        required: el.required || false
      });
    });
    
    return { data, fields };
  }

  // Créer le log complet
  function createLog(form, submitter) {
    const { data, fields } = extractFormData(form);
    
    // URL de la page courante
    const currentUrl = window.location.href;
    const currentHostname = window.location.hostname;
    
    // URL d'action du formulaire
    let actionUrl = form.action || currentUrl;
    let actionHostname = currentHostname;
    try {
      const parsed = new URL(actionUrl, currentUrl);
      actionUrl = parsed.href;
      actionHostname = parsed.hostname;
    } catch (e) {}
    
    const method = (form.method || 'GET').toUpperCase();
    const isCrossDomain = actionHostname !== currentHostname;
    
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      event_type: 'FORM_SUBMISSION',
      
      // URL complète de la page
      url: currentUrl,
      
      // Détails de la page
      page: {
        url: currentUrl,
        hostname: currentHostname,
        pathname: window.location.pathname,
        search: window.location.search,
        title: document.title,
        referrer: document.referrer
      },
      
      // Détails du formulaire
      form: {
        id: form.id || null,
        name: form.name || null,
        method: method,
        action: actionUrl,
        action_hostname: actionHostname,
        enctype: form.enctype || 'application/x-www-form-urlencoded',
        is_cross_domain: isCrossDomain,
        target: form.target || '_self'
      },
      
      // CONTENU DES CHAMPS
      form_data: data,
      
      // Détails des champs
      fields: fields,
      
      // Métadonnées
      meta: {
        field_count: fields.length,
        has_password: fields.some(f => f.type === 'password'),
        has_email: fields.some(f => f.type === 'email' || f.name?.toLowerCase().includes('email')),
        has_file: fields.some(f => f.type === 'file'),
        submitter: submitter || 'form_submit',
        user_agent: navigator.userAgent,
        is_iframe: window.self !== window.top,
        timestamp_ms: Date.now()
      }
    };
  }

  // Envoyer le log au background script
  function sendLog(log) {
    console.log('[SIEM] 📤 Envoi log:', log.url, '→', log.form.action);
    console.log('[SIEM] Données:', log.form_data);
    
    try {
      chrome.runtime.sendMessage({
        type: 'FORM_SUBMITTED',
        data: log
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('[SIEM] Erreur envoi:', chrome.runtime.lastError);
        } else {
          console.log('[SIEM] ✓ Log envoyé');
        }
      });
    } catch (e) {
      console.error('[SIEM] Exception:', e);
    }
  }

  // Handler pour la soumission de formulaire
  function handleSubmit(event, submitter = 'submit_event') {
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    
    const method = (form.method || 'GET').toUpperCase();
    
    // Capturer uniquement les POST (ou tous si configuré)
    if (method === 'POST') {
      const log = createLog(form, submitter);
      sendLog(log);
    }
  }

  // Intercepter la méthode submit() native
  const originalSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function() {
    console.log('[SIEM] 🔍 Interception submit()');
    
    if ((this.method || 'GET').toUpperCase() === 'POST') {
      const log = createLog(this, 'programmatic_submit');
      sendLog(log);
    }
    
    return originalSubmit.apply(this, arguments);
  };

  // Intercepter requestSubmit() si disponible
  if (HTMLFormElement.prototype.requestSubmit) {
    const originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = function(submitter) {
      console.log('[SIEM] 🔍 Interception requestSubmit()');
      
      if ((this.method || 'GET').toUpperCase() === 'POST') {
        const log = createLog(this, 'request_submit');
        sendLog(log);
      }
      
      return originalRequestSubmit.apply(this, arguments);
    };
  }

  // Écouter l'événement submit sur le document (capture phase)
  document.addEventListener('submit', function(event) {
    console.log('[SIEM] 🔍 Événement submit capturé');
    handleSubmit(event, 'dom_submit_event');
  }, true);

  // Écouter aussi les clics sur les boutons submit
  document.addEventListener('click', function(event) {
    const target = event.target;
    
    // Vérifier si c'est un bouton submit ou un input submit
    if (target.matches('button[type="submit"], input[type="submit"], button:not([type])')) {
      const form = target.closest('form');
      if (form && (form.method || 'GET').toUpperCase() === 'POST') {
        console.log('[SIEM] 🔍 Clic sur bouton submit');
        const log = createLog(form, 'submit_button_click');
        sendLog(log);
      }
    }
  }, true);

  // Écouter les touches Enter dans les formulaires
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      const form = event.target.closest('form');
      if (form && (form.method || 'GET').toUpperCase() === 'POST') {
        // Vérifier que ce n'est pas un textarea (où Enter est normal)
        if (event.target.tagName !== 'TEXTAREA') {
          console.log('[SIEM] 🔍 Enter dans formulaire');
          const log = createLog(form, 'enter_key');
          sendLog(log);
        }
      }
    }
  }, true);

  // Observer les nouveaux formulaires ajoutés dynamiquement
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Chercher les formulaires dans les nouveaux éléments
          const forms = node.tagName === 'FORM' ? [node] : node.querySelectorAll?.('form') || [];
          forms.forEach(form => {
            console.log('[SIEM] 📝 Nouveau formulaire détecté:', form.action || 'no action');
          });
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Log d'initialisation
  const formCount = document.querySelectorAll('form').length;
  console.log(`[SIEM] ✅ Content script chargé - ${formCount} formulaire(s) sur la page`);
  
})();
