# Chato Combourg

Application de calcul automatique du score pour le jeu de cartes **Château Combo** à partir d'une prise de vue.

## Fonctionnalités

- **Reconnaissance de cartes** : Prenez une photo de votre plateau 3x3, l'IA identifie automatiquement vos 9 cartes
- **Calcul de score** : Application automatique des règles du jeu
- **Gestion des joueurs** : Gestion des parties et classement final
- **Historique** : Retrouvez toutes vos parties passées
- **PWA** : Utilisable sur mobile comme une application native

## Installation

### Avec Docker (recommandé)

1. Clonez le dépôt :
```bash
git clone https://github.com/r9r-dev/chato-combourg.git
cd chato-combourg
```

2. Téléchargez le modèle YOLO entraîné et placez-le dans `./models/card_detector/yolo11/model.pt`

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

Ce projet est sous licence [GPL-3.0](LICENSE).
