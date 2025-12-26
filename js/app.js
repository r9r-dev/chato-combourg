/**
 * Application principale Château Combo
 * PWA pour calculer les scores du jeu via analyse de photos
 */

import { CameraManager } from './camera.js';
import { ScoreCalculator, CATEGORIES } from './scoring.js';

// État de l'application
const state = {
  currentImage: null,
  isAnalyzing: false,
  deferredPrompt: null
};

// Instances des modules
let camera;
let scoreCalculator;

// Éléments DOM
const elements = {
  // Boutons
  startCameraBtn: null,
  captureBtn: null,
  retakeBtn: null,
  fileInput: null,
  calculateManualBtn: null,
  newScanBtn: null,
  shareBtn: null,
  installBtn: null,
  dismissInstallBtn: null,

  // Sections
  captureSection: null,
  analysisSection: null,
  resultsSection: null,
  manualSection: null,

  // Éléments d'affichage
  analysisStatus: null,
  scoreBreakdown: null,
  scoreValue: null,
  manualTotal: null,
  manualScoreValue: null,
  toast: null,
  offlineIndicator: null,
  installPrompt: null
};

/**
 * Initialisation de l'application
 */
async function init() {
  // Récupérer les éléments DOM
  initElements();

  // Initialiser les modules
  camera = new CameraManager();
  scoreCalculator = new ScoreCalculator();

  // Configurer les callbacks
  scoreCalculator.onStatusUpdate(updateAnalysisStatus);

  // Attacher les événements
  attachEventListeners();

  // Enregistrer le Service Worker
  await registerServiceWorker();

  // Vérifier le statut en ligne/hors-ligne
  checkOnlineStatus();

  console.log('Application Château Combo initialisée');
}

/**
 * Initialise les références aux éléments DOM
 */
function initElements() {
  elements.startCameraBtn = document.getElementById('start-camera-btn');
  elements.captureBtn = document.getElementById('capture-btn');
  elements.retakeBtn = document.getElementById('retake-btn');
  elements.fileInput = document.getElementById('file-input');
  elements.calculateManualBtn = document.getElementById('calculate-manual-btn');
  elements.newScanBtn = document.getElementById('new-scan-btn');
  elements.shareBtn = document.getElementById('share-btn');
  elements.installBtn = document.getElementById('install-btn');
  elements.dismissInstallBtn = document.getElementById('dismiss-install');

  elements.captureSection = document.getElementById('capture-section');
  elements.analysisSection = document.getElementById('analysis-section');
  elements.resultsSection = document.getElementById('results-section');
  elements.manualSection = document.getElementById('manual-section');

  elements.analysisStatus = document.getElementById('analysis-status');
  elements.scoreBreakdown = document.getElementById('score-breakdown');
  elements.scoreValue = document.getElementById('score-value');
  elements.manualTotal = document.getElementById('manual-total');
  elements.manualScoreValue = document.getElementById('manual-score-value');
  elements.toast = document.getElementById('toast');
  elements.offlineIndicator = document.getElementById('offline-indicator');
  elements.installPrompt = document.getElementById('install-prompt');
}

/**
 * Attache les gestionnaires d'événements
 */
function attachEventListeners() {
  // Boutons de caméra
  elements.startCameraBtn.addEventListener('click', handleStartCamera);
  elements.captureBtn.addEventListener('click', handleCapture);
  elements.retakeBtn.addEventListener('click', handleRetake);

  // Import de fichier
  elements.fileInput.addEventListener('change', handleFileInput);

  // Calcul manuel
  elements.calculateManualBtn.addEventListener('click', handleManualCalculate);

  // Actions sur les résultats
  elements.newScanBtn.addEventListener('click', handleNewScan);
  elements.shareBtn.addEventListener('click', handleShare);

  // Installation PWA
  elements.installBtn.addEventListener('click', handleInstall);
  elements.dismissInstallBtn.addEventListener('click', dismissInstallPrompt);

  // Événements système
  window.addEventListener('online', () => updateOnlineStatus(true));
  window.addEventListener('offline', () => updateOnlineStatus(false));
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
}

/**
 * Démarre la caméra
 */
async function handleStartCamera() {
  try {
    elements.startCameraBtn.disabled = true;
    elements.startCameraBtn.textContent = 'Chargement...';

    await camera.startCamera();

    elements.startCameraBtn.style.display = 'none';
    elements.captureBtn.disabled = false;
    elements.captureBtn.style.display = '';

    showToast('Caméra activée');
  } catch (error) {
    showToast(error.message, 'error');
    elements.startCameraBtn.disabled = false;
    elements.startCameraBtn.innerHTML = '<span class="icon">📷</span> Activer la caméra';
  }
}

/**
 * Capture une photo
 */
function handleCapture() {
  try {
    state.currentImage = camera.capturePhoto();

    elements.captureBtn.style.display = 'none';
    elements.retakeBtn.style.display = '';

    showToast('Photo capturée !');

    // Lancer l'analyse automatiquement
    startAnalysis();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Reprend une photo
 */
async function handleRetake() {
  camera.reset();
  state.currentImage = null;

  elements.retakeBtn.style.display = 'none';
  elements.captureBtn.style.display = 'none';
  elements.startCameraBtn.style.display = '';
  elements.startCameraBtn.disabled = false;
  elements.startCameraBtn.innerHTML = '<span class="icon">📷</span> Activer la caméra';

  elements.resultsSection.style.display = 'none';
  elements.analysisSection.style.display = 'none';

  await handleStartCamera();
}

/**
 * Gère l'import d'un fichier image
 */
async function handleFileInput(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    state.currentImage = await camera.loadFromFile(file);

    elements.startCameraBtn.style.display = 'none';
    elements.captureBtn.style.display = 'none';
    elements.retakeBtn.style.display = '';

    showToast('Image chargée !');

    // Lancer l'analyse automatiquement
    startAnalysis();
  } catch (error) {
    showToast(error.message, 'error');
  }

  // Reset l'input pour permettre de recharger le même fichier
  event.target.value = '';
}

/**
 * Démarre l'analyse de l'image
 */
async function startAnalysis() {
  if (!state.currentImage || state.isAnalyzing) return;

  state.isAnalyzing = true;
  elements.analysisSection.style.display = 'block';
  elements.resultsSection.style.display = 'none';

  try {
    const result = await scoreCalculator.analyzeImage(state.currentImage);
    displayResults(result);
  } catch (error) {
    showToast('Erreur lors de l\'analyse : ' + error.message, 'error');
    elements.analysisSection.style.display = 'none';
  } finally {
    state.isAnalyzing = false;
  }
}

/**
 * Met à jour le statut d'analyse
 */
function updateAnalysisStatus(status) {
  if (elements.analysisStatus) {
    elements.analysisStatus.textContent = status;
  }
}

/**
 * Affiche les résultats de l'analyse
 */
function displayResults(result) {
  elements.analysisSection.style.display = 'none';
  elements.resultsSection.style.display = 'block';

  // Afficher le détail des scores
  elements.scoreBreakdown.innerHTML = result.breakdown.map(category => `
    <div class="score-row">
      <div class="category">
        <span class="category-icon">${category.icon}</span>
        <span class="category-name">${category.name}</span>
      </div>
      <span class="points">${category.score}</span>
    </div>
  `).join('');

  // Afficher le score total avec animation
  animateScore(elements.scoreValue, result.total);

  // Afficher le niveau de confiance si disponible
  if (result.confidence) {
    showToast(result.confidence.message);
  }
}

/**
 * Anime l'affichage d'un score
 */
function animateScore(element, target) {
  const duration = 1000;
  const start = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);

    // Easing ease-out
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (target - startValue) * easeOut);

    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Calcule le score manuellement
 */
function handleManualCalculate() {
  const manualScores = {
    chateaux: document.getElementById('chateaux-score').value,
    jardins: document.getElementById('jardins-score').value,
    tours: document.getElementById('tours-score').value,
    maisons: document.getElementById('maisons-score').value,
    bonus: document.getElementById('bonus-score').value
  };

  const result = scoreCalculator.calculateManual(manualScores);

  elements.manualTotal.style.display = 'flex';
  animateScore(elements.manualScoreValue, result.total);

  showToast(`Score total : ${result.total} points`);
}

/**
 * Démarre une nouvelle analyse
 */
function handleNewScan() {
  handleRetake();
  elements.resultsSection.style.display = 'none';

  // Scroll vers le haut
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Partage les résultats
 */
async function handleShare() {
  const total = elements.scoreValue.textContent;

  const shareData = {
    title: 'Château Combo - Mon Score',
    text: `J'ai obtenu ${total} points à Château Combo ! 🏰`,
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      showToast('Résultat partagé !');
    } catch (error) {
      if (error.name !== 'AbortError') {
        // Fallback : copier dans le presse-papier
        copyToClipboard(shareData.text);
      }
    }
  } else {
    // Fallback : copier dans le presse-papier
    copyToClipboard(shareData.text);
  }
}

/**
 * Copie du texte dans le presse-papier
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copié dans le presse-papier !');
  } catch {
    showToast('Impossible de copier', 'error');
  }
}

/**
 * Gère l'événement beforeinstallprompt
 */
function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  state.deferredPrompt = event;
  elements.installPrompt.style.display = 'flex';
}

/**
 * Installe la PWA
 */
async function handleInstall() {
  if (!state.deferredPrompt) return;

  state.deferredPrompt.prompt();
  const { outcome } = await state.deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    showToast('Application installée !');
  }

  state.deferredPrompt = null;
  elements.installPrompt.style.display = 'none';
}

/**
 * Ferme l'invite d'installation
 */
function dismissInstallPrompt() {
  elements.installPrompt.style.display = 'none';
}

/**
 * Enregistre le Service Worker
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker enregistré:', registration.scope);

      // Vérifier les mises à jour
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Nouvelle version disponible ! Rafraîchissez la page.');
          }
        });
      });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du Service Worker:', error);
    }
  }
}

/**
 * Vérifie le statut en ligne initial
 */
function checkOnlineStatus() {
  updateOnlineStatus(navigator.onLine);
}

/**
 * Met à jour l'indicateur de statut en ligne
 */
function updateOnlineStatus(isOnline) {
  elements.offlineIndicator.style.display = isOnline ? 'none' : 'block';
  if (!isOnline) {
    showToast('Mode hors-ligne activé');
  }
}

/**
 * Affiche une notification toast
 */
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type}`;

  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', init);
