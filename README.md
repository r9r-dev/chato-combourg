# Chateau Combo - Calculateur de Score

PWA (Progressive Web App) pour calculer automatiquement les scores du jeu de cartes Chateau Combo.

## Fonctionnalites

- Capture photo via camera du telephone ou webcam
- Analyse automatique de l'image pour detecter les elements de jeu
- Calcul automatique du score
- Mode manuel pour entrer les scores directement
- Fonctionne hors-ligne grace au Service Worker
- Installable sur mobile (PWA)

## Installation

```bash
npm install
```

## Demarrage

```bash
npm start
```

Puis ouvrir http://localhost:8080 dans votre navigateur.

## Generation des icones

```bash
npm run generate-icons
```

## Structure du projet

```
├── index.html          # Page principale
├── manifest.json       # Configuration PWA
├── sw.js              # Service Worker
├── css/
│   └── style.css      # Styles
├── js/
│   ├── app.js         # Application principale
│   ├── camera.js      # Gestion de la camera
│   └── scoring.js     # Calcul des scores
├── icons/             # Icones PWA
└── scripts/
    └── generate-icons.js  # Script de generation d'icones
```

## Utilisation

1. Ouvrez l'application dans votre navigateur
2. Cliquez sur "Activer la camera" ou "Importer une image"
3. Prenez une photo de votre plateau de jeu
4. L'application analysera l'image et calculera le score
5. Vous pouvez aussi utiliser le mode manuel pour entrer les scores directement

## Technologies

- HTML5, CSS3, JavaScript (ES6+)
- Progressive Web App (PWA)
- Service Worker pour le mode offline
- API MediaDevices pour la capture camera
