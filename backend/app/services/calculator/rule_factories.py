"""Factory functions pour générer des règles de scoring réutilisables.

Ce module fournit des fonctions factory qui créent des règles de scoring
pour les patterns répétitifs. Cela réduit la duplication dans rules.py
tout en gardant la compatibilité avec le système existant.
"""

from typing import Callable, Literal
from .grid import Grid

# Type alias pour les fonctions de règle
RuleFunction = Callable[[Grid, int], tuple[int, str]]

# Mapping couleur anglais -> français (avec accord)
COLOR_NAMES = {
    "blue": ("bleu", "bleus"),
    "green": ("vert", "verts"),
    "orange": ("orange", "oranges"),
    "pink": ("violet", "violets"),
    "red": ("rouge", "rouges"),
    "yellow": ("jaune", "jaunes"),
}


def pluriel(n: int, singular: str, plural: str | None = None) -> str:
    """Return singular or plural form based on count."""
    if plural is None:
        plural = singular + "s"
    return singular if n <= 1 else plural


def boucliers(n: int, color: str) -> str:
    """Format shield count with color (handles plural for both noun and adjective)."""
    singular, plural_color = COLOR_NAMES.get(color, (color, color + "s"))
    if n <= 1:
        return f"{n} bouclier {singular}"
    else:
        return f"{n} boucliers {plural_color}"


# =============================================================================
# Factory: Boucliers sur rangée
# =============================================================================


def make_shields_in_row_rule(color: str, multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les boucliers d'une couleur sur la même rangée.

    Exemple: rule_013 = make_shields_in_row_rule("blue", 4)
    -> "4 points pour chaque bouclier bleu sur cette rangée"
    """
    singular, _ = COLOR_NAMES.get(color, (color, color))

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        count = grid.count_shields_in_row(position, color)
        score = count * multiplier
        if count == 0:
            explanation = f"Tu n'as aucun bouclier {singular} sur cette rangée."
        else:
            explanation = f"""Tu as {boucliers(count, color)} sur cette rangée.
{count} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Boucliers sur colonne
# =============================================================================


def make_shields_in_col_rule(color: str, multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les boucliers d'une couleur sur la même colonne.

    Exemple: rule_001 = make_shields_in_col_rule("blue", 4)
    -> "4 points pour chaque bouclier bleu sur cette colonne"
    """
    singular, _ = COLOR_NAMES.get(color, (color, color))

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        count = grid.count_shields_in_col(position, color)
        score = count * multiplier
        if count == 0:
            explanation = f"Tu n'as aucun bouclier {singular} sur cette colonne."
        else:
            explanation = f"""Tu as {boucliers(count, color)} sur cette colonne.
{count} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Boucliers sur rangée ET colonne
# =============================================================================


def make_shields_in_row_and_col_rule(color: str, multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les boucliers sur rangée ET colonne (sans double-compte).

    Exemple: rule_019 = make_shields_in_row_and_col_rule("blue", 2)
    -> "2 points pour chaque bouclier bleu sur cette rangée et cette colonne"
    """
    singular, _ = COLOR_NAMES.get(color, (color, color))

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        row_count = grid.count_shields_in_row(position, color)
        col_count = grid.count_shields_in_col(position, color)
        self_count = grid.count_shields_on_card(position, color)
        count = row_count + col_count - self_count  # Évite de compter la carte deux fois
        score = count * multiplier

        if count == 0:
            explanation = f"Tu n'as aucun bouclier {singular}. Ni sur cette rangée, ni sur cette colonne."
        else:
            if row_count > 0:
                row_text = f"Tu as {boucliers(row_count, color)} sur cette rangée"
            else:
                row_text = f"Tu n'as aucun bouclier {singular} sur cette rangée"

            if col_count > 0:
                col_text = f"Tu as {boucliers(col_count, color)} sur cette colonne"
            else:
                col_text = f"Tu n'as aucun bouclier {singular} sur cette colonne"

            explanation = f"""- {row_text}
- {col_text}
{count} x {multiplier} = {score} points"""

        return score, explanation

    return rule


# =============================================================================
# Factory: Position (top_row, bottom_row, left_col, right_col, corner, center)
# =============================================================================


PositionCheck = Literal[
    "top_row", "middle_row", "bottom_row",
    "left_col", "middle_col", "right_col",
    "corner", "border", "center"
]

POSITION_CHECKS = {
    "top_row": ("is_top_row", "sur la rangée du haut", "pas sur la rangée du haut"),
    "middle_row": ("is_middle_row", "sur la rangée du milieu", "pas sur la rangée du milieu"),
    "bottom_row": ("is_bottom_row", "sur la rangée du bas", "pas sur la rangée du bas"),
    "left_col": ("is_left_col", "sur la colonne de gauche", "pas sur la colonne de gauche"),
    "middle_col": ("is_middle_col", "sur la colonne du milieu", "pas sur la colonne du milieu"),
    "right_col": ("is_right_col", "sur la colonne de droite", "pas sur la colonne de droite"),
    "corner": ("is_corner", "sur un coin", "pas sur un coin"),
    "border": ("is_border", "sur un bord (pas un coin)", "pas sur un bord"),
    "center": ("is_center", "au centre", "pas au centre"),
}


def make_position_rule(position_check: PositionCheck, score: int) -> RuleFunction:
    """
    Crée une règle basée sur la position de la carte.

    Exemple: rule_003 = make_position_rule("top_row", 8)
    -> "8 points si la carte est sur la rangée du haut"
    """
    method_name, success_text, failure_text = POSITION_CHECKS[position_check]

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        check_method = getattr(grid, method_name)
        if check_method(position):
            return score, f"Ta carte est bien {success_text}.\n{score} points"
        return 0, f"Ta carte n'est {failure_text}."

    return rule


# =============================================================================
# Factory: Paires de boucliers
# =============================================================================


def make_pairs_rule(color1: str, color2: str, multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les paires de deux couleurs de boucliers.

    Exemple: rule_008 = make_pairs_rule("pink", "orange", 4)
    -> "4 points pour chaque paire de boucliers violet/orange"
    """
    name1, _ = COLOR_NAMES.get(color1, (color1, color1))
    name2, _ = COLOR_NAMES.get(color2, (color2, color2))

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        count1 = grid.count_shields_on_board(color1)
        count2 = grid.count_shields_on_board(color2)
        pairs = min(count1, count2)
        score = pairs * multiplier
        explanation = f"""- {boucliers(count1, color1)}
- {boucliers(count2, color2)}
Tu as {pairs} {pluriel(pairs, 'paire')} de boucliers {name1}/{name2}.
{pairs} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Trios de boucliers
# =============================================================================


def make_trios_rule(colors: list[str], multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les trios de couleurs de boucliers.

    Exemple: rule_018 = make_trios_rule(["blue", "green", "orange"], 10)
    -> "10 points pour chaque trio de boucliers bleu/vert/orange"
    """
    names = [COLOR_NAMES.get(c, (c, c))[0] for c in colors]
    colors_str = "/".join(names)

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        counts = [grid.count_shields_on_board(c) for c in colors]
        trios = min(counts)
        score = trios * multiplier

        lines = [f"- {boucliers(count, color)}" for count, color in zip(counts, colors)]
        explanation = "\n".join(lines) + f"""
Tu as {trios} {pluriel(trios, 'trio')} de boucliers {colors_str}.
{trios} x {multiplier} = {score} points"""

        return score, explanation

    return rule


# =============================================================================
# Factory: Aucun bouclier d'une couleur
# =============================================================================


def make_no_shield_rule(color: str, score: int) -> RuleFunction:
    """
    Crée une règle qui donne des points si aucun bouclier d'une couleur n'est présent.

    Exemple: rule_026 = make_no_shield_rule("yellow", 10)
    -> "10 points si aucun bouclier jaune sur le plateau"
    """
    singular, _ = COLOR_NAMES.get(color, (color, color))

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        count = grid.count_shields_on_board(color)
        if count == 0:
            return score, f"Tu n'as aucun bouclier {singular} sur le plateau.\n{score} points"
        return 0, f"Tu as {boucliers(count, color)} sur le plateau."

    return rule


# =============================================================================
# Factory: Pièces sur carte
# =============================================================================


def make_coins_on_card_rule(max_coins: int, multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les pièces sur la carte (avec un maximum).

    Exemple: rule_014 = make_coins_on_card_rule(3, 2)
    -> "2 points pour chaque pièce sur cette carte (max 3)"
    """
    def rule(grid: Grid, position: int) -> tuple[int, str]:
        card_id = grid.get_card_at(position)
        coins = min(grid.get_coins_on_card(card_id), max_coins)
        score = coins * multiplier
        if coins == 0:
            explanation = "Tu n'as aucune pièce sur cette carte."
        else:
            explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max {max_coins}).
{coins} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Seuil minimum de boucliers
# =============================================================================


def make_threshold_rule(
    color: str,
    scope: Literal["row", "col", "board"],
    threshold: int,
    score: int
) -> RuleFunction:
    """
    Crée une règle qui donne des points si au moins N boucliers d'une couleur.

    Exemple: rule_002 = make_threshold_rule("green", "col", 1, 5)
    -> "5 points si au moins 1 bouclier vert sur la colonne"
    """
    singular, _ = COLOR_NAMES.get(color, (color, color))

    scope_methods = {
        "row": ("count_shields_in_row", "cette rangée"),
        "col": ("count_shields_in_col", "cette colonne"),
        "board": ("count_shields_on_board", "le plateau"),
    }
    method_name, scope_text = scope_methods[scope]

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        method = getattr(grid, method_name)
        # count_shields_on_board ne prend pas position
        if scope == "board":
            count = method(color)
        else:
            count = method(position, color)

        if count == 0:
            return 0, f"Tu n'as aucun bouclier {singular} sur {scope_text}."
        elif count < threshold:
            return 0, f"Tu n'as que {boucliers(count, color)} sur {scope_text} (il en faut {threshold})."
        elif count == threshold:
            return score, f"Tu as au moins {threshold} bouclier {singular} sur {scope_text}.\n{score} points"
        else:
            return score, f"Tu as au moins {threshold} bouclier {singular} sur {scope_text}. Tu en as même {count}.\n{score} points"

    return rule


# =============================================================================
# Factory: Comptage de catégories (village/château)
# =============================================================================


def make_category_count_rule(
    category: Literal["village", "castle"],
    multiplier: int
) -> RuleFunction:
    """
    Crée une règle qui compte les cartes d'une catégorie.

    Exemple: rule_006 = make_category_count_rule("village", 2)
    -> "2 points pour chaque carte village"
    """
    category_names = {"village": "village", "castle": "château"}
    cat_name = category_names[category]

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        if category == "village":
            count = grid.count_village_cards()
        else:
            count = grid.count_castle_cards()

        score = count * multiplier
        if count == 0:
            explanation = f"Tu n'as aucune carte {cat_name}."
        else:
            explanation = f"""Tu as {count} {pluriel(count, 'carte')} {cat_name}.
{count} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Couleurs uniques
# =============================================================================


def make_unique_colors_rule(
    scope: Literal["row", "col", "board"],
    multiplier: int
) -> RuleFunction:
    """
    Crée une règle qui compte les couleurs uniques de boucliers.

    Exemple: rule_005 = make_unique_colors_rule("row", 4)
    -> "4 points pour chaque couleur différente sur la rangée"
    """
    scope_methods = {
        "row": ("get_unique_colors_in_row", "cette rangée"),
        "col": ("get_unique_colors_in_col", "cette colonne"),
        "board": ("get_unique_colors_on_board", "le plateau"),
    }
    method_name, scope_text = scope_methods[scope]

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        method = getattr(grid, method_name)
        # get_unique_colors_on_board ne prend pas position
        if scope == "board":
            colors = method()
        else:
            colors = method(position)

        count = len(colors)
        score = count * multiplier

        if count == 0:
            explanation = f"Tu n'as aucune couleur de bouclier sur {scope_text}."
        else:
            suffix = "" if count <= 1 else "s"
            explanation = f"""Tu as {count} {pluriel(count, 'couleur')} différente{suffix} sur {scope_text}.
{count} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Cartes avec caractéristique spécifique
# =============================================================================


def make_feature_count_rule(
    feature: Literal["price_reduction", "lock", "coin_purse"],
    multiplier: int
) -> RuleFunction:
    """
    Crée une règle qui compte les cartes avec une caractéristique.

    Exemple: rule_032 = make_feature_count_rule("price_reduction", 4)
    -> "4 points pour chaque carte avec réduction de prix"
    """
    feature_methods = {
        "price_reduction": ("count_cards_with_price_reduction", "réduction de prix"),
        "lock": ("count_cards_with_lock", "cadenas"),
        "coin_purse": ("count_cards_with_coin_purse", "bourse"),
    }
    method_name, feature_text = feature_methods[feature]

    def rule(grid: Grid, position: int) -> tuple[int, str]:
        method = getattr(grid, method_name)
        count = method()
        score = count * multiplier

        if count == 0:
            explanation = f"Tu n'as aucune carte avec {feature_text}."
        else:
            explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec {feature_text}.
{count} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Cartes avec coût exact
# =============================================================================


def make_exact_value_rule(value: int, multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les cartes avec un coût exact.

    Exemple: rule_040 = make_exact_value_rule(4, 3)
    -> "3 points pour chaque carte avec un coût de 4"
    """
    def rule(grid: Grid, position: int) -> tuple[int, str]:
        count = grid.count_cards_with_exact_value(value)
        score = count * multiplier

        if count == 0:
            explanation = f"Tu n'as aucune carte avec un coût de {value}."
        else:
            explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec un coût de {value}.
{count} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Cartes avec coût minimum
# =============================================================================


def make_min_value_rule(min_value: int, multiplier: int) -> RuleFunction:
    """
    Crée une règle qui compte les cartes avec un coût >= N.

    Exemple: rule_039 = make_min_value_rule(5, 5)
    -> "5 points pour chaque carte avec un coût de 5 ou plus"
    """
    def rule(grid: Grid, position: int) -> tuple[int, str]:
        count = grid.count_cards_with_value_or_more(min_value)
        score = count * multiplier

        if count == 0:
            explanation = f"Tu n'as aucune carte avec un coût de {min_value} ou plus."
        else:
            explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec un coût de {min_value} ou plus.
{count} x {multiplier} = {score} points"""
        return score, explanation

    return rule


# =============================================================================
# Factory: Carte retournée (0 points)
# =============================================================================


def make_flipped_card_rule() -> RuleFunction:
    """
    Crée une règle pour une carte retournée (0 points).
    """
    def rule(grid: Grid, position: int) -> tuple[int, str]:
        return 0, "Cette carte est retournée et ne rapporte pas de points."

    return rule
