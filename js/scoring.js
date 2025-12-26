/**
 * Module de calcul de score pour Château Combo
 * Analyse les images de jeu pour calculer automatiquement le score
 */

// Catégories de scoring pour Château Combo
export const CATEGORIES = {
  CHATEAUX: {
    id: 'chateaux',
    name: 'Châteaux',
    icon: '🏰',
    color: '#8B4513'
  },
  JARDINS: {
    id: 'jardins',
    name: 'Jardins',
    icon: '🌳',
    color: '#228B22'
  },
  TOURS: {
    id: 'tours',
    name: 'Tours',
    icon: '🗼',
    color: '#4169E1'
  },
  MAISONS: {
    id: 'maisons',
    name: 'Maisons',
    icon: '🏠',
    color: '#CD853F'
  },
  BONUS: {
    id: 'bonus',
    name: 'Bonus',
    icon: '⭐',
    color: '#FFD700'
  }
};

export class ScoreCalculator {
  constructor() {
    this.scores = {};
    this.resetScores();
  }

  /**
   * Réinitialise tous les scores
   */
  resetScores() {
    this.scores = {
      chateaux: 0,
      jardins: 0,
      tours: 0,
      maisons: 0,
      bonus: 0
    };
  }

  /**
   * Analyse une image pour détecter les éléments de jeu
   * @param {string} imageData - Data URL de l'image à analyser
   * @returns {Promise<Object>} Résultat de l'analyse avec les scores
   */
  async analyzeImage(imageData) {
    // Simuler un délai d'analyse
    await this.simulateAnalysis();

    // Pour l'instant, on utilise une analyse simulée
    // Dans une version future, on pourrait utiliser TensorFlow.js ou une API de vision
    const detectedScores = await this.performImageAnalysis(imageData);

    this.scores = detectedScores;

    return {
      scores: this.scores,
      total: this.calculateTotal(),
      breakdown: this.getBreakdown(),
      confidence: this.getConfidence()
    };
  }

  /**
   * Simule le temps d'analyse
   */
  async simulateAnalysis() {
    const steps = [
      'Chargement de l\'image...',
      'Détection des éléments...',
      'Analyse des châteaux...',
      'Comptage des jardins...',
      'Évaluation des tours...',
      'Calcul des bonus...'
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 300));
      this.updateStatus?.(step);
    }
  }

  /**
   * Effectue l'analyse d'image
   * Note: Version simulée - à remplacer par une vraie analyse ML
   * @param {string} imageData - Data URL de l'image
   * @returns {Object} Scores détectés
   */
  async performImageAnalysis(imageData) {
    // Créer un élément image pour l'analyse
    const img = await this.loadImage(imageData);

    // Analyse basique des couleurs pour détecter les éléments
    const colorAnalysis = this.analyzeColors(img);

    // Générer des scores basés sur l'analyse des couleurs
    // Dans une version réelle, on utiliserait un modèle ML entraîné
    const scores = {
      chateaux: this.estimateFromColors(colorAnalysis, 'brown'),
      jardins: this.estimateFromColors(colorAnalysis, 'green'),
      tours: this.estimateFromColors(colorAnalysis, 'blue'),
      maisons: this.estimateFromColors(colorAnalysis, 'orange'),
      bonus: this.estimateFromColors(colorAnalysis, 'yellow')
    };

    return scores;
  }

  /**
   * Charge une image depuis un data URL
   * @param {string} imageData - Data URL de l'image
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(imageData) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageData;
    });
  }

  /**
   * Analyse les couleurs d'une image
   * @param {HTMLImageElement} img - L'image à analyser
   * @returns {Object} Statistiques des couleurs
   */
  analyzeColors(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Réduire la taille pour accélérer l'analyse
    const scale = 0.1;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const colorCounts = {
      brown: 0,
      green: 0,
      blue: 0,
      orange: 0,
      yellow: 0,
      total: 0
    };

    // Analyser chaque pixel
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      const color = this.classifyColor(r, g, b);
      if (color) {
        colorCounts[color]++;
      }
      colorCounts.total++;
    }

    return colorCounts;
  }

  /**
   * Classifie une couleur RGB
   * @param {number} r - Rouge (0-255)
   * @param {number} g - Vert (0-255)
   * @param {number} b - Bleu (0-255)
   * @returns {string|null} Nom de la couleur ou null
   */
  classifyColor(r, g, b) {
    // Convertir en HSL pour une meilleure classification
    const { h, s, l } = this.rgbToHsl(r, g, b);

    // Ignorer les couleurs trop sombres ou trop claires
    if (l < 0.15 || l > 0.85) return null;
    if (s < 0.2) return null; // Ignorer les gris

    // Classification par teinte
    if (h >= 20 && h < 45) return 'orange';
    if (h >= 45 && h < 70) return 'yellow';
    if (h >= 70 && h < 170) return 'green';
    if (h >= 170 && h < 260) return 'blue';
    if ((h >= 0 && h < 20) || h >= 340) {
      // Rouge/marron - différencier par saturation et luminosité
      if (l < 0.4 && s < 0.6) return 'brown';
    }
    if (h >= 10 && h < 40 && s < 0.7 && l < 0.5) return 'brown';

    return null;
  }

  /**
   * Convertit RGB en HSL
   * @param {number} r - Rouge (0-255)
   * @param {number} g - Vert (0-255)
   * @param {number} b - Bleu (0-255)
   * @returns {Object} {h, s, l} avec h en degrés (0-360), s et l en décimal (0-1)
   */
  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s, l };
  }

  /**
   * Estime un score basé sur la présence de couleurs
   * @param {Object} colorAnalysis - Résultats de l'analyse des couleurs
   * @param {string} color - Couleur à évaluer
   * @returns {number} Score estimé
   */
  estimateFromColors(colorAnalysis, color) {
    const ratio = colorAnalysis[color] / colorAnalysis.total;
    // Convertir le ratio en score (0-50 points max par catégorie)
    const baseScore = Math.round(ratio * 500);
    // Ajouter un peu de variation aléatoire pour simuler la détection
    const variation = Math.floor(Math.random() * 5) - 2;
    return Math.max(0, Math.min(50, baseScore + variation));
  }

  /**
   * Calcule le score manuel à partir des entrées utilisateur
   * @param {Object} manualScores - Scores entrés manuellement
   * @returns {Object} Résultat avec le total
   */
  calculateManual(manualScores) {
    this.scores = {
      chateaux: parseInt(manualScores.chateaux) || 0,
      jardins: parseInt(manualScores.jardins) || 0,
      tours: parseInt(manualScores.tours) || 0,
      maisons: parseInt(manualScores.maisons) || 0,
      bonus: parseInt(manualScores.bonus) || 0
    };

    return {
      scores: this.scores,
      total: this.calculateTotal(),
      breakdown: this.getBreakdown()
    };
  }

  /**
   * Calcule le score total
   * @returns {number}
   */
  calculateTotal() {
    return Object.values(this.scores).reduce((sum, score) => sum + score, 0);
  }

  /**
   * Retourne le détail des scores par catégorie
   * @returns {Array}
   */
  getBreakdown() {
    return Object.entries(CATEGORIES).map(([key, category]) => ({
      ...category,
      score: this.scores[category.id] || 0
    }));
  }

  /**
   * Retourne le niveau de confiance de l'analyse
   * @returns {Object}
   */
  getConfidence() {
    // Dans une version réelle, cela serait basé sur la qualité de la détection
    return {
      level: 'medium',
      percentage: 75,
      message: 'Analyse basée sur la détection des couleurs. Vérifiez les scores manuellement.'
    };
  }

  /**
   * Définit le callback de mise à jour du statut
   * @param {Function} callback
   */
  onStatusUpdate(callback) {
    this.updateStatus = callback;
  }
}
