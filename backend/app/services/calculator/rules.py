"""Scoring rules for each card (001-092).

Les règles sont générées dynamiquement depuis cards_data.json.
Les règles simples utilisent les factories de rule_factories.py.
Les règles complexes sont définies explicitement ci-dessous.
"""

from typing import Callable

from app.services.card_data import load_cards_data

from .grid import Grid
from .rule_factories import (
    # Helpers
    pluriel,
    boucliers,
    COLOR_NAMES,
    # Factories
    make_shields_in_row_rule,
    make_shields_in_col_rule,
    make_shields_in_row_and_col_rule,
    make_position_rule,
    make_pairs_rule,
    make_trios_rule,
    make_no_shield_rule,
    make_coins_on_card_rule,
    make_threshold_rule,
    make_category_count_rule,
    make_unique_colors_rule,
    make_feature_count_rule,
    make_exact_value_rule,
    make_min_value_rule,
    make_flipped_card_rule,
)


# =============================================================================
# Règles complexes (non factorisables)
# =============================================================================


def rule_004(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if there is no card with price reduction."""
    if grid.count_cards_with_price_reduction() == 0:
        return 8, "8 points (aucune carte avec réduction de prix)"
    return 0, "0 point (il y a des cartes avec réduction de prix)"


def rule_010(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each card with different price on the board."""
    unique_values = grid.get_unique_values_on_board()
    count = len(unique_values)
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun coût différent sur le plateau."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'coût')} différent{'' if count <= 1 else 's'} sur le plateau.
{count} x 3 = {score} points"""
    return score, explanation


def rule_015(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card with exactly one shield."""
    count = grid.count_cards_with_shield_count(1)
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune carte avec exactement 1 bouclier."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec exactement 1 bouclier.
{count} x 2 = {score} points"""
    return score, explanation


def rule_016(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each pair of castle/village cards."""
    chateau = grid.count_castle_cards()
    village = grid.count_village_cards()
    paires = min(chateau, village)
    score = paires * 3
    explanation = f"""- {chateau} {pluriel(chateau, 'carte')} château
- {village} {pluriel(village, 'carte')} village
Tu as {paires} {pluriel(paires, 'paire')} de cartes château/village.
{paires} x 3 = {score} points"""
    return score, explanation


def rule_017(grid: Grid, position: int, keys: int) -> tuple[int, str]:
    """1 point for each key the player owns."""
    score = keys
    if keys == 0:
        explanation = "Tu n'as pas de clés."
    elif keys == 1:
        explanation = "Tu as 1 clé.\n1 x 1 = 1 point"
    else:
        explanation = f"Tu as {keys} clés.\n{keys} x 1 = {score} points"
    return score, explanation


def rule_020(grid: Grid, position: int) -> tuple[int, str]:
    """1 point for each provided coin on cards."""
    total = grid.get_total_coins_on_cards()
    cards_with_coins = sum(1 for v in grid.coins_on_cards.values() if v > 0)
    score = total
    if total == 0:
        explanation = "Il n'y a aucune pièce sur les cartes."
    elif total == 1:
        explanation = "Il y a 1 pièce sur une carte.\n1 x 1 = 1 point"
    else:
        if cards_with_coins == 1:
            explanation = f"Il y a {total} pièces sur une carte.\n{total} x 1 = {score} points"
        else:
            explanation = f"Il y a {total} pièces réparties sur {cards_with_coins} cartes.\n{total} x 1 = {score} points"
    return score, explanation


def rule_027(grid: Grid, position: int) -> tuple[int, str]:
    """6 points for each time 3 shields of the same color can be counted on the board."""
    total_sets = 0
    details = []
    for color in Grid.COLORS:
        count = grid.count_shields_on_board(color)
        sets = count // 3
        total_sets += sets
        if sets > 0:
            french_color = COLOR_NAMES.get(color, (color, color))[0]
            details.append(f"- Tu as {sets} {pluriel(sets, 'lot')} de 3 boucliers {french_color}s")
    score = total_sets * 6
    if total_sets == 0:
        explanation = "Tu n'as aucun lot de 3 boucliers de même couleur."
    else:
        explanation = "\n".join(details) + f"\n{total_sets} x 6 = {score} points"
    return score, explanation


def rule_034(grid: Grid, position: int) -> tuple[int, str]:
    """Sum of all card costs on the same row."""
    ordinals = ["première", "deuxième", "troisième"]
    cards = grid.get_row_cards(position)
    lines = []
    total = 0
    for i, card_id in enumerate(cards):
        value = grid.get_attrs(card_id)["value"]
        total += value
        if value == 0:
            lines.append(f"- La {ordinals[i]} carte ne coûte rien")
        elif value == 1:
            lines.append(f"- La {ordinals[i]} carte coûte 1 pièce")
        else:
            lines.append(f"- La {ordinals[i]} carte coûte {value} pièces")
    explanation = "\n".join(lines) + f"\n{total} {pluriel(total, 'point')}"
    return total, explanation


def rule_038(grid: Grid, position: int) -> tuple[int, str]:
    """6 points for each different shield NOT on the board."""
    present_colors = grid.get_unique_colors_on_board()
    missing_colors = [c for c in Grid.COLORS if c not in present_colors]
    missing = len(missing_colors)
    score = missing * 6

    if missing == 0:
        explanation = "Il ne te manque aucun bouclier."
    elif missing == 6:
        explanation = f"Il te manque les 6 boucliers.\n{missing} x 6 = {score} points"
    elif missing == 1:
        color = COLOR_NAMES.get(missing_colors[0], (missing_colors[0], ""))[0]
        explanation = f"Il te manque le bouclier {color}.\n{missing} x 6 = {score} points"
    else:
        french_colors = [COLOR_NAMES.get(c, (c, c))[0] + "s" for c in missing_colors]
        if len(french_colors) == 2:
            colors_str = f"{french_colors[0]} et {french_colors[1]}"
        else:
            colors_str = ", ".join(french_colors[:-1]) + f" et {french_colors[-1]}"
        explanation = f"Il te manque les boucliers {colors_str}.\n{missing} x 6 = {score} points"

    return score, explanation


def rule_056(grid: Grid, position: int) -> tuple[int, str]:
    """12 points if the board doesn't contain cards 089 or 090."""
    count = grid.cards.count("089") + grid.cards.count("090")
    if count == 0:
        return 12, "Tu n'as aucune carte retournée.\n12 points"
    elif count == 1:
        return 0, "Tu as 1 carte retournée."
    else:
        return 0, f"Tu as {count} cartes retournées."


def rule_057(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card with exactly two shields."""
    count = grid.count_cards_with_shield_count(2)
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune carte avec exactement 2 boucliers."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec exactement 2 boucliers.
{count} x 2 = {score} points"""
    return score, explanation


def rule_066(grid: Grid, position: int, keys: int) -> tuple[int, str]:
    """1 point for each key the player owns."""
    score = keys
    if keys == 0:
        explanation = "Tu n'as pas de clés."
    elif keys == 1:
        explanation = "Tu as 1 clé.\n1 x 1 = 1 point"
    else:
        explanation = f"Tu as {keys} clés.\n{keys} x 1 = {score} points"
    return score, explanation


def rule_069(grid: Grid, position: int) -> tuple[int, str]:
    """7 points for each time 3 cards from village can be counted on the board."""
    village_count = grid.count_village_cards()
    sets = village_count // 3
    score = sets * 7
    if sets == 0:
        explanation = f"Tu as {village_count} {pluriel(village_count, 'carte')} village, pas assez pour un lot de 3."
    else:
        explanation = f"""Tu as {village_count} {pluriel(village_count, 'carte')} village, soit {sets} {pluriel(sets, 'lot')} de 3.
{sets} x 7 = {score} points"""
    return score, explanation


def rule_077(grid: Grid, position: int) -> tuple[int, str]:
    """Sum of all card costs on the same column."""
    ordinals = ["première", "deuxième", "troisième"]
    cards = grid.get_col_cards(position)
    lines = []
    total = 0
    for i, card_id in enumerate(cards):
        value = grid.get_attrs(card_id)["value"]
        total += value
        if value == 0:
            lines.append(f"- La {ordinals[i]} carte ne coûte rien")
        elif value == 1:
            lines.append(f"- La {ordinals[i]} carte coûte 1 pièce")
        else:
            lines.append(f"- La {ordinals[i]} carte coûte {value} pièces")
    explanation = "\n".join(lines) + f"\n{total} {pluriel(total, 'point')}"
    return total, explanation


def rule_078(grid: Grid, position: int) -> tuple[int, str]:
    """1 point for each card from village."""
    count = grid.count_village_cards()
    score = count
    if count == 0:
        explanation = "Tu n'as aucune carte village."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} village.
{count} x 1 = {score} {pluriel(score, 'point')}"""
    return score, explanation


def rule_079(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if there is no card with coin purse."""
    if grid.count_cards_with_coin_purse() == 0:
        return 10, "10 points (aucune carte avec bourse)"
    return 0, "0 point (il y a des cartes avec bourse)"


def rule_082(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if the board contains at least one 089 card or one 090 card."""
    count = grid.cards.count("089") + grid.cards.count("090")
    if count == 0:
        return 0, "Tu n'as aucune carte retournée."
    elif count == 1:
        return 8, "Tu as 1 carte retournée.\n8 points"
    else:
        return 8, f"Tu as {count} cartes retournées.\n8 points"


def rule_084(grid: Grid, position: int) -> tuple[int, str]:
    """1 point for each castle card."""
    count = grid.count_castle_cards()
    score = count
    if count == 0:
        explanation = "Tu n'as aucune carte château."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} château.
{count} x 1 = {score} {pluriel(score, 'point')}"""
    return score, explanation


def rule_085(grid: Grid, position: int) -> tuple[int, str]:
    """3 points if the card is placed on borders (not corners or center)."""
    if grid.is_border(position):
        border_names = {1: "en haut", 3: "à gauche", 5: "à droite", 7: "en bas"}
        location = border_names.get(position, "")
        return 3, f"Ta carte est bien sur un côté ({location}).\n3 points"
    return 0, "Ta carte n'est pas sur un côté."


def rule_087(grid: Grid, position: int) -> tuple[int, str]:
    """4 points if the card is placed on corners (not borders or center)."""
    if grid.is_corner(position):
        corner_names = {0: "en haut à gauche", 2: "en haut à droite", 6: "en bas à gauche", 8: "en bas à droite"}
        location = corner_names.get(position, "")
        return 4, f"Ta carte est bien dans un coin ({location}).\n4 points"
    return 0, "Ta carte n'est pas dans un coin."


# =============================================================================
# Règles custom par ID (non générables depuis JSON)
# =============================================================================

CUSTOM_RULES = {
    "004": rule_004,
    "010": rule_010,
    "015": rule_015,
    "016": rule_016,
    "017": rule_017,
    "020": rule_020,
    "027": rule_027,
    "034": rule_034,
    "038": rule_038,
    "056": rule_056,
    "057": rule_057,
    "066": rule_066,
    "069": rule_069,
    "077": rule_077,
    "078": rule_078,
    "079": rule_079,
    "082": rule_082,
    "084": rule_084,
    "085": rule_085,
    "087": rule_087,
}

# Cards that need keys parameter
KEYS_RULES = {"017", "066"}


# =============================================================================
# Factory mapping pour générer les règles depuis JSON
# =============================================================================

def _create_rule_from_json(rule_data: dict) -> Callable | None:
    """Crée une fonction de règle à partir des données JSON."""
    rule_type = rule_data.get("type")

    if rule_type == "shields_in_col":
        return make_shields_in_col_rule(rule_data["color"], rule_data["multiplier"])

    elif rule_type == "shields_in_row":
        return make_shields_in_row_rule(rule_data["color"], rule_data["multiplier"])

    elif rule_type == "shields_in_row_and_col":
        return make_shields_in_row_and_col_rule(rule_data["color"], rule_data["multiplier"])

    elif rule_type == "position":
        return make_position_rule(rule_data["position"], rule_data["score"])

    elif rule_type == "shield_pairs":
        colors = rule_data["colors"]
        return make_pairs_rule(colors[0], colors[1], rule_data["multiplier"])

    elif rule_type == "shield_trios":
        return make_trios_rule(rule_data["colors"], rule_data["multiplier"])

    elif rule_type == "no_shield_color":
        return make_no_shield_rule(rule_data["color"], rule_data["score"])

    elif rule_type == "coins_on_card":
        return make_coins_on_card_rule(rule_data["max_coins"], rule_data["multiplier"])

    elif rule_type == "shield_threshold":
        return make_threshold_rule(
            rule_data["color"],
            rule_data["scope"],
            rule_data["threshold"],
            rule_data["score"]
        )

    elif rule_type == "category_count":
        return make_category_count_rule(rule_data["category"], rule_data["multiplier"])

    elif rule_type == "unique_colors":
        return make_unique_colors_rule(rule_data["scope"], rule_data["multiplier"])

    elif rule_type == "feature_count":
        return make_feature_count_rule(rule_data["feature"], rule_data["multiplier"])

    elif rule_type == "exact_value_count":
        return make_exact_value_rule(rule_data["value"], rule_data["multiplier"])

    elif rule_type == "min_value_count":
        return make_min_value_rule(rule_data["min_value"], rule_data["multiplier"])

    elif rule_type == "flipped_card":
        return make_flipped_card_rule()

    # Types gérés par CUSTOM_RULES
    return None


def _build_rules_dict() -> dict[str, Callable]:
    """Construit le dictionnaire RULES depuis cards_data.json."""
    cards_data = load_cards_data()
    rules = {}

    for card_id, card in cards_data.items():
        # D'abord vérifier si c'est une règle custom
        if card_id in CUSTOM_RULES:
            rules[card_id] = CUSTOM_RULES[card_id]
            continue

        # Sinon, essayer de générer depuis le JSON
        scoring_rule = card.get("scoring_rule", {})
        rule_func = _create_rule_from_json(scoring_rule)

        if rule_func:
            rules[card_id] = rule_func
        else:
            # Fallback: règle qui retourne 0
            rule_type = scoring_rule.get("type", "unknown")
            print(f"Warning: No rule generator for card {card_id} (type: {rule_type})")
            rules[card_id] = lambda g, p: (0, f"Règle non implémentée")

    return rules


# =============================================================================
# Build RULES dict at import time
# =============================================================================

RULES: dict[str, Callable] = _build_rules_dict()
