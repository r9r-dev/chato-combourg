# Changelog

## v1.7.11 (2025-12-31)

- Correction du chargement du modèle OpenVINO depuis un répertoire au lieu d'un fichier XML

## v1.7.10 (2025-12-31)

- Amélioration des logs : filtrage des assets et affichage du temps d'analyse
- Correction du chemin du modèle OpenVINO pour utiliser le fichier model.xml

## v1.7.9 (2025-12-31)

- Amélioration des logs applicatifs

## v1.7.8 (2025-12-31)

- Ajout d'un script d'entraînement Google Colab pour faciliter l'entraînement du modèle YOLO11

## v1.7.7 (2025-12-31)

- Correction: Mise à jour de la vérification de démarrage pour les nouveaux chemins de modèles
- Nouvelle fonctionnalité: Suppression automatique des captures en attente lorsque l'utilisateur quitte l'application

## v1.7.6 (2025-12-31)

Corrections et améliorations mineures

## v1.7.5 (2025-12-31)

- Refactorisation : déplacement des modèles à la racine du projet pour une structure plus claire
- Ajout du support OpenVINO pour une inférence YOLO plus rapide sur les processeurs Intel

## v1.7.4 (2025-12-31)

- Amélioration de la mise en page des images annotées pour les captures

## v1.7.3 (2025-12-31)

- Suppression de la configuration Ultralytics (accepte l'avertissement par défaut)
- Correction : Ajout des champs de paramètres Ultralytics manquants

## v1.7.2 (2025-12-31)

- Suppression des vestiges de CLIP
- Ajout de la configuration Ultralytics

## v1.7.1 (2025-12-31)

- Affichage d'un écran d'analyse pendant la détection des cartes
- Installation des polices DejaVu dans Docker pour support Unicode des annotations
- Amélioration de la taille de police et support Unicode pour les images annotées
- Positionnement correct des étiquettes d'annotation dans la boîte englobante
- Style amélioré du bouton de capture avec anneau extérieur
- Suppression du Dockerfile backend inutilisé

## v1.7.0 (2025-12-31)

- Système de catégorisation des captures pour la collecte de données d'entraînement
- Bouton de capture manuel remplaçant le timer automatique
- Suppression de la rotation manuelle d'orientation en caméra
- Sauvegarde automatique de tous les captures d'analyse pour l'entraînement du modèle
- Amélioration de l'UX en caméra avec compte à rebours et correction d'orientation
- Validation automatique au détection des 9 cartes

## v1.6.0 (2025-12-30)

- Remplacement du système de capture automatique par un bouton de capture manuel
- Suppression de la minuterie automatique de capture pour plus de contrôle utilisateur

## v1.5.6 (2025-12-30)

- Correction de la rotation d'orientation dans la capture camera

## v1.5.5 (2025-12-30)

- Sauvegarde des captures d'analyse pour l'entrainement futur du modele

## v1.5.4 (2025-12-30)

- Amelioration UX camera avec compte a rebours et correction d'orientation
- Auto-validation quand les 9 cartes sont detectees

## v1.5.3 (2025-12-30)

- Correction du Dockerfile pour le montage du dossier models/

## v1.5.2 (2025-12-30)

- Correction du calcul de position dans la grille
- Ajout des suggestions de cartes similaires

## v1.5.1 (2025-12-30)

- Correction de l'utilisation du modele YOLO avec images PIL

## v1.5.0 (2025-12-30)

- Migration vers YOLO11 avec detection et identification en une seule passe

## v1.4.2 (2025-12-29)

- Affichage de la version au demarrage du backend
- Ajout du prompt d'installation PWA

## v1.4.1 (2025-12-29)

- Ajout de la page Review pour verification des cartes avant calcul du score
- Application des parametres d'ordre des joueurs

## v1.4.0 (2025-12-29)

- Ajout de la page Parametres avec gestion des joueurs et export des donnees

## v1.3.2 (2025-12-29)

- Correction des accents francais dans l'interface

## v1.3.1 (2025-12-29)

- Mise a jour automatique de la PWA
- Detection automatique des changements de requirements.txt

## v1.3.0 (2025-12-29)

- Ajout de la persistance utilisateur avec support multi-joueurs
- Refonte du parcours utilisateur avec saisie cles/pieces

## v1.2.0 (2025-12-29)

- Affichage des rectangles de detection cyan sur la camera
- Amelioration de l'assignation des positions par division de grille

## v1.1.0 (2025-12-29)

- Affichage des badges numerotes sur la camera pour chaque position
- Ajout des miniatures WebP pour un chargement plus rapide
- Assignation des positions par coordonnees spatiales
- Ajout de l'icone apple-touch-icon pour iOS

## v1.0.2 (2025-12-29)

- Correction du double comptage des boucliers ligne+colonne

## v1.0.1 (2025-12-29)

- Ajout de l'icone chateau pour la PWA

## v1.0.0 (2025-12-29)

- Premiere version stable
- Reconnaissance de cartes par photo
- Calcul automatique des scores
- Interface PWA responsive

## v0.1.11 (2025-12-29)

- Affichage des sauts de ligne dans les explications de cartes

## v0.1.10 (2025-12-29)

- Corrections de l'ordre des cartes, scoring des pieces et UI

## v0.1.9 (2025-12-28)

- Correction du parsing de la reponse API

## v0.1.8 (2025-12-28)

- Ajout de la dependance ultralytics (YOLO)

## v0.1.7 (2025-12-28)

- Ajout des types vite-plugin-pwa

## v0.1.6 (2025-12-28)

- Ajout des verifications au demarrage et logs detailles
- Prompt de mise a jour PWA

## v0.1.5 (2025-12-28)

- Corrections du layout, ratio camera et noms de champs API

## v0.1.4 (2025-12-28)

- Correction du PATH pour les dependances Python

## v0.1.3 (2025-12-28)

- Utilisation de /bin/sh dans l'entrypoint

## v0.1.2 (2025-12-28)

- Chargement des dependances Python a la volee

## v0.1.1 (2025-12-28)

- Build Docker single platform pour eviter le manque d'espace disque

## v0.1.0 (2025-12-28)

- Workflow GitHub Actions pour le deploiement Docker
- Mise a jour complete de l'application

## v0.0.1 (2025-12-26)

- Configuration Docker initiale
- Initialisation de la PWA pour le calculateur de score Chateau Combo
