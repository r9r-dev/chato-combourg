# Chato Combourg

Application de calcul automatique du score pour le jeu de cartes **Château Combo** à partir d'une prise de vue.

## Fonctionnalités

- **Reconnaissance de cartes** : Prenez une photo de votre plateau 3x3, l'IA identifie automatiquement vos 9 cartes
- **Calcul de score** : Application automatique des règles du jeu
- **Gestion des joueurs** : Gestion des parties et classement final
- **Historique** : Retrouvez toutes vos parties passées ainsi que des statistiques
- **PWA** : Utilisable sur mobile comme une application native

## Performances
Avec un entrainement sur 5000 photos précalculées (génération automatique de fausses photos avec 9 cartes, ajout d'altérations multiples, textures de fond, chevauchements, etc.) et une validation sur 500 photos, le modèle yolo11x atteint un taux de réussite de 99,5% dans les pires conditions.

Le modèle n'a pas été entrainé sur des photos réelles (trop long !) donc dans la réalité il n'est pas aussi performant mais se trompe malgré tout très rarement.

Le projet propose trois modes d'analyse :
- Un mode local offline avec un modèle réduit au format ONNX (FP16, FP32, INT8)
- Un mode linux qui utilise le serveur déployé sur serveur Intel sur un modèle au format OpenVINO
- Un mode Mac qui fait un rebond vers un service qui tourne sur un Mac mini M4 sur un modèle au format PyTorch

En mode offline, les résultats sont assez peu probants même en FP32. Ça fonctionne mais assez mal. Le calcul se fait en 3-4 secondes sur iPhone 17 Pro.
En mode linux, mon vieux serveur Intel calcule en 7-8 secondes.
En mode Mac, en 1 seconde on a le résultat, rendant l'application beaucoup plus fluide.

## Ressources requises

Ce dépôt ne contient pas les images des cartes ni les modèles d'IA. Vous devrez les générer vous-même :

### Images des cartes

Les visuels des cartes sont la propriété de **Catch Up Games** et ne peuvent pas être redistribués. Pour utiliser cette application, vous devez posséder le jeu **Château Combo** et scanner vos propres cartes :

1. Scannez les 92 cartes de votre jeu en PNG (630x880px recommandé)
2. Nommez-les `carte_001.png` à `carte_092.png`
3. Placez-les dans `backend/cards/`
4. Générez les miniatures WebP avec le script fourni :
   ```bash
   cd backend && python scripts/generate_thumbs.py
   ```

### Modèle de reconnaissance

Le modèle YOLO doit être entraîné à partir de vos cartes scannées :

1. Générez le dataset d'entraînement :
   ```bash
   cd training
   python generate_dataset.py
   ```

2. Lancez l'entraînement (nécessite un GPU ou MPS sur Mac) :
   ```bash
   python train.py
   ```

3. Copiez le modèle entraîné :
   ```bash
   cp runs/detect/train/weights/best.pt ../models/card_detector/yolo11/model.pt
   ```

## Installation

### Avec Docker (recommandé)

1. Clonez le dépôt :
```bash
git clone https://github.com/r9r-dev/chato-combourg.git
cd chato-combourg
```

2. Assurez-vous d'avoir généré les cartes et entraîné le modèle (voir [Ressources requises](#ressources-requises))

3. Lancez l'application :
```bash
docker compose up -d
```

4. Accédez à http://localhost:8080

> **Note** : Le premier démarrage prend 5-10 minutes pour installer les dépendances Python. Les démarrages suivants sont instantanés.

## Utilisation

1. **Nouvelle partie** : Sélectionnez les joueurs participants (2-5)
2. **Saisie des clés** : Entrez le nombre de clés pour chaque joueur
3. **Saisie des pièces** : Entrez le nombre de pièces restantes
4. **Photo du plateau** : Prenez en photo le plateau 3x3 de chaque joueur
5. **Contrôle** : Corriger les cartes mal identifiées si besoin
6. **Résultats** : Consultez les scores et le classement final

## Documentation

Pour plus de détails sur les règles de scoring, consultez [docs/CARD_RULES.md](docs/CARD_RULES.md).

## Licence

Ce projet est sous licence [AGPL-3.0](LICENSE).
