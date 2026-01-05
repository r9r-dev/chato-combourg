# Chato Combourg MCP Server

Serveur MCP pour acceder aux donnees des cartes Chateau Combo.

## Installation

```bash
cd mcp
npm install
npm run build
```

## Outils disponibles

### get_card

Retourne toutes les donnees d'une carte par son ID.

**Parametres:**
- `id` (string, requis): ID de la carte de 001 a 092

**Exemple:**
```json
{ "id": "042" }
```

### list_cards

Liste toutes les 92 cartes avec leur ID et nom.

**Parametres:** Aucun

### search_cards

Recherche des cartes par nom, categorie ou attributs.

**Parametres (tous optionnels):**
- `name` (string): Recherche par nom (insensible aux accents et majuscules)
- `category` ("castle" | "village"): Filtre par categorie
- `has_messenger` (boolean): Filtre par messager
- `has_lock` (boolean): Filtre par cadenas
- `has_price_reduction` (boolean): Filtre par reduction de prix
- `has_coin_purse` (boolean): Filtre par bourse
- `shield_color` ("blue" | "pink" | "orange" | "red"): Filtre par couleur de bouclier
- `min_value` (number): Valeur minimale (cout)
- `max_value` (number): Valeur maximale (cout)

**Exemples:**
```json
{ "name": "prince" }
{ "category": "castle", "has_messenger": true }
{ "shield_color": "blue", "max_value": 3 }
```

## Configuration Claude Code

Le fichier `.mcp.json` a la racine du projet configure ce serveur pour Claude Code.

## Structure des donnees

Chaque carte contient:
- `id`: Identifiant (001-092)
- `name`: Nom de la carte
- `file-name`: Nom du fichier image
- `value`: Cout de la carte (0-8)
- `shields`: Boucliers [{count, color}]
- `category`: "castle" | "village" | null
- `has_messenger`: Deplace le messager
- `has_price_reduction`: Offre une reduction
- `has_lock`: Possede un cadenas
- `has_coin_purse`: Possede une bourse
- `max_coins`: Capacite de la bourse
- `effects`: Effets de la carte
- `lock_effect`: Effet du cadenas
