/**
 * Module de gestion de la caméra
 * Permet de capturer des photos via la webcam ou la caméra du téléphone
 */

export class CameraManager {
  constructor() {
    this.videoElement = document.getElementById('camera-preview');
    this.canvasElement = document.getElementById('photo-canvas');
    this.capturedPhotoElement = document.getElementById('captured-photo');
    this.stream = null;
    this.isStreaming = false;
  }

  /**
   * Démarre le flux vidéo de la caméra
   */
  async startCamera() {
    try {
      // Contraintes pour la caméra
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Préférer la caméra arrière
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;

      // Attendre que la vidéo soit prête
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          resolve();
        };
      });

      this.isStreaming = true;
      this.showVideo();

      return true;
    } catch (error) {
      console.error('Erreur d\'accès à la caméra:', error);
      throw this.handleCameraError(error);
    }
  }

  /**
   * Arrête le flux vidéo de la caméra
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isStreaming = false;
    this.videoElement.srcObject = null;
  }

  /**
   * Capture une photo depuis le flux vidéo
   * @returns {string} Data URL de l'image capturée
   */
  capturePhoto() {
    if (!this.isStreaming) {
      throw new Error('La caméra n\'est pas active');
    }

    const context = this.canvasElement.getContext('2d');

    // Définir les dimensions du canvas
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;

    // Dessiner l'image (en miroir horizontal pour correspondre à la prévisualisation)
    context.save();
    context.scale(-1, 1);
    context.drawImage(
      this.videoElement,
      -this.canvasElement.width,
      0,
      this.canvasElement.width,
      this.canvasElement.height
    );
    context.restore();

    // Convertir en data URL
    const imageData = this.canvasElement.toDataURL('image/jpeg', 0.9);

    // Afficher la photo capturée
    this.showCapturedPhoto(imageData);

    // Arrêter la caméra
    this.stopCamera();

    return imageData;
  }

  /**
   * Charge une image depuis un fichier
   * @param {File} file - Le fichier image à charger
   * @returns {Promise<string>} Data URL de l'image
   */
  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const imageData = e.target.result;
        this.showCapturedPhoto(imageData);
        resolve(imageData);
      };

      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Affiche le flux vidéo
   */
  showVideo() {
    this.videoElement.style.display = 'block';
    this.capturedPhotoElement.style.display = 'none';
  }

  /**
   * Affiche la photo capturée
   * @param {string} imageData - Data URL de l'image
   */
  showCapturedPhoto(imageData) {
    this.capturedPhotoElement.src = imageData;
    this.capturedPhotoElement.style.display = 'block';
    this.videoElement.style.display = 'none';
  }

  /**
   * Réinitialise l'affichage
   */
  reset() {
    this.stopCamera();
    this.capturedPhotoElement.style.display = 'none';
    this.capturedPhotoElement.src = '';
    this.videoElement.style.display = 'block';
  }

  /**
   * Gère les erreurs de caméra
   * @param {Error} error - L'erreur à traiter
   * @returns {Error} Erreur avec message utilisateur
   */
  handleCameraError(error) {
    let message = 'Une erreur est survenue avec la caméra.';

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message = 'Permission d\'accès à la caméra refusée. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      message = 'Aucune caméra trouvée sur cet appareil.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      message = 'La caméra est peut-être utilisée par une autre application.';
    } else if (error.name === 'OverconstrainedError') {
      message = 'Les contraintes de la caméra ne peuvent pas être satisfaites.';
    } else if (error.name === 'TypeError') {
      message = 'Erreur de configuration de la caméra.';
    }

    return new Error(message);
  }

  /**
   * Vérifie si la caméra est disponible
   * @returns {boolean}
   */
  static async isAvailable() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch {
      return false;
    }
  }
}
