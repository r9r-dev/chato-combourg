"""Scoring rules for each card (001-092).

Ce module définit les règles de scoring pour les 92 cartes du jeu.
Les règles simples utilisent les factories de rule_factories.py.
Les règles complexes restent définies explicitement.
"""

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
# Règles générées par factories
# =============================================================================

# Boucliers sur colonne
rule_001 = make_shields_in_col_rule("blue", 4)
rule_009 = make_shields_in_col_rule("blue", 3)
rule_033 = make_shields_in_col_rule("green", 3)
rule_037 = make_shields_in_col_rule("pink", 3)
rule_045 = make_shields_in_col_rule("red", 3)
rule_055 = make_shields_in_col_rule("yellow", 3)

# Boucliers sur rangée
rule_011 = make_shields_in_row_rule("green", 3)
rule_013 = make_shields_in_row_rule("blue", 4)
rule_028 = make_shields_in_row_rule("blue", 3)
rule_043 = make_shields_in_row_rule("red", 3)
rule_048 = make_shields_in_row_rule("pink", 3)
rule_060 = make_shields_in_row_rule("orange", 3)
rule_067 = make_shields_in_row_rule("yellow", 3)
rule_073 = make_shields_in_row_rule("orange", 3)

# Boucliers sur rangée ET colonne
rule_019 = make_shields_in_row_and_col_rule("blue", 2)
rule_023 = make_shields_in_row_and_col_rule("blue", 3)
rule_042 = make_shields_in_row_and_col_rule("green", 3)
rule_062 = make_shields_in_row_and_col_rule("pink", 2)
rule_065 = make_shields_in_row_and_col_rule("red", 3)
rule_080 = make_shields_in_row_and_col_rule("orange", 2)
rule_092 = make_shields_in_row_and_col_rule("yellow", 2)

# Position
rule_003 = make_position_rule("top_row", 8)
rule_007 = make_position_rule("bottom_row", 5)
rule_021 = make_position_rule("left_col", 8)
rule_030 = make_position_rule("left_col", 6)
rule_031 = make_position_rule("right_col", 8)
rule_047 = make_position_rule("top_row", 5)
rule_049 = make_position_rule("right_col", 5)
rule_052 = make_position_rule("middle_col", 6)
rule_063 = make_position_rule("bottom_row", 7)
rule_071 = make_position_rule("middle_row", 5)

# Paires de boucliers
rule_008 = make_pairs_rule("pink", "orange", 4)
rule_022 = make_pairs_rule("blue", "red", 4)
rule_068 = make_pairs_rule("green", "yellow", 4)

# Trios de boucliers
rule_018 = make_trios_rule(["blue", "green", "orange"], 10)
rule_054 = make_trios_rule(["pink", "red", "yellow"], 7)

# Aucun bouclier d'une couleur
rule_026 = make_no_shield_rule("yellow", 10)
rule_044 = make_no_shield_rule("orange", 10)
rule_064 = make_no_shield_rule("pink", 9)
rule_072 = make_no_shield_rule("green", 10)
rule_083 = make_no_shield_rule("red", 10)
rule_091 = make_no_shield_rule("blue", 9)

# Pièces sur carte
rule_014 = make_coins_on_card_rule(3, 2)
rule_025 = make_coins_on_card_rule(5, 2)
rule_036 = make_coins_on_card_rule(8, 2)
rule_041 = make_coins_on_card_rule(4, 2)
rule_050 = make_coins_on_card_rule(4, 2)
rule_051 = make_coins_on_card_rule(5, 2)
rule_053 = make_coins_on_card_rule(9, 2)
rule_058 = make_coins_on_card_rule(6, 2)
rule_059 = make_coins_on_card_rule(4, 2)
rule_061 = make_coins_on_card_rule(7, 2)
rule_081 = make_coins_on_card_rule(5, 2)

# Seuil minimum de boucliers
rule_002 = make_threshold_rule("green", "col", 1, 5)
rule_035 = make_threshold_rule("pink", "row", 1, 5)
rule_075 = make_threshold_rule("red", "row", 1, 7)
rule_088 = make_threshold_rule("blue", "col", 1, 3)

# Comptage de catégories
rule_006 = make_category_count_rule("village", 2)
rule_046 = make_category_count_rule("castle", 2)
rule_074 = make_category_count_rule("castle", 2)

# Couleurs uniques
rule_005 = make_unique_colors_rule("row", 4)
rule_012 = make_unique_colors_rule("row", 2)
rule_024 = make_unique_colors_rule("board", 2)
rule_029 = make_unique_colors_rule("col", 4)
rule_076 = make_unique_colors_rule("col", 2)

# Caractéristiques (price_reduction, lock, coin_purse)
rule_032 = make_feature_count_rule("price_reduction", 4)
rule_070 = make_feature_count_rule("lock", 4)

# Coût exact
rule_040 = make_exact_value_rule(4, 3)
rule_086 = make_exact_value_rule(0, 2)

# Coût minimum
rule_039 = make_min_value_rule(5, 5)

# Cartes retournées
rule_089 = make_flipped_card_rule()
rule_090 = make_flipped_card_rule()


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
# Mapping from card ID to rule function
# =============================================================================

RULES: dict[str, callable] = {
    "001": rule_001,
    "002": rule_002,
    "003": rule_003,
    "004": rule_004,
    "005": rule_005,
    "006": rule_006,
    "007": rule_007,
    "008": rule_008,
    "009": rule_009,
    "010": rule_010,
    "011": rule_011,
    "012": rule_012,
    "013": rule_013,
    "014": rule_014,
    "015": rule_015,
    "016": rule_016,
    "017": rule_017,
    "018": rule_018,
    "019": rule_019,
    "020": rule_020,
    "021": rule_021,
    "022": rule_022,
    "023": rule_023,
    "024": rule_024,
    "025": rule_025,
    "026": rule_026,
    "027": rule_027,
    "028": rule_028,
    "029": rule_029,
    "030": rule_030,
    "031": rule_031,
    "032": rule_032,
    "033": rule_033,
    "034": rule_034,
    "035": rule_035,
    "036": rule_036,
    "037": rule_037,
    "038": rule_038,
    "039": rule_039,
    "040": rule_040,
    "041": rule_041,
    "042": rule_042,
    "043": rule_043,
    "044": rule_044,
    "045": rule_045,
    "046": rule_046,
    "047": rule_047,
    "048": rule_048,
    "049": rule_049,
    "050": rule_050,
    "051": rule_051,
    "052": rule_052,
    "053": rule_053,
    "054": rule_054,
    "055": rule_055,
    "056": rule_056,
    "057": rule_057,
    "058": rule_058,
    "059": rule_059,
    "060": rule_060,
    "061": rule_061,
    "062": rule_062,
    "063": rule_063,
    "064": rule_064,
    "065": rule_065,
    "066": rule_066,
    "067": rule_067,
    "068": rule_068,
    "069": rule_069,
    "070": rule_070,
    "071": rule_071,
    "072": rule_072,
    "073": rule_073,
    "074": rule_074,
    "075": rule_075,
    "076": rule_076,
    "077": rule_077,
    "078": rule_078,
    "079": rule_079,
    "080": rule_080,
    "081": rule_081,
    "082": rule_082,
    "083": rule_083,
    "084": rule_084,
    "085": rule_085,
    "086": rule_086,
    "087": rule_087,
    "088": rule_088,
    "089": rule_089,
    "090": rule_090,
    "091": rule_091,
    "092": rule_092,
}

# Cards that need keys parameter
KEYS_RULES = {"017", "066"}
