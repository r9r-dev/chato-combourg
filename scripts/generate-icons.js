/**
 * Script de génération des icônes PWA
 * Génère les icônes en différentes tailles pour le manifest
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'icons');

// Créer le dossier icons s'il n'existe pas
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function drawIcon(ctx, size) {
  // Fond dégradé
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#8B4513');
  gradient.addColorStop(1, '#5D2E0C');

  // Arrondi du fond
  const radius = size * 0.15;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Échelle
  const s = size / 512;

  // Couleur château
  const castleGradient = ctx.createLinearGradient(0, 0, 0, size);
  castleGradient.addColorStop(0, '#D4A574');
  castleGradient.addColorStop(1, '#C49A6C');

  ctx.fillStyle = castleGradient;

  // Base du château
  ctx.fillRect(120 * s, 280 * s, 272 * s, 160 * s);

  // Tours latérales
  ctx.fillRect(100 * s, 200 * s, 60 * s, 240 * s);
  ctx.fillRect(352 * s, 200 * s, 60 * s, 240 * s);

  // Créneaux tour gauche
  ctx.fillRect(95 * s, 180 * s, 20 * s, 30 * s);
  ctx.fillRect(120 * s, 180 * s, 20 * s, 30 * s);
  ctx.fillRect(145 * s, 180 * s, 20 * s, 30 * s);

  // Créneaux tour droite
  ctx.fillRect(347 * s, 180 * s, 20 * s, 30 * s);
  ctx.fillRect(372 * s, 180 * s, 20 * s, 30 * s);
  ctx.fillRect(397 * s, 180 * s, 20 * s, 30 * s);

  // Tour principale
  ctx.fillRect(206 * s, 140 * s, 100 * s, 300 * s);

  // Créneaux tour principale
  ctx.fillRect(196 * s, 115 * s, 25 * s, 35 * s);
  ctx.fillRect(226 * s, 115 * s, 25 * s, 35 * s);
  ctx.fillRect(256 * s, 115 * s, 25 * s, 35 * s);
  ctx.fillRect(286 * s, 115 * s, 25 * s, 35 * s);

  // Fenêtres (marron foncé)
  ctx.fillStyle = '#5D2E0C';

  // Fenêtre principale haute - cercle en haut, rectangle en bas
  ctx.beginPath();
  ctx.arc(256 * s, 220 * s, 20 * s, Math.PI, 0);
  ctx.lineTo(276 * s, 250 * s);
  ctx.lineTo(236 * s, 250 * s);
  ctx.closePath();
  ctx.fill();

  // Fenêtre principale basse
  ctx.beginPath();
  ctx.arc(256 * s, 300 * s, 20 * s, Math.PI, 0);
  ctx.lineTo(276 * s, 330 * s);
  ctx.lineTo(236 * s, 330 * s);
  ctx.closePath();
  ctx.fill();

  // Fenêtres tours
  ctx.beginPath();
  ctx.arc(130 * s, 260 * s, 15 * s, Math.PI, 0);
  ctx.lineTo(145 * s, 290 * s);
  ctx.lineTo(115 * s, 290 * s);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(382 * s, 260 * s, 15 * s, Math.PI, 0);
  ctx.lineTo(397 * s, 290 * s);
  ctx.lineTo(367 * s, 290 * s);
  ctx.closePath();
  ctx.fill();

  // Porte (arc en haut)
  ctx.beginPath();
  ctx.arc(256 * s, 390 * s, 36 * s, Math.PI, 0);
  ctx.lineTo(292 * s, 440 * s);
  ctx.lineTo(220 * s, 440 * s);
  ctx.closePath();
  ctx.fill();

  // Mât du drapeau
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(254 * s, 70 * s, 4 * s, 55 * s);

  // Drapeau
  ctx.fillStyle = '#DC3545';
  ctx.beginPath();
  ctx.moveTo(258 * s, 70 * s);
  ctx.lineTo(258 * s, 100 * s);
  ctx.lineTo(290 * s, 85 * s);
  ctx.closePath();
  ctx.fill();

  // Score badge
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(410 * s, 410 * s, 60 * s, 0, Math.PI * 2);
  ctx.fill();

  // Bordure du badge
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 3 * s;
  ctx.stroke();

  // Texte score
  ctx.fillStyle = '#5D2E0C';
  ctx.font = `bold ${48 * s}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('42', 410 * s, 415 * s);
}

// Générer les icônes
sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  drawIcon(ctx, size);

  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(iconsDir, `icon-${size}.png`);

  fs.writeFileSync(filename, buffer);
  console.log(`Icône générée: ${filename}`);
});

console.log('\nToutes les icônes ont été générées avec succès !');
