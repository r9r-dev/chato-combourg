# Specification IA - Mode Play

Document de reference pour l'implementation de l'IA du mode Play.

---

## 1. Contexte de l'IA

L'IA dispose d'un contexte complet contenant toutes les informations de la partie. Ce contexte est la **seule source de donnees** pour les algorithmes de decision.

### 1.1 Donnees Statiques

Chargees une fois au demarrage, ne changent pas pendant la partie.

#### Regles du Jeu

| Donnee | Description |
|--------|-------------|
| Regles de scoring | Comment chaque carte marque des points (lignes, colonnes, boucliers, categories...) |
| Contraintes de placement | Adjacence orthogonale, grille 3x3 evolutive |
| Regles d'achat | Cout de base, reductions par categorie, achat face cachee |
| Regles des cles | Deplacer messager, rafraichir lieu, ouvrir cadenas (1 cle/tour max) |
| Regles des effets | Declenchement a la pose, effets cadenas, choix [OU] |
| Or initial | 15 pieces |
| Cles initiales | 2 cles |
| Nombre de tours | 9 tours par joueur |

#### Cartes du Jeu (92 cartes)

**Attributs de base** :

| Donnee | Description |
|--------|-------------|
| `id` | Identifiant unique ("001" a "092") |
| `name` | Nom de la carte |
| `value` | Cout en or (0-8) |
| `category` | "castle" \| "village" \| null |
| `shields` | Liste de boucliers `{count, color}` |

**Caracteristiques speciales** :

| Donnee | Description |
|--------|-------------|
| `has_messenger` | Deplace le messager a l'achat |
| `has_price_reduction` | Donne une reduction permanente |
| `has_lock` | Possede un cadenas |
| `has_coin_purse` | Possede une bourse |
| `max_coins` | Capacite max de la bourse |

**IMPORTANT : Effets vs Scoring**

Chaque carte a **deux aspects distincts** :

| Aspect | Quand | Exemple (Templier 017) |
|--------|-------|------------------------|
| **Effet** | A la pose | +1 or par bouclier rose adjacent |
| **Scoring** | Au calcul final | +1 point par cle possedee |

- `effects` : Effets immediats declenches quand la carte est posee
- `lock_effect` : Effet declenche a l'ouverture du cadenas
- `scoring_rule` : Regle de calcul des points en fin de partie

**Exemple concret** :
- Carte 020 (Banquiere) : Effet = remplir des bourses / Scoring = +1 pt par piece sur les cartes
- Carte 066 (Serrurier) : Effet = +1 cle par bouclier orange / Scoring = +1 pt par cle

#### Repartition des Cartes

| Categorie | Nombre |
|-----------|--------|
| Chateau | ~46 cartes |
| Village | ~46 cartes |
| Total | 92 cartes |

---

### 1.2 Etat de la Partie (Dynamique)

Change a chaque action.

#### Tour en Cours

| Donnee | Description |
|--------|-------------|
| `numeroTour` | 1 a 9 |
| `phase` | `pre_action` \| `buy` \| `place` \| `effect` \| `post_action` \| `end` |
| `joueurActif` | ID du joueur qui doit jouer |
| `ordreJoueurs` | Sequence de jeu (tableau d'IDs) |
| `cleUtiliseeCeTour` | Boolean - une seule cle utilisable par tour |
| `cadenasUtiliseCeTour` | Boolean - un seul cadenas ouvrable par tour |

#### Historique des Actions

Liste chronologique de toutes les actions effectuees depuis le debut de la partie.

```typescript
interface ActionHistorique {
  tour: number
  joueur: PlayerId
  type: ActionType
  details: {
    carteAchetee?: CardId
    positionPlacement?: number
    coutPaye?: number
    effetApplique?: string
    // ...
  }
  timestamp: number
}
```

---

### 1.3 Plateau Central

#### Magasin (Cartes Visibles)

| Donnee | Description |
|--------|-------------|
| `village.visibles` | 3 cartes achetables |
| `chateau.visibles` | 3 cartes achetables |
| `messager` | Position actuelle (`"village"` \| `"castle"`) |

#### Pioches (Contenu Connu, Ordre Inconnu)

| Donnee | Description |
|--------|-------------|
| `village.deck` | Cartes restantes a piocher |
| `castle.deck` | Cartes restantes a piocher |

**Calcul des probabilites** :

L'IA peut calculer la probabilite d'obtenir une carte specifique lors d'un refresh :

```
P(carte X au refresh) = 1 si X dans deck et |deck| <= 3
P(carte X au refresh) = 3 / |deck| si X dans deck et |deck| > 3
```

**Exemple** : Si `village.deck` contient 8 cartes dont la carte 042 :
- Probabilite que 042 apparaisse apres refresh = 3/8 = 37.5%

Cette information permet a l'IA de decider si un refresh vaut le cout d'une cle.

#### Defausses

| Donnee | Description |
|--------|-------------|
| `village.defausse` | Cartes eliminees (jusqu'au remelange) |
| `chateau.defausse` | Cartes eliminees (jusqu'au remelange) |

---

### 1.4 Joueurs

Informations disponibles pour **tous les joueurs** (adversaires + soi-meme).

#### Identite

| Donnee | Description |
|--------|-------------|
| `id` | Identifiant unique |
| `name` | Nom affiche |
| `isAI` | Boolean |
| `aiLevel` | Si IA : `"easy"` \| `"normal"` \| `"hard"` |

#### Ressources

| Donnee | Description |
|--------|-------------|
| `or` | Pieces d'or disponibles |
| `cles` | Cles disponibles |
| `reductionChateau` | Nombre de reductions chateau actives |
| `reductionVillage` | Nombre de reductions village actives |

#### Grille de Jeu

La grille n'est **pas** une matrice 3x3 fixe. C'est une **grille en construction** qui se forme progressivement.

**Principe fondamental** : La premiere carte n'a pas de position definie. Ce qui compte, c'est la **configuration relative** des cartes entre elles. Une grille avec la carte A en [0,0] et la carte B en [0,1] est **equivalente** a une grille avec A en [1,1] et B en [1,2].

| Donnee | Description |
|--------|-------------|
| `board` | Tableau de 9 positions (null si vide) |
| `placedCount` | Nombre de cartes placees (0-9) |
| `isComplete` | Boolean (true si 9 cartes) |

#### Systeme de Scenarios

L'IA ne gere pas les positions absolues. Elle recoit la liste des **scenarios possibles** qui representent toutes les configurations finales distinctes.

**Exemple avec 2 cartes** :

Si le joueur a une carte A deja placee et veut placer une carte B :
- La carte B peut etre placee a **4 positions relatives** : haut, bas, gauche, droite de A

**Ce que recoit l'IA** :

Pour chaque placement possible, l'IA recoit un **scenario** qui decrit :
- La position finale dans la grille 3x3 normalisee (0-8)
- La configuration complete du plateau apres placement
- Le score resultant

```typescript
interface PlacementScenario {
  id: number
  position: number           // Position finale (0-8)
  boardAfter: PlacedCard[]   // Configuration apres placement
  scoreAfter: number         // Score avec cette configuration
  adjacentCards: string[]    // IDs des cartes adjacentes
}
```

#### Decalage du Plateau (Shift)

Quand la grille est partiellement remplie et qu'on veut placer une carte "en dehors", le plateau se decale automatiquement.

**Exemple** : Plateau actuel (cartes en positions 0, 1, 2 - ligne du haut) :
```
[A][B][C]
[ ][ ][ ]
[ ][ ][ ]
```

Pour placer une carte D "au-dessus" de B, le plateau se decale vers le bas :
```
[ ][D][ ]     <- D prend la position 1
[A][B][C]     <- ABC decalees de 0,1,2 vers 3,4,5
[ ][ ][ ]
```

L'IA n'a pas a gerer le decalage - elle recoit simplement tous les scenarios valides avec leur configuration finale.

Dans l'exemple :
```
[A][B][C]
[ ][ ][ ]
[ ][ ][ ]
```

Scénarios :
```
[D][ ][ ]
[A][B][C]
[ ][ ][ ]
```
```
[ ][D][ ]
[A][B][C]
[ ][ ][ ]
```
```
[ ][ ][D]
[A][B][C]
[ ][ ][ ]
```
```
[A][B][C]
[D][ ][ ]
[ ][ ][ ]
```
```
[A][B][C]
[ ][D][ ]
[ ][ ][ ]
```
```
[A][B][C]
[ ][ ][D]
[ ][ ][ ]
```
```
[ ][ ][ ]
[A][B][C]
[D][ ][ ]
```
```
[ ][ ][ ]
[A][B][C]
[ ][D][ ]
```
```
[ ][ ][ ]
[A][B][C]
[ ][ ][D]
```


#### Bourses et Cadenas

| Donnee | Description |
|--------|-------------|
| `bourses` | Map<Position, nombrePieces> |
| `cadenas` | Map<Position, estOuvert> |

#### Scores

| Donnee | Description |
|--------|-------------|
| `scoreActuel` | Points avec l'etat actuel du plateau |
| `scoreMax` | Points max atteignables (bourses pleines, cadenas ouverts) |
| `scoreSiAchete` | Map<CardId, score> - Score si le joueur achete cette carte |

Le `scoreSiAchete` permet le **deny** : empecher un adversaire de prendre une carte tres profitable.

---

### 1.5 Raccourcis et Helpers

Ces donnees sont calculees pour faciliter la prise de decision.

| Donnee | Description |
|--------|-------------|
| `me` | Reference vers le joueur IA courant |
| `opponents` | Liste des autres joueurs |
| `messengerCards` | Cartes du lieu ou se trouve le messager (3 cartes) |
| `otherLocationCards` | Cartes de l'autre lieu (3 cartes, cout +1 cle) |
| `affordableCards` | Cartes que l'IA peut acheter (assez d'or apres reductions) |
| `deckProbabilities` | Probabilites de chaque carte au prochain refresh |

---

### 1.6 Interface AIContext

Definition complete du contexte fourni a l'IA :

```typescript
interface AIContext {
  // ===========================================
  // Etat du jeu
  // ===========================================
  turnNumber: number                // 1-9
  turnPhase: TurnPhase              // pre_action | buy | place | effect | post_action | end
  keyUsedThisTurn: boolean          // Une seule cle par tour
  lockUsedThisTurn: boolean         // Un seul cadenas par tour
  purchasedCard: string | null      // Carte achetee ce tour (en phase place/effect)
  isSimulation: boolean             // true si contexte de simulation

  // ===========================================
  // Joueurs
  // ===========================================
  me: PlayPlayer                    // Le joueur IA courant
  players: PlayPlayer[]             // Tous les joueurs (dans l'ordre de jeu)
  opponents: PlayPlayer[]           // Adversaires (players sans me)

  // ===========================================
  // Plateau central
  // ===========================================
  board: CentralBoard               // Cartes visibles, pioches, defausses, messager

  // ===========================================
  // Helpers pre-calcules
  // ===========================================
  messengerCards: string[]          // Cartes du lieu du messager (3 IDs)
  otherLocationCards: string[]      // Cartes de l'autre lieu (3 IDs)
  affordableCards: string[]         // Cartes que me peut acheter (assez d'or)
  cards: Map<string, PlayCard>      // Reference: attributs + effets de toutes les cartes

  // ===========================================
  // Probabilites pour le refresh
  // ===========================================
  deckProbabilities: {
    castle: Map<string, number>     // cardId -> probabilite (0-1)
    village: Map<string, number>
  }
}
```

### 1.7 Fonctions Helper

Fonctions utilitaires pour analyser l'etat du jeu sans dupliquer les donnees :

#### Helpers sur un joueur

```typescript
// Nombre de cartes placees sur le plateau
function getPlacedCount(player: PlayPlayer): number

// Total des pieces sur toutes les bourses
function getTotalCoins(player: PlayPlayer): number

// Positions des cadenas non ouverts
function getClosedLocks(player: PlayPlayer): number[]

// Positions des bourses non pleines
function getOpenPurses(player: PlayPlayer): number[]

// Score estime du joueur (appel API ou calcul local)
function estimateScore(player: PlayPlayer, keys: number): Promise<number>
```

#### Helpers sur le plateau d'un joueur

```typescript
// Cartes adjacentes a une position (orthogonales uniquement)
function getAdjacentCards(board: (PlacedCard | null)[], position: number): PlacedCard[]

// Compte les boucliers d'une couleur sur les cartes adjacentes
function countAdjacentShields(
  board: (PlacedCard | null)[],
  position: number,
  color: ShieldColor,
  cards: Map<string, PlayCard>
): number

// Verifie si une position est dans une ligne/colonne complete
function isInCompleteLine(board: (PlacedCard | null)[], position: number): boolean
function isInCompleteColumn(board: (PlacedCard | null)[], position: number): boolean
```

#### Helpers sur les cartes

```typescript
// Cout effectif d'une carte pour un joueur (avec reductions)
function getEffectiveCost(card: PlayCard, player: PlayPlayer): number

// Verifie si une carte a un effet specifique
function hasEffect(card: PlayCard, effectType: string): boolean

// Recupere les couleurs de boucliers uniques sur un plateau
function getUniqueShieldColors(board: (PlacedCard | null)[], cards: Map<string, PlayCard>): Set<ShieldColor>
```

---

## 2. Actions Possibles

Le moteur demande a l'IA de choisir une action. Pour chaque demande, l'IA recoit :
- La liste des actions possibles
- Un **contexte supplementaire** avec les consequences de chaque action

---

### 2.1 Demande : Phase Pre-Action

**Quand** : Debut de tour (`turnPhase = 'pre_action'`)

**Actions possibles** :

| Action | Code | Description |
|--------|------|-------------|
| Deplacer le messager | `spend_key_messenger` | Deplace le messager vers chateau ou village |
| Rafraichir un lieu | `spend_key_refresh` | Remplace les 3 cartes d'un lieu |
| Ouvrir un cadenas | `use_key_on_lock` | Active l'effet cadenas d'une carte |
| Acheter face visible | `buy_card` | Achete une carte normalement |
| Acheter face cachee | `buy_card_flipped` | Achete une carte sans effet (0 or) |

**Contexte supplementaire par action** :

#### Deplacer le messager
```
{
  cout: 1 cle
  destination: "castle" | "village"
  nouvellesCartesAccessibles: CardId[]  // Les 3 cartes du nouveau lieu
  cartesQuiDeviennentInaccessibles: CardId[]  // Les 3 cartes de l'ancien lieu
}
```

#### Rafraichir un lieu
```
{
  cout: 1 cle
  lieu: "castle" | "village"
  cartesDefaussees: CardId[]  // Les 3 cartes actuelles
  nouvellesCartes: "inconnues"  // On ne connait pas l'ordre de la pioche
  cartesRestantesDansPioche: CardId[]  // Contenu connu, ordre inconnu
}
```

#### Ouvrir un cadenas
```
{
  cout: 1 cle
  position: number  // Position de la carte sur la grille
  carte: CardId
  effetCadenas: Effect  // Description de l'effet qui sera declenche
  // Consequences estimees selon l'effet :
  orApres?: number
  clesApres?: number
  nouvellesCartesApres?: CardId[]  // Si effet replace_location
}
```

#### Acheter une carte
```
{
  carte: CardId
  coutBase: number
  reduction: number  // Reduction applicable (chateau/village)
  coutFinal: number
  orApres: number
  // Simulation de placement :
  scenariosPossibles: Scenario[]
  scoreMini: number  // Pire placement
  scoreMaxi: number  // Meilleur placement
  effetImmediat: Effect | null
  // Impact sur les adversaires :
  adversairesQuiVoulaientCetteCarte: PlayerId[]
  scorePerduParAdversaire: Map<PlayerId, number>
}
```

#### Acheter face cachee
```
{
  carte: CardId
  cout: 0
  orApres: number  // Inchange
  scenariosPossibles: Scenario[]
  scoreAvecCarteRetournee: number  // Score avec carte 089/090
}
```

---

### 2.2 Demande : Placement

**Quand** : Apres achat (`turnPhase = 'place'`)

**Action** : Choisir un scenario de placement

**Contexte supplementaire** :

```
{
  carteAplacer: CardId
  scenarios: [
    {
      id: number
      positionFinale: number  // 0-8 dans la grille finale
      configurationGrille: GridConfig  // Etat de la grille apres placement
      scoreApresPlacement: number
      // Details du score :
      pointsPosition: number  // Points des cartes de positionnement
      pointsBoucliers: number  // Points des alignements
      pointsCategories: number  // Points des cartes village/chateau
      // Potentiel futur :
      positionsRestantes: number[]  // Positions encore libres
      extensionsPossibles: string[]  // "peut encore etendre a gauche", etc.
    },
    // ...
  ]
}
```

---

### 2.3 Demande : Choix d'Effet

**Quand** : Apres placement d'une carte avec effet, ou apres ouverture d'un cadenas

#### Type : Choix [OU]

Cartes avec deux effets au choix (ex: "+2 or OU +1 cle")

```
{
  carte: CardId
  options: [
    {
      index: 0
      description: "+2 or"
      orApres: number
      clesApres: number
    },
    {
      index: 1
      description: "+1 cle"
      orApres: number
      clesApres: number
    }
  ]
}
```

#### Type : Defausse

Choisir une carte a defausser parmi celles d'un lieu (ex: carte 007)

```
{
  lieu: "castle" | "village"
  cartesDisponibles: [
    {
      cardId: CardId
      // Consequence si on defausse cette carte :
      ressourceGagnee: { type: "gold" | "keys", amount: number }
      // Impact strategique :
      carteUtilePourAdversaire: boolean
      scorePerduParAdversaire: Map<PlayerId, number>
    },
    // ... (3 cartes)
  ]
}
```

#### Type : Choix de Lieu

Choisir village ou chateau (effets cadenas type replace_location)

```
{
  effet: "replace_location" | "replace_location_gain_keys_per_feature" | ...
  options: [
    {
      lieu: "castle"
      cartesRemplacees: CardId[]
      ressourcesGagnees: { or: number, cles: number }
    },
    {
      lieu: "village"
      cartesRemplacees: CardId[]
      ressourcesGagnees: { or: number, cles: number }
    }
  ]
}
```

#### Type : Carte Adjacente

Choisir quelle carte adjacente activer (effet activate_adjacent)

```
{
  positionDeclencheur: number
  cartesAdjacentes: [
    {
      position: number
      cardId: CardId
      effetQuiSeraActive: Effect
      orApres: number
      clesApres: number
    },
    // ... (1 a 4 cartes selon la position)
  ]
}
```

#### Type : Selection de Bourses

Choisir quelles bourses remplir (effet fill_purses_select)

```
{
  nombreMaxAChoisir: number
  boursesDisponibles: [
    {
      position: number
      cardId: CardId
      piecesActuelles: number
      capaciteMax: number
      piecesApres: number  // Si selectionnee
    },
    // ...
  ]
}
```

---

### 2.4 Demande : Phase Post-Action

**Quand** : Apres les effets (`turnPhase = 'post_action'`)

**Actions possibles** :

| Action | Description |
|--------|-------------|
| `use_key_on_lock` | Ouvrir un cadenas (si pas deja fait ce tour) |
| `end_turn` | Terminer le tour |

**Contexte supplementaire** :

Pour `use_key_on_lock` : meme contexte que en phase pre_action.

Pour `end_turn` :
```
{
  prochainJoueur: PlayerId
  prochainJoueurEstIA: boolean
  tourSuivant: number
}
```

---

### 2.5 Resume des Demandes

| Demande | Phase | Choix |
|---------|-------|-------|
| Pre-Action | `pre_action` | Cle (messager/refresh) OU Cadenas OU Achat |
| Placement | `place` | Scenario de placement |
| Effet [OU] | `effect` | Option 0 ou 1 |
| Effet Defausse | `effect` | Carte a defausser |
| Effet Lieu | `effect` | Village ou Chateau |
| Effet Adjacent | `effect` | Position de la carte |
| Effet Bourses | `effect` | Positions des bourses |
| Post-Action | `post_action` | Cadenas OU Fin de tour |

---

## 3. Simulateur

Le simulateur permet a l'IA d'explorer les coups possibles sans affecter la vraie partie.

### 3.1 Principe

**Reutiliser le moteur de jeu existant** plutot que reecrire la logique.

Le `gameEngine.ts` sait deja :
- Executer toutes les actions
- Valider les regles
- Appliquer les effets
- Gerer les tours et les phases

Il suffit d'ajouter un **mode simulation** qui desactive les effets de bord (logs, UI, sauvegardes).

### 3.2 Composants

#### Flag de Simulation

```typescript
interface PlayGameState {
  // ... champs existants ...
  isSimulation?: boolean  // true = partie simulee, pas de logs/UI
}
```

#### Clone d'Etat

Copie profonde de l'etat de jeu pour pouvoir le modifier sans affecter l'original.

```typescript
function cloneState(state: PlayGameState): PlayGameState {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      board: [...p.board],
      lockedCards: new Map(p.lockedCards),
    })),
    board: {
      ...state.board,
      castleCards: [...state.board.castleCards],
      villageCards: [...state.board.villageCards],
      castleDeck: [...state.board.castleDeck],
      villageDeck: [...state.board.villageDeck],
      castleDiscard: [...state.board.castleDiscard],
      villageDiscard: [...state.board.villageDiscard],
    },
    actionHistory: [...state.actionHistory],
    isSimulation: true,
  }
}
```

#### IA Temporaire pour les Humains

Dans une simulation, les joueurs humains sont remplaces par une IA de reference.

```typescript
function prepareSimulation(state: PlayGameState, referenceAI: AILevel = 'normal'): PlayGameState {
  const simState = cloneState(state);

  // Remplacer les humains par des IA temporaires
  simState.players = simState.players.map(player => {
    if (!player.isAI) {
      return {
        ...player,
        isAI: true,
        aiLevel: referenceAI,
        _wasHuman: true,  // Marqueur pour debug
      };
    }
    return player;
  });

  return simState;
}
```

### 3.3 API du Simulateur

```typescript
interface Simulator {
  /**
   * Clone l'etat et prepare la simulation
   */
  prepare(state: PlayGameState): PlayGameState;

  /**
   * Execute une action sur un etat (modifie l'etat en place)
   */
  executeAction(state: PlayGameState, action: GameAction): PlayGameState;

  /**
   * Simule le tour complet d'un joueur
   * Utilise l'IA du joueur (ou l'IA temporaire si humain)
   */
  simulateTurn(state: PlayGameState): PlayGameState;

  /**
   * Simule N tours complets (tous les joueurs jouent N fois)
   */
  simulateRounds(state: PlayGameState, rounds: number): PlayGameState;

  /**
   * Simule jusqu'a la fin de la partie
   */
  simulateToEnd(state: PlayGameState): PlayGameState;

  /**
   * Calcule le score d'un joueur dans un etat donne
   */
  evaluate(state: PlayGameState, playerId: string): number;

  /**
   * Calcule les scores de tous les joueurs
   */
  evaluateAll(state: PlayGameState): Map<string, number>;
}
```

### 3.4 Exemple d'Utilisation

```typescript
// L'IA veut evaluer l'achat de la carte "042"

// 1. Preparer la simulation
const simState = simulator.prepare(currentState);

// 2. Simuler l'achat
simulator.executeAction(simState, {
  type: 'buy_card',
  playerId: myId,
  cardId: '042',
});

// 3. Simuler le placement au meilleur endroit
const bestPosition = findBestPosition(simState, '042');
simulator.executeAction(simState, {
  type: 'place_card',
  playerId: myId,
  position: bestPosition,
});

// 4. Simuler les reponses des adversaires (1 tour chacun)
simulator.simulateRounds(simState, 1);

// 5. Evaluer ma position
const myScore = simulator.evaluate(simState, myId);
const opponentScores = simulator.evaluateAll(simState);

// 6. Comparer avec d'autres options...
```

### 3.5 Optimisations

#### Cache de Scores

Les memes configurations de plateau donnent les memes scores. On peut cacher les resultats.

```typescript
const scoreCache = new Map<string, number>();

function getCacheKey(board: (PlacedCard | null)[], keys: number, coins: number): string {
  const cardIds = board.map(p => p?.cardId ?? 'X').join('-');
  return `${cardIds}-${keys}-${coins}`;
}

function evaluateCached(state: PlayGameState, playerId: string): number {
  const player = state.players.find(p => p.id === playerId);
  const key = getCacheKey(player.board, player.keys, getTotalCoins(player));

  if (scoreCache.has(key)) {
    return scoreCache.get(key)!;
  }

  const score = calculateScore(player);  // Appel API ou calcul local
  scoreCache.set(key, score);
  return score;
}
```

#### Limitation de Profondeur

Pour eviter des simulations trop longues :

| Niveau IA | Profondeur max |
|-----------|----------------|
| Easy | 0 (pas de simulation) |
| Normal | 1 tour |
| Hard | 3 tours ou fin de partie |

#### Parallelisation

Les simulations sont independantes - on peut les executer en parallele :

```typescript
// Evaluer 6 cartes en parallele
const evaluations = await Promise.all(
  availableCards.map(cardId =>
    simulateAndEvaluate(state, cardId)
  )
);
```

### 3.6 Avantages de cette Approche

| Avantage | Description |
|----------|-------------|
| Zero duplication | Le simulateur utilise le moteur existant |
| Coherence | Memes regles dans simulation et vrai jeu |
| Maintenabilite | Une seule source de verite |
| Testabilite | On peut tester le simulateur independamment |
| Evolutivite | Ameliorer le moteur ameliore automatiquement le simulateur |

---

## 4. Algorithmes de Decision

L'IA explore un **arbre de decisions** pour choisir la meilleure action.

### 4.1 Structure de l'Arbre

#### ActionNode

Chaque noeud represente une action possible et ses consequences.

```typescript
interface ActionNode {
  // Identification
  id: string
  depth: number                         // Profondeur dans l'arbre

  // Action
  action: GameAction                    // L'action representee
  description: string                   // Description lisible

  // Contexte
  contextAvant: AIContext               // Etat avant l'action
  contextApres: AIContext               // Etat apres l'action

  // Consequences
  consequences: {
    scoreDelta: number                  // Mon score apres - avant
    orDelta: number                     // Or apres - avant
    clesDelta: number                   // Cles apres - avant
    // Impact sur les adversaires (deny)
    adversairesImpact: Map<PlayerId, {
      scorePotentielPerdu: number       // Score qu'ils auraient pu faire
      carteVolee: CardId | null         // Carte qu'ils voulaient
    }>
  }

  // Arbre
  children: ActionNode[]                // Actions suivantes possibles
  isTerminal: boolean                   // true = fin du tour

  // Evaluation (rempli par l'algorithme)
  score?: number                        // Score final de cette branche
  visits?: number                       // Nombre de simulations (MCTS)
}
```

#### ActionTree

L'arbre complet pour un tour.

```typescript
interface ActionTree {
  root: ActionNode                      // Noeud racine (etat initial)
  playerId: string                      // Joueur qui decide
  turnNumber: number                    // Numero du tour
  totalNodes: number                    // Nombre total de noeuds
  maxDepth: number                      // Profondeur maximale
}
```

### 4.2 Generation de l'Arbre

#### Etape 1 : Generer les actions de niveau 1

En phase `pre_action`, les actions possibles sont :

```typescript
function generateLevel1Actions(context: AIContext): GameAction[] {
  const actions: GameAction[] = [];
  const player = context.me;

  // 1. Utiliser une cle (si disponible et pas encore utilisee)
  if (player.keys > 0 && !context.keyUsedThisTurn) {
    // Deplacer messager
    const otherLocation = context.board.messengerLocation === 'castle' ? 'village' : 'castle';
    actions.push({
      type: 'spend_key',
      playerId: player.id,
      targetLocation: otherLocation,
      // Note: subType n'existe pas dans GameAction actuel, a ajouter
    });

    // Rafraichir village
    actions.push({
      type: 'spend_key',
      playerId: player.id,
      targetLocation: 'village',
    });

    // Rafraichir chateau
    actions.push({
      type: 'spend_key',
      playerId: player.id,
      targetLocation: 'castle',
    });
  }

  // 2. Ouvrir un cadenas (si disponible)
  if (player.keys > 0 && !context.lockUsedThisTurn) {
    for (const [position, isLocked] of player.lockedCards) {
      if (isLocked) {
        actions.push({
          type: 'use_key_on_lock',
          playerId: player.id,
          lockPosition: position
        });
      }
    }
  }

  // 3. Acheter une carte
  for (const cardId of context.messengerCards) {
    const card = context.cards.get(cardId);
    const cost = getEffectiveCost(card, player);

    if (player.gold >= cost) {
      // Achat normal
      actions.push({
        type: 'buy_card',
        playerId: player.id,
        cardId
      });
    }

    // Achat face cachee (toujours possible, cout 0)
    actions.push({
      type: 'buy_card_flipped',
      playerId: player.id,
      cardId
    });
  }

  return actions;
}
```

#### Etape 2 : Generer les enfants (recursif)

```typescript
function generateChildren(node: ActionNode): ActionNode[] {
  const context = node.contextApres;
  const children: ActionNode[] = [];

  switch (context.phase) {
    case 'pre_action':
      // Apres une cle/cadenas, on peut encore agir
      if (node.action.type === 'spend_key' || node.action.type === 'use_key_on_lock') {
        // Generer les actions d'achat
        for (const cardId of context.cartesDisponibles) {
          // ... generer les noeuds d'achat
        }
      }
      break;

    case 'place':
      // Generer les scenarios de placement
      for (const scenario of context.scenariosPossibles) {
        children.push(createPlaceNode(node, scenario));
      }
      break;

    case 'effect':
      // Generer les choix d'effet
      for (const option of context.optionsEffet) {
        children.push(createEffectNode(node, option));
      }
      break;

    case 'post_action':
      // Cadenas ou fin de tour
      if (peutOuvrirCadenas(context)) {
        // ... generer les noeuds cadenas
      }
      children.push(createEndTurnNode(node));
      break;
  }

  return children;
}
```

#### Etape 3 : Construire l'arbre complet

```typescript
function buildActionTree(context: AIContext, maxDepth: number = 10): ActionTree {
  const root: ActionNode = {
    id: 'root',
    depth: 0,
    action: null,
    contextAvant: context,
    contextApres: context,
    consequences: { scoreDelta: 0, orDelta: 0, clesDelta: 0, adversairesImpact: new Map() },
    children: [],
    isTerminal: false
  };

  // Generer recursivement
  function expand(node: ActionNode) {
    if (node.depth >= maxDepth || node.isTerminal) return;

    const actions = generateActions(node.contextApres);
    for (const action of actions) {
      const child = createChildNode(node, action);
      node.children.push(child);
      expand(child);  // Recursion
    }
  }

  expand(root);

  return {
    root,
    playerId: context.moi.id,
    turnNumber: context.tour,
    totalNodes: countNodes(root),
    maxDepth: getMaxDepth(root)
  };
}
```

### 4.3 Estimation de la Complexite

#### Par tour

**Cartes achetables** :
- 3 cartes directement accessibles (lieu du messager)
- 3 cartes accessibles apres deplacement du messager (-1 cle)
- Total : **6 cartes** (mais les 3 supplementaires coutent 1 cle)

| Elements | Valeurs | Combinaisons |
|----------|---------|--------------|
| Cartes accessibles sans cle | 3 | 3 |
| Cartes accessibles avec cle | +3 | 6 |
| + Achat face cachee | x2 | 12 |
| x Scenarios de placement | 1-4 (selon tour) | ~30 |
| x Choix d'effet (parfois) | 1-3 | ~50 |
| + Actions cle avant (refresh) | ~2 | ~60 |
| + Cadenas apres | ~2 | ~80 |

**Note sur les placements** : Apres la premiere carte, le nombre de placements valides est limite par l'adjacence (max 4 positions). Au tour 8, il ne reste qu'une seule position.

**Estimation : 50-150 feuilles par tour**

#### Sur plusieurs tours

Si on simule les adversaires :
- 2 joueurs, 3 tours : 200^6 = impossible
- **Solution : ne pas tout explorer, utiliser des heuristiques**

### 4.4 Algorithmes de Parcours

#### Greedy (Glouton)

Le plus simple : evaluer toutes les feuilles et prendre la meilleure.

```typescript
function greedySelect(tree: ActionTree): GameAction {
  let bestNode: ActionNode | null = null;
  let bestScore = -Infinity;

  // Parcourir toutes les feuilles
  function traverse(node: ActionNode) {
    if (node.isTerminal || node.children.length === 0) {
      const score = evaluate(node.contextApres, tree.playerId);
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(tree.root);

  // Remonter jusqu'a l'action de niveau 1
  return getFirstAction(bestNode);
}
```

**Avantages** : Simple, rapide
**Inconvenients** : Ne considere pas les adversaires

#### Minimax (avec elagage Alpha-Beta)

Anticipe les reponses des adversaires.

```typescript
function minimax(
  node: ActionNode,
  depth: number,
  isMaximizing: boolean,  // true = mon tour, false = adversaire
  alpha: number,
  beta: number
): number {
  // Cas terminal
  if (depth === 0 || node.isTerminal) {
    return evaluate(node.contextApres, myPlayerId);
  }

  if (isMaximizing) {
    // Mon tour : je maximise
    let maxEval = -Infinity;
    for (const child of node.children) {
      const eval = minimax(child, depth - 1, false, alpha, beta);
      maxEval = Math.max(maxEval, eval);
      alpha = Math.max(alpha, eval);
      if (beta <= alpha) break;  // Elagage
    }
    return maxEval;
  } else {
    // Tour adversaire : il minimise mon score
    let minEval = +Infinity;
    for (const child of node.children) {
      const eval = minimax(child, depth - 1, true, alpha, beta);
      minEval = Math.min(minEval, eval);
      beta = Math.min(beta, eval);
      if (beta <= alpha) break;  // Elagage
    }
    return minEval;
  }
}
```

**Avantages** : Anticipe les adversaires
**Inconvenients** : Complexite exponentielle, suppose que l'adversaire joue parfaitement

#### Monte Carlo Tree Search (MCTS)

Explore aleatoirement et converge vers les bonnes branches.

```typescript
function mcts(tree: ActionTree, iterations: number): GameAction {
  for (let i = 0; i < iterations; i++) {
    // 1. Selection : descendre vers une feuille prometteuse
    let node = select(tree.root);

    // 2. Expansion : ajouter un enfant non explore
    if (!node.isTerminal) {
      node = expand(node);
    }

    // 3. Simulation : jouer aleatoirement jusqu'a la fin
    const score = simulate(node);

    // 4. Backpropagation : remonter le score
    backpropagate(node, score);
  }

  // Choisir l'action la plus visitee
  return getBestChild(tree.root).action;
}

function select(node: ActionNode): ActionNode {
  while (node.children.length > 0) {
    // UCB1 : balance exploration/exploitation
    node = node.children.reduce((best, child) => {
      const ucb = child.score / child.visits
        + Math.sqrt(2 * Math.log(node.visits) / child.visits);
      return ucb > best.ucb ? { node: child, ucb } : best;
    }, { node: node.children[0], ucb: -Infinity }).node;
  }
  return node;
}
```

**Avantages** : Gere l'incertitude, s'ameliore avec le temps
**Inconvenients** : Plus complexe, besoin de beaucoup d'iterations

### 4.5 Elagage (Pruning)

Couper les branches clairement mauvaises pour accelerer la recherche.

#### Elagage par cout

```typescript
// Ne pas explorer si on n'a pas assez d'or
if (action.type === 'buy_card' && cout > player.or + 2) {
  continue;  // Meme avec un effet +or, peu probable
}
```

#### Elagage par score

```typescript
// Ne pas explorer si le score est deja tres mauvais
if (node.consequences.scoreDelta < -10) {
  continue;  // Branche clairement mauvaise
}
```

#### Elagage par similarite

```typescript
// Regrouper les placements similaires
// Si position 0 et position 1 donnent le meme score, n'en garder qu'un
const dominated = positions.filter(p =>
  positions.some(other => other.score > p.score && other.cartesSynergiques >= p.cartesSynergiques)
);
```

### 4.6 Recommandation par Niveau

| Niveau | Algorithme | Profondeur | Notes |
|--------|------------|------------|-------|
| Easy | Random parmi top 5 | 1 tour | Pas de simulation adversaire |
| Normal | Greedy + elagage | 1-2 tours | Simulation adversaire basique |
| Hard | MCTS (500 iterations) | 3+ tours | Simulation complete |

### 4.7 Resume

```
1. Generer l'arbre d'actions (toutes les possibilites)
2. Elaguer les branches clairement mauvaises
3. Evaluer les feuilles (score via simulateur)
4. Choisir selon l'algorithme (greedy, minimax, mcts)
5. Retourner l'action de niveau 1
```

---

## 5. Niveaux de Difficulte

Les niveaux sont crees par **degradation** de l'IA parfaite.

### 5.1 Structure des Niveaux

| Niveau | Type | Description |
|--------|------|-------------|
| **Facile** | Erreurs controlees | Fait des erreurs volontaires, choix sous-optimaux |
| **Normal** | Personnalites | IA biaisee par une strategie (bourses, cles, boucliers...) |
| **Difficile** | Parfaite | IA objective sans biais, temps de reflexion limite |

### 5.2 IA Parfaite (Base)

L'IA parfaite est la **reference**. Elle :
- Explore l'arbre de decisions complet
- Evalue objectivement chaque branche
- Choisit le meilleur coup sans biais
- Utilise le simulateur pour anticiper

```typescript
class PerfectAI implements AIPlayer {
  level: AILevel = 'hard';
  name = 'Oracle';

  async selectAction(context: AIContext): Promise<GameAction> {
    // 1. Construire l'arbre
    const tree = buildActionTree(context);

    // 2. Evaluer objectivement
    evaluateTree(tree);

    // 3. Choisir le meilleur
    return getBestAction(tree);
  }
}
```

---

### 5.3 IA Normale : Personnalites

Chaque personnalite a des **preferences strategiques** qui biaisent ses choix.

#### Liste des Personnalites

| Nom | Strategie | Biais |
|-----|-----------|-------|
| **Le Banquier** | Bourses | Prefere les cartes avec bourses, maximise les pieces |
| **Le Gardien** | Cles | Garde ses cles, vise les cartes +1 pt/cle (017, 066) |
| **L'Arc-en-ciel** | 6 couleurs | Veut toutes les couleurs de boucliers |
| **Le Specialiste** | 1-2 couleurs | Se concentre sur peu de couleurs, beaucoup de boucliers |
| **Le Marchand** | Reductions | Accumule les reductions tot dans la partie |
| **Le Batisseur** | Positionnement | Aime les cartes de positionnement (ligne/colonne) |
| **Le Collectionneur** | Categories | Maximise les cartes chateau OU village |
| **Le Serrurier** | Cadenas | Adore les cartes avec cadenas |

#### Implementation

```typescript
interface Personality {
  name: string;
  description: string;

  /**
   * Calcule un bonus/malus pour une action selon la personnalite
   * Retourne un nombre positif (preference) ou negatif (aversion)
   */
  evaluateBias(node: ActionNode, context: AIContext): number;
}
```

#### Exemple : Le Banquier

```typescript
const BanquierPersonality: Personality = {
  name: 'Le Banquier',
  description: 'Adore accumuler des pieces sur ses bourses',

  evaluateBias(node: ActionNode, context: AIContext): number {
    let bias = 0;
    const action = node.action;

    // Si on achete une carte
    if (action.type === 'buy_card') {
      const card = getCard(action.cardId);

      // Adore les cartes avec bourse
      if (card?.has_coin_purse) {
        bias += 5;
        // Bonus si grande capacite
        bias += (card.max_coins ?? 0) * 0.5;
      }

      // Aime les effets qui remplissent les bourses
      if (hasEffect(card, 'fill_purses')) {
        bias += 3;
      }

      // Vise la carte 020 (+2 pts par piece)
      if (action.cardId === '020') {
        bias += 8;
      }
    }

    // Bonus par piece actuellement sur le plateau
    const totalCoins = countTotalCoins(context.moi);
    bias += totalCoins * 0.3;

    return bias;
  }
};
```

#### Exemple : L'Arc-en-ciel

```typescript
const ArcEnCielPersonality: Personality = {
  name: "L'Arc-en-ciel",
  description: 'Veut collecter les 6 couleurs de boucliers',

  evaluateBias(node: ActionNode, context: AIContext): number {
    let bias = 0;
    const action = node.action;

    if (action.type === 'buy_card') {
      const card = getCard(action.cardId);
      const currentColors = getUniqueColors(context.moi.board);

      // Bonus enorme pour une nouvelle couleur
      for (const shield of card?.shields ?? []) {
        if (!currentColors.has(shield.color)) {
          bias += 10;  // Nouvelle couleur = tres attractif
        }
      }

      // Malus pour une couleur deja presente
      for (const shield of card?.shields ?? []) {
        if (currentColors.has(shield.color)) {
          bias -= 2;  // Deja cette couleur
        }
      }

      // Vise les cartes qui scorent sur les couleurs uniques
      if (action.cardId === '018' || action.cardId === '054') {
        bias += 6;  // Cartes "trio de couleurs"
      }
    }

    return bias;
  }
};
```

#### Application du Biais

```typescript
class NormalAI implements AIPlayer {
  level: AILevel = 'normal';
  personality: Personality;

  constructor(personality: Personality) {
    this.personality = personality;
    this.name = personality.name;
  }

  async selectAction(context: AIContext): Promise<GameAction> {
    // 1. Construire l'arbre
    const tree = buildActionTree(context);

    // 2. Evaluer avec biais
    evaluateTreeWithBias(tree, this.personality);

    // 3. Choisir le meilleur (biaise)
    return getBestAction(tree);
  }
}

function evaluateTreeWithBias(tree: ActionTree, personality: Personality) {
  traverseTree(tree.root, (node) => {
    const objectiveScore = evaluate(node.contextApres);
    const bias = personality.evaluateBias(node, tree.root.contextAvant);
    node.score = objectiveScore + bias;
  });
}
```

#### Force du Biais

Le biais peut etre ajuste pour controler la "force" de la personnalite :

```typescript
// Biais leger (proche de l'optimal)
node.score = objectiveScore + bias * 0.5;

// Biais normal
node.score = objectiveScore + bias * 1.0;

// Biais fort (tres biaise)
node.score = objectiveScore + bias * 2.0;
```

---

### 5.4 IA Facile : Erreurs Controlees

L'IA facile fait des **erreurs volontaires** pour etre battable par les debutants.

#### Types d'Erreurs

| Type | Description |
|------|-------------|
| **Choix aleatoire** | Choisit parmi les top N au lieu du meilleur |
| **Myopie** | Ne regarde qu'un tour en avant |
| **Ignorance** | Ignore certains facteurs (adversaires, effets) |
| **Hesitation** | N'utilise pas les cles/cadenas |

#### Implementation

```typescript
class EasyAI implements AIPlayer {
  level: AILevel = 'easy';
  name = 'Debutant';

  async selectAction(context: AIContext): Promise<GameAction> {
    // 1. Construire l'arbre (profondeur limitee)
    const tree = buildActionTree(context, { maxDepth: 3 });

    // 2. Evaluer simplement (pas de simulation adversaire)
    evaluateTreeSimple(tree);

    // 3. Choisir parmi les top 5 (pas forcement le meilleur)
    const topActions = getTopActions(tree, 5);
    return pickRandom(topActions);
  }
}
```

#### Parametres de l'IA Facile

```typescript
interface EasyAIConfig {
  // Choix aleatoire parmi les top N
  randomFromTopN: number;  // 3-5

  // Probabilite d'ignorer les cles
  skipKeyProbability: number;  // 0.7 (70%)

  // Probabilite d'ignorer les cadenas
  skipLockProbability: number;  // 0.8 (80%)

  // Ignore les scores adversaires
  ignoreOpponents: boolean;  // true

  // Prefere les cartes simples (sans effet complexe)
  preferSimpleCards: boolean;  // true
}
```

---

### 5.5 IA Difficile : Parfaite avec Contraintes

L'IA difficile est l'IA parfaite avec des **contraintes de temps**.

#### Options

| Option | Description |
|--------|-------------|
| **Temps limite** | Arrete la recherche apres X secondes |
| **Iterations limitees** | MCTS avec N iterations max |
| **Profondeur limitee** | Ne simule que N tours en avant |

```typescript
class HardAI implements AIPlayer {
  level: AILevel = 'hard';
  name = 'Expert';

  async selectAction(context: AIContext): Promise<GameAction> {
    // Meme que PerfectAI mais avec temps limite
    const tree = buildActionTree(context);

    // MCTS avec limite de temps
    const bestAction = mcts(tree, {
      maxIterations: 1000,
      maxTimeMs: 3000,  // 3 secondes max
    });

    return bestAction;
  }
}
```

---

### 5.6 Resume

```
┌─────────────────────────────────────────────────────────────┐
│                      IA PARFAITE                            │
│         (Objective, explore tout, choisit optimal)          │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│   DIFFICILE   │   │     NORMALE     │   │    FACILE     │
│               │   │                 │   │               │
│ Parfaite      │   │ Parfaite        │   │ Parfaite      │
│ + temps limite│   │ + biais perso   │   │ + erreurs     │
│               │   │                 │   │ + aleatoire   │
└───────────────┘   └─────────────────┘   └───────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Banquier │   │ Gardien  │   │ Arc-en-  │  ...
        │          │   │          │   │ ciel     │
        └──────────┘   └──────────┘   └──────────┘
```

### 5.7 Selection de l'IA

```typescript
function createAI(level: AILevel, personalityName?: string): AIPlayer {
  switch (level) {
    case 'easy':
      return new EasyAI();

    case 'normal':
      const personality = personalityName
        ? getPersonality(personalityName)
        : pickRandomPersonality();
      return new NormalAI(personality);

    case 'hard':
      return new HardAI();

    default:
      return new NormalAI(pickRandomPersonality());
  }
}
```

---

## 6. Implementation

Plan de developpement en **6 phases** progressives.

### 6.1 Vue d'Ensemble

```
Phase 1: Preparation
    │
    ▼
Phase 2: Contexte & Types
    │
    ▼
Phase 3: Simulateur
    │
    ▼
Phase 4: Arbre & Algorithmes
    │
    ▼
Phase 5: Personnalites & Niveaux
    │
    ▼
Phase 6: Integration & Tests
```

### 6.2 Structure des Fichiers

```
frontend/src/services/play/ai/
├── index.ts                 # Factory et exports publics
├── types.ts                 # Types: AIContext, ActionNode, Personality...
│
├── context/
│   ├── index.ts             # Export
│   ├── builder.ts           # Construit AIContext depuis PlayGameState
│   └── helpers.ts           # Fonctions utilitaires (scores, compteurs)
│
├── simulator/
│   ├── index.ts             # Export
│   ├── clone.ts             # Clone profond de l'etat
│   ├── executor.ts          # Execute actions sur etat clone
│   └── runner.ts            # Simule tours complets
│
├── evaluator/
│   ├── index.ts             # Export
│   ├── scorer.ts            # Calcul du score (via API ou local)
│   └── cache.ts             # Cache des scores
│
├── tree/
│   ├── index.ts             # Export
│   ├── generator.ts         # Genere l'arbre d'actions
│   ├── pruner.ts            # Elagage des branches
│   └── traverser.ts         # Parcours de l'arbre
│
├── algorithms/
│   ├── index.ts             # Export
│   ├── greedy.ts            # Algorithme glouton
│   ├── minimax.ts           # Minimax avec alpha-beta
│   └── mcts.ts              # Monte Carlo Tree Search
│
└── levels/
    ├── index.ts             # Export + factory createAI()
    ├── baseAI.ts            # Classe de base avec logique commune
    ├── easyAI.ts            # IA Facile (erreurs controlees)
    ├── normalAI.ts          # IA Normale (heuristiques)
    ├── hardAI.ts            # IA Difficile (MCTS)
    └── personalities.ts     # [FUTUR] Biais pour IA normale
```

---

### 6.3 Phase 1 : Preparation

**Objectif** : Nettoyer et preparer le terrain

#### Etapes

| # | Tache | Description |
|---|-------|-------------|
| 1.1 | Supprimer ancien code | Effacer le dossier `ai/` actuel |
| 1.2 | Creer structure | Creer les dossiers vides |
| 1.3 | Creer index.ts | Export vide pour eviter les erreurs |

#### Fichiers touches

```
- frontend/src/services/play/ai/         # Supprimer tout
+ frontend/src/services/play/ai/index.ts # Creer vide
```

#### Code minimal pour ne pas casser l'app

```typescript
// ai/index.ts (temporaire)
export function createAI(level: AILevel): AIPlayer {
  // Retourner une IA dummy qui fait des actions aleatoires
  return new DummyAI();
}
```

---

### 6.4 Phase 2 : Contexte & Types

**Objectif** : Definir les structures de donnees

#### Etapes

| # | Tache | Description |
|---|-------|-------------|
| 2.1 | types.ts | Definir AIContext, ActionNode, Personality, etc. |
| 2.2 | context/builder.ts | Fonction buildContext(PlayGameState) -> AIContext |
| 2.3 | context/helpers.ts | Fonctions utilitaires (countShields, getScore, etc.) |

#### Livrable

```typescript
// Pouvoir faire :
const context = buildContext(gameState);
console.log(context.moi.or);           // 15
console.log(context.cartesDisponibles); // ['001', '023', ...]
console.log(context.adversaires[0].scoreActuel); // 42
```

---

### 6.5 Phase 3 : Simulateur

**Objectif** : Pouvoir simuler des actions sans affecter le vrai jeu

#### Etapes

| # | Tache | Description |
|---|-------|-------------|
| 3.1 | clone.ts | Fonction cloneState() - copie profonde |
| 3.2 | executor.ts | Wrapper autour de executeAction() |
| 3.3 | runner.ts | simulateTurn(), simulateRounds() |
| 3.4 | Tests | Verifier que l'original n'est pas modifie |

#### Livrable

```typescript
// Pouvoir faire :
const simState = simulator.prepare(gameState);
simulator.executeAction(simState, { type: 'buy_card', cardId: '042' });
simulator.simulateRounds(simState, 2);
// gameState original inchange
```

---

### 6.6 Phase 4 : Arbre & Algorithmes

**Objectif** : Generer et parcourir l'arbre de decisions

#### Etapes

| # | Tache | Description |
|---|-------|-------------|
| 4.1 | generator.ts | buildActionTree() - genere toutes les branches |
| 4.2 | pruner.ts | Elagage des branches inutiles |
| 4.3 | evaluator/scorer.ts | Calcul du score d'un etat |
| 4.4 | greedy.ts | Algorithme glouton (premier algo) |
| 4.5 | Tests | Verifier la generation et l'evaluation |

#### Livrable

```typescript
// Pouvoir faire :
const tree = buildActionTree(context);
console.log(tree.totalNodes);  // ~150
const bestAction = greedySelect(tree);
```

---

### 6.7 Phase 5 : Personnalites & Niveaux

**Objectif** : Creer les differentes IA

#### Etapes

| # | Tache | Description |
|---|-------|-------------|
| 5.1 | perfectAI.ts | IA de base sans biais |
| 5.2 | personalities/*.ts | Les 8 personnalites |
| 5.3 | normalAI.ts | IA avec personnalite |
| 5.4 | easyAI.ts | IA avec erreurs |
| 5.5 | hardAI.ts | IA parfaite + MCTS |
| 5.6 | mcts.ts | Algorithme MCTS complet |

#### Livrable

```typescript
// Pouvoir faire :
const easy = createAI('easy');
const normal = createAI('normal');      // Personnalite aleatoire
const normalBanquier = createAI('normal', 'banquier');
const hard = createAI('hard');
```

---

### 6.8 Phase 6 : Integration & Tests

**Objectif** : Brancher la nouvelle IA et valider

#### Etapes

| # | Tache | Description |
|---|-------|-------------|
| 6.1 | Adapter index.ts | Exporter createAI() compatible avec l'existant |
| 6.2 | Adapter PlayContext | Verifier que runAITurn() fonctionne |
| 6.3 | Tests manuels | Jouer contre chaque niveau |
| 6.4 | Ajustements | Regler les biais et parametres |
| 6.5 | Performance | Optimiser si trop lent |

---

### 6.9 Estimation

| Phase | Complexite | Dependances |
|-------|------------|-------------|
| 1. Preparation | Faible | Aucune |
| 2. Contexte | Moyenne | Phase 1 |
| 3. Simulateur | Moyenne | Phase 2 |
| 4. Arbre & Algos | Elevee | Phase 2, 3 |
| 5. Personnalites | Moyenne | Phase 4 |
| 6. Integration | Moyenne | Phase 5 |

### 6.10 Points d'Attention

#### Performance

- Le simulateur doit etre rapide (pas d'appels API si possible)
- Le cache de scores est essentiel
- Elaguer agressivement les branches inutiles

#### Compatibilite

- L'interface AIPlayer doit rester compatible
- Les methodes existantes (selectBuyAction, etc.) doivent etre preservees
- Le PlayContext ne doit pas changer (ou tres peu)

#### Testabilite

- Chaque module doit etre testable independamment
- Prevoir des logs pour debugger les decisions de l'IA
- Mode "verbose" pour voir l'arbre de decisions

---

### 6.11 Proposition d'Ordre

Je propose de commencer par :

```
1. Phase 1 (Preparation)     - Nettoyer
2. Phase 2 (Types/Context)   - Fondations
3. Phase 3 (Simulateur)      - Coeur technique
4. Phase 4.1-4.4 (Arbre+Greedy) - Premier algo fonctionnel
   └── A ce stade : IA Parfaite basique qui fonctionne
5. Phase 5.1 (PerfectAI)     - Premiere vraie IA
6. Phase 6.1-6.3 (Integration) - Tester en jeu
   └── A ce stade : On peut jouer contre l'IA parfaite
7. Phase 5.2-5.4 (Personnalites + Niveaux) - Variations
8. Phase 5.5-5.6 (MCTS)      - Optimisation Hard
9. Phase 6.4-6.5 (Ajustements) - Polish
```

Cela permet d'avoir une **IA fonctionnelle rapidement** (apres phase 6.1-6.3) et d'iterer ensuite.

---

## 7. Travaux Futurs

### 7.1 IA Neurale (AlphaZero)

Une fois les IA classiques implementees, une approche type AlphaZero pourrait etre envisagee :

| Composant | Description |
|-----------|-------------|
| **Reseau de politique** | Predit la distribution de probabilites sur les actions |
| **Reseau de valeur** | Estime le score final depuis un etat |
| **MCTS guide** | Utilise le reseau pour guider l'exploration |
| **Self-play** | Entrainement par parties contre soi-meme |

**Avantages** :
- Decouverte de strategies non-evidentes
- Pas besoin d'heuristiques manuelles
- Potentiellement plus fort que MCTS pur

**Prerequis** :
- Simulateur performant (necessaire pour self-play rapide)
- Representation vectorielle de l'etat de jeu
- Infrastructure d'entrainement (GPU)

### 7.2 Personnalites Detaillees

Les personnalites (section 5.3) seront implementees apres validation de l'IA de base. Chaque personnalite appliquera un **biais** sur l'evaluation des actions.

### 7.3 Mode Analyse

Un mode "analyse" pourrait etre ajoute pour montrer au joueur :
- Les coups envisages par l'IA
- L'evaluation de chaque option
- Les raisons du choix final

Utile pour l'apprentissage et le debug.
