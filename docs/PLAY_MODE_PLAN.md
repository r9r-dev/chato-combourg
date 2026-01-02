# Plan du Mode "Jouer"

Ce document decrit l'implementation du mode "Jouer avec IA" pour Chateau Combo.

## Etat actuel

### Fichiers crees

#### Backend (donnees)
| Fichier | Description | Status |
|---------|-------------|--------|
| `backend/cards/card_effects.json` | Effets des 92 cartes (messager, effets, cadenas) | OK |
| `backend/cards/card_attributes.json` | Attributs + `has_messenger` ajoute | OK |
| `docs/CARD_EFFECTS.md` | Documentation des effets en francais | OK |
| `docs/GAME_RULES.md` | Regles du jeu | OK |

#### Frontend (logique)
| Fichier | Description | Status |
|---------|-------------|--------|
| `src/types/play.ts` | Types TypeScript pour le mode Play | OK |
| `src/services/play/gameEngine.ts` | Moteur de jeu (tours, actions, validation) | OK |
| `src/services/play/effectExecutor.ts` | Executeur des effets de cartes | OK |
| `src/services/play/ai/index.ts` | Factory et exports des IA | OK |
| `src/services/play/ai/easyAI.ts` | IA Facile (aleatoire) | OK |
| `src/services/play/ai/normalAI.ts` | IA Normale (heuristiques) | OK |
| `src/services/play/ai/hardAI.ts` | IA Difficile (MCTS) | OK |

### Ce qui reste a faire

#### Phase 1 : Contexte React
- [x] `src/context/PlayContext.tsx` - Gestion de l'etat du jeu
- [x] `src/context/playReducer.ts` - Reducer pour les actions

#### Phase 2 : Interface Mobile-First
- [x] `src/pages/PlaySetup.tsx` - Configuration de partie (joueurs, IA)
- [x] `src/pages/Play.tsx` - Interface de jeu principale
- [x] `src/pages/PlayResults.tsx` - Ecran de resultats
- [x] `src/pages/PlayMode.tsx` - Routeur interne
- [x] `src/context/PlayContext.tsx` - Contexte React avec game engine
- [x] `src/context/playReducer.ts` - Reducer pour l'etat UI

#### Phase 3 : Integration
- [x] Modifier `src/pages/Landing.tsx` - Ajouter bouton "Jouer avec IA"
- [x] Modifier `src/App.tsx` - Ajouter routes pour Play
- [x] Modifier `src/types/index.ts` - Ajouter step 'play'
- [x] API `/api/cards/attributes` et `/api/cards/effects`
- [ ] Tests unitaires du moteur de jeu
- [ ] Tests des IA

#### Phase 4 : Ameliorations (optionnel)
- [ ] Animations de cartes
- [ ] Sons
- [ ] Mode tutoriel
- [ ] IA neuronale (ONNX)

---

## Architecture du mode Play

### Structure des donnees

```
PlayGameState
├── gameId: string
├── phase: 'setup' | 'playing' | 'ended'
├── players: PlayPlayer[]
│   ├── id, name, color
│   ├── isAI, aiLevel?
│   ├── gold, keys
│   ├── reductionCastle, reductionVillage
│   ├── board: (PlacedCard | null)[9]
│   └── lockedCards: Map<position, hasKey>
├── currentPlayerIndex: number
├── turnNumber: number (1-9)
├── turnPhase: TurnPhase
├── purchasedCard: string | null
└── board: CentralBoard
    ├── castleCards: string[3]
    ├── villageCards: string[3]
    ├── messengerLocation: 'castle' | 'village'
    ├── castleDeck, villageDeck
    └── castleDiscard, villageDiscard
```

### Flux d'un tour

```
1. PRE_ACTION (facultatif)
   ├── Utiliser cle sur cadenas
   └── Depenser cle (messager ou refresh)

2. BUY (obligatoire)
   ├── Acheter carte normale
   └── Acheter carte face cachee

3. PLACE (obligatoire)
   └── Placer sur position valide

4. EFFECT (obligatoire)
   ├── Appliquer effet(s)
   └── Choisir si [OU]

5. POST_ACTION (facultatif)
   └── Utiliser cle sur cadenas

6. END
   ├── Deplacer messager si carte a icone
   ├── Remplir les lieux
   └── Passer au joueur suivant
```

### Les 3 IA

| Niveau | Algorithme | Temps | Description |
|--------|------------|-------|-------------|
| Facile | Aleatoire | <10ms | Choix aleatoire parmi les options valides |
| Normal | Heuristiques | <50ms | Evaluation des synergies, reductions, cout |
| Difficile | MCTS | <1s | Monte Carlo Tree Search, 500 iterations |

---

## Interface Mobile-First

### Layout principal (en jeu)

```
┌─────────────────────────────┐
│  PLATEAU CENTRAL            │
│  ┌───┬───┬───┐              │
│  │ C │ C │ C │  <- Chateau  │
│  └───┴───┴───┘              │
│  [MESSAGER ↓]               │
│  ┌───┬───┬───┐              │
│  │ V │ V │ V │  <- Village  │
│  └───┴───┴───┘              │
├─────────────────────────────┤
│  JOUEUR ACTUEL              │
│  ┌───┬───┬───┐   Or: 15     │
│  │   │   │   │   Cles: 2    │
│  ├───┼───┼───┤   Red: -1C   │
│  │   │   │   │              │
│  ├───┼───┼───┤              │
│  │   │   │   │              │
│  └───┴───┴───┘              │
├─────────────────────────────┤
│  AUTRES JOUEURS (scroll)    │
│  [Mini grille] [Mini grille]│
├─────────────────────────────┤
│  ACTIONS                    │
│  [Acheter] [Cle] [Terminer] │
└─────────────────────────────┘
```

### Couleurs (theme existant)
- Background: `#1a1a2e`
- Or/Accent: `#d4af37`
- Chateau: `#4a90a4` (bleu)
- Village: `#8b7355` (brun)

---

## Types d'effets implementes

### Gains simples
- `gain_gold` / `gain_keys`

### Gains conditionnels (plateau)
- `gain_gold_per_shield` / `gain_keys_per_shield`
- `gain_gold_per_unique_shield` / `gain_keys_per_unique_shield`
- `gain_gold_per_card` / `gain_keys_per_card`
- `gain_gold_per_castle` / `gain_gold_per_village`
- `gain_gold_per_empty_slot`
- `gain_gold_per_card_with_shields` / `gain_gold_per_card_with_value`
- `gain_gold_per_card_with_purse` / `gain_keys_per_card_with_purse`

### Gains conditionnels (voisins)
- `gain_gold_per_shield_neighbor` / `gain_keys_per_shield_neighbor`
- `gain_keys_per_castle_neighbor`

### Reductions
- `reduction_castle` / `reduction_village` / `reduction_both`

### Autres
- `fill_purses` (remplir bourses)
- `discard_village_gain_gold` / `discard_castle_gain_gold`
- `all_opponents_gain_gold` / `all_players_gain_keys`

### Effets cadenas
- `replace_location` (simple)
- `replace_location_gain_keys_per_feature`
- `replace_location_gain_keys_per_shield`
- `activate_adjacent`

---

## Prochaines etapes recommandees

1. **Creer PlayContext.tsx** - ~100 lignes
   - Wrapper useReducer
   - Fonctions pour executer les actions
   - Integration avec les IA

2. **Creer Play.tsx (interface basique)** - ~200 lignes
   - Affichage du plateau central
   - Affichage du joueur courant
   - Boutons d'action simples

3. **Tester le flux complet**
   - Une partie humain vs IA Facile
   - Verifier que les effets s'appliquent

4. **Ameliorer l'interface**
   - Ajout des mini-grilles des autres joueurs
   - Animations
   - Feedback visuel

5. **Ajouter au menu Landing**
   - Bouton "Jouer avec IA"
   - Page de configuration

---

## Notes techniques

### Chargement des donnees
Le moteur de jeu charge les donnees depuis `/api/cards/attributes` et `/api/cards/effects`.
Fallback sur import statique si l'API n'est pas disponible.

### Performance IA
- MCTS limite a 500 iterations ou 1 seconde
- Peut etre ajuste dans `hardAI.ts` (constantes en haut du fichier)
- Pour l'IA neuronale future : utiliser ONNX Runtime Web (deja dans le projet)

### Sauvegarde
Pas de sauvegarde des parties en cours (choix initial).
Les parties terminees pourraient etre sauvegardees via l'API existante `/api/games`.
