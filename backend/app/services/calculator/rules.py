"""Scoring rules for each card (001-092)."""

from .grid import Grid


def pluriel(n: int, singular: str, plural: str = None) -> str:
    """Return singular or plural form based on count."""
    if plural is None:
        plural = singular + "s"
    return singular if n <= 1 else plural


def boucliers(n: int, color: str) -> str:
    """Format shield count with color (handles plural for both noun and adjective)."""
    # Pluralize both "bouclier" and the color adjective
    if n <= 1:
        return f"{n} bouclier {color}"
    else:
        return f"{n} boucliers {color}s"


def rule_001(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each blue shield on the same column."""
    count = grid.count_shields_in_col(position, "blue")
    score = count * 4
    if count == 0:
        explanation = "Tu n'as aucun bouclier bleu sur cette colonne."
    else:
        explanation = f"""Tu as {boucliers(count, 'bleu')} sur cette colonne.
{count} x 4 = {score} points"""
    return score, explanation


def rule_002(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if at least one green shield on the same column."""
    count = grid.count_shields_in_col(position, "green")
    if count == 0:
        return 0, "Tu n'as aucun bouclier vert sur cette colonne."
    elif count == 1:
        return 5, "Tu as au moins un bouclier vert sur cette colonne.\n5 points"
    else:
        return 5, f"Tu as au moins un bouclier vert sur cette colonne. Tu en as même {count}.\n5 points"


def rule_003(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if this card is on the top row."""
    if grid.is_top_row(position):
        return 8, "Ta carte est bien sur la rangée du haut.\n8 points"
    return 0, "Ta carte n'est pas sur la rangée du haut."


def rule_004(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if there is no card with price reduction."""
    if grid.count_cards_with_price_reduction() == 0:
        return 8, "8 points (aucune carte avec réduction de prix)"
    return 0, "0 point (il y a des cartes avec réduction de prix)"


def rule_005(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each different shield color on the same row."""
    colors = grid.get_unique_colors_in_row(position)
    count = len(colors)
    score = count * 4
    if count == 0:
        explanation = "Tu n'as aucune couleur de bouclier sur cette rangée."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'couleur')} différente{'' if count <= 1 else 's'} sur cette rangée.
{count} x 4 = {score} points"""
    return score, explanation


def rule_006(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card from village."""
    count = grid.count_village_cards()
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune carte village."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} village.
{count} x 2 = {score} points"""
    return score, explanation


def rule_007(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the bottom row."""
    if grid.is_bottom_row(position):
        return 5, "Ta carte est bien sur la rangée du bas.\n5 points"
    return 0, "Ta carte n'est pas sur la rangée du bas."


def rule_008(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each pair of pink/orange shields."""
    violet = grid.count_shields_on_board("pink")
    orange = grid.count_shields_on_board("orange")
    pairs = min(violet, orange)
    score = pairs * 4
    explanation = f"""- {boucliers(violet, 'violet')}
- {boucliers(orange, 'orange')}
Tu as {pairs} {pluriel(pairs, 'paire')} de boucliers violet/orange.
{pairs} x 4 = {score} points"""
    return score, explanation


def rule_009(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each blue shield on the same column."""
    count = grid.count_shields_in_col(position, "blue")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier bleu sur cette colonne."
    else:
        explanation = f"""Tu as {boucliers(count, 'bleu')} sur cette colonne.
{count} x 3 = {score} points"""
    return score, explanation


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


def rule_011(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each green shield on the same row."""
    count = grid.count_shields_in_row(position, "green")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier vert sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'vert')} sur cette rangée.
{count} x 3 = {score} points"""
    return score, explanation


def rule_012(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each different shield color on the same row."""
    colors = grid.get_unique_colors_in_row(position)
    count = len(colors)
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune couleur de bouclier sur cette rangée."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'couleur')} différente{'' if count <= 1 else 's'} sur cette rangée.
{count} x 2 = {score} points"""
    return score, explanation


def rule_013(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each blue shield on the same row."""
    count = grid.count_shields_in_row(position, "blue")
    score = count * 4
    if count == 0:
        explanation = "Tu n'as aucun bouclier bleu sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'bleu')} sur cette rangée.
{count} x 4 = {score} points"""
    return score, explanation


def rule_014(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 3 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 3)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 3).
{coins} x 2 = {score} points"""
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
        explanation = f"Tu as 1 clé.\n1 x 1 = 1 point"
    else:
        explanation = f"Tu as {keys} clés.\n{keys} x 1 = {score} points"
    return score, explanation


def rule_018(grid: Grid, position: int) -> tuple[int, str]:
    """10 points for each trio of blue/green/orange shields."""
    bleu = grid.count_shields_on_board("blue")
    vert = grid.count_shields_on_board("green")
    orange = grid.count_shields_on_board("orange")
    trios = min(bleu, vert, orange)
    score = trios * 10
    explanation = f"""- {boucliers(bleu, 'bleu')}
- {boucliers(vert, 'vert')}
- {boucliers(orange, 'orange')}
Tu as {trios} {pluriel(trios, 'trio')} de boucliers bleu/vert/orange.
{trios} x 10 = {score} points"""
    return score, explanation


def rule_019(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each blue shield on the same row and the same column."""
    row_count = grid.count_shields_in_row(position, "blue")
    col_count = grid.count_shields_in_col(position, "blue")
    self_count = grid.count_shields_on_card(position, "blue")
    count = row_count + col_count - self_count  # Avoid counting card twice
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucun bouclier bleu. Ni sur cette rangée, ni sur cette colonne."
    else:
        row_text = f"Tu as {boucliers(row_count, 'bleu')} sur cette rangée" if row_count > 0 else "Tu n'as aucun bouclier bleu sur cette rangée"
        col_text = f"Tu as {boucliers(col_count, 'bleu')} sur cette colonne" if col_count > 0 else "Tu n'as aucun bouclier bleu sur cette colonne"
        explanation = f"""- {row_text}
- {col_text}
{count} x 2 = {score} points"""
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


def rule_021(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if the card is on the left column."""
    if grid.is_left_col(position):
        return 8, "Ta carte est bien sur la colonne de gauche.\n8 points"
    return 0, "Ta carte n'est pas sur la colonne de gauche."


def rule_022(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each pair of blue/red shields."""
    bleu = grid.count_shields_on_board("blue")
    rouge = grid.count_shields_on_board("red")
    paires = min(bleu, rouge)
    score = paires * 4
    explanation = f"""- {boucliers(bleu, 'bleu')}
- {boucliers(rouge, 'rouge')}
Tu as {paires} {pluriel(paires, 'paire')} de boucliers bleu/rouge.
{paires} x 4 = {score} points"""
    return score, explanation


def rule_023(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each blue shield on the same row and the same column."""
    row_count = grid.count_shields_in_row(position, "blue")
    col_count = grid.count_shields_in_col(position, "blue")
    self_count = grid.count_shields_on_card(position, "blue")
    count = row_count + col_count - self_count  # Avoid counting card twice
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier bleu. Ni sur cette rangée, ni sur cette colonne."
    else:
        row_text = f"Tu as {boucliers(row_count, 'bleu')} sur cette rangée" if row_count > 0 else "Tu n'as aucun bouclier bleu sur cette rangée"
        col_text = f"Tu as {boucliers(col_count, 'bleu')} sur cette colonne" if col_count > 0 else "Tu n'as aucun bouclier bleu sur cette colonne"
        explanation = f"""- {row_text}
- {col_text}
{count} x 3 = {score} points"""
    return score, explanation


def rule_024(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each different shield color on the board."""
    colors = grid.get_unique_colors_on_board()
    count = len(colors)
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune couleur de bouclier sur le plateau."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'couleur')} différente{'' if count <= 1 else 's'} sur le plateau.
{count} x 2 = {score} points"""
    return score, explanation


def rule_025(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 5 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 5)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 5).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_026(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if the board has no yellow shield."""
    count = grid.count_shields_on_board("yellow")
    if count == 0:
        return 10, "Tu n'as aucun bouclier jaune sur le plateau.\n10 points"
    return 0, f"Tu as {boucliers(count, 'jaune')} sur le plateau."


def rule_027(grid: Grid, position: int) -> tuple[int, str]:
    """6 points for each time 3 shields of the same color can be counted on the board."""
    color_names = {
        "blue": "bleu", "green": "vert", "orange": "orange",
        "pink": "violet", "red": "rouge", "yellow": "jaune"
    }
    total_sets = 0
    details = []
    for color in Grid.COLORS:
        count = grid.count_shields_on_board(color)
        sets = count // 3
        total_sets += sets
        if sets > 0:
            french_color = color_names[color]
            plural_suffix = "s" if sets > 1 else ""
            details.append(f"- Tu as {sets} {pluriel(sets, 'lot')} de 3 boucliers {french_color}s")
    score = total_sets * 6
    if total_sets == 0:
        explanation = "Tu n'as aucun lot de 3 boucliers de même couleur."
    else:
        explanation = "\n".join(details) + f"\n{total_sets} x 6 = {score} points"
    return score, explanation


def rule_028(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each blue shield on the same row."""
    count = grid.count_shields_in_row(position, "blue")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier bleu sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'bleu')} sur cette rangée.
{count} x 3 = {score} points"""
    return score, explanation


def rule_029(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each different shield color on the same column."""
    colors = grid.get_unique_colors_in_col(position)
    count = len(colors)
    score = count * 4
    if count == 0:
        explanation = "Tu n'as aucune couleur de bouclier sur cette colonne."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'couleur')} différente{'' if count <= 1 else 's'} sur cette colonne.
{count} x 4 = {score} points"""
    return score, explanation


def rule_030(grid: Grid, position: int) -> tuple[int, str]:
    """6 points if the card is on the left column."""
    if grid.is_left_col(position):
        return 6, "Ta carte est bien sur la colonne de gauche.\n6 points"
    return 0, "Ta carte n'est pas sur la colonne de gauche."


def rule_031(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if the card is on the right column."""
    if grid.is_right_col(position):
        return 8, "Ta carte est bien sur la colonne de droite.\n8 points"
    return 0, "Ta carte n'est pas sur la colonne de droite."


def rule_032(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each card with a price reduction on the board."""
    count = grid.count_cards_with_price_reduction()
    score = count * 4
    if count == 0:
        explanation = "Tu n'as aucune carte avec réduction de prix."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec réduction de prix.
{count} x 4 = {score} points"""
    return score, explanation


def rule_033(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each green shield on the same column."""
    count = grid.count_shields_in_col(position, "green")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier vert sur cette colonne."
    else:
        explanation = f"""Tu as {boucliers(count, 'vert')} sur cette colonne.
{count} x 3 = {score} points"""
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


def rule_035(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if at least one shield is pink on the same row."""
    count = grid.count_shields_in_row(position, "pink")
    if count == 0:
        return 0, "Tu n'as aucun bouclier violet sur cette rangée."
    elif count == 1:
        return 5, "Tu as au moins un bouclier violet sur cette rangée.\n5 points"
    else:
        return 5, f"Tu as au moins un bouclier violet sur cette rangée. Tu en as même {count}.\n5 points"


def rule_036(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 8 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 8)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 8).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_037(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each pink shield on the same column."""
    count = grid.count_shields_in_col(position, "pink")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier violet sur cette colonne."
    else:
        explanation = f"""Tu as {boucliers(count, 'violet')} sur cette colonne.
{count} x 3 = {score} points"""
    return score, explanation


def rule_038(grid: Grid, position: int) -> tuple[int, str]:
    """6 points for each different shield NOT on the board."""
    color_names = {
        "blue": "bleu", "green": "vert", "orange": "orange",
        "pink": "violet", "red": "rouge", "yellow": "jaune"
    }
    present_colors = grid.get_unique_colors_on_board()
    missing_colors = [c for c in Grid.COLORS if c not in present_colors]
    missing = len(missing_colors)
    score = missing * 6

    if missing == 0:
        explanation = "Il ne te manque aucun bouclier."
    elif missing == 6:
        explanation = f"Il te manque les 6 boucliers.\n{missing} x 6 = {score} points"
    elif missing == 1:
        color = color_names[missing_colors[0]]
        explanation = f"Il te manque le bouclier {color}.\n{missing} x 6 = {score} points"
    else:
        french_colors = [color_names[c] + "s" for c in missing_colors]
        if len(french_colors) == 2:
            colors_str = f"{french_colors[0]} et {french_colors[1]}"
        else:
            colors_str = ", ".join(french_colors[:-1]) + f" et {french_colors[-1]}"
        explanation = f"Il te manque les boucliers {colors_str}.\n{missing} x 6 = {score} points"

    return score, explanation


def rule_039(grid: Grid, position: int) -> tuple[int, str]:
    """5 points for each card with 5 price or more."""
    count = grid.count_cards_with_value_or_more(5)
    score = count * 5
    if count == 0:
        explanation = "Tu n'as aucune carte avec un coût de 5 ou plus."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec un coût de 5 ou plus.
{count} x 5 = {score} points"""
    return score, explanation


def rule_040(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each card with a price of exactly 4."""
    count = grid.count_cards_with_exact_value(4)
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucune carte avec un coût de 4."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec un coût de 4.
{count} x 3 = {score} points"""
    return score, explanation


def rule_041(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 4 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 4)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 4).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_042(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each green shield on the same row and same column."""
    row_count = grid.count_shields_in_row(position, "green")
    col_count = grid.count_shields_in_col(position, "green")
    self_count = grid.count_shields_on_card(position, "green")
    count = row_count + col_count - self_count  # Avoid counting card twice
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier vert. Ni sur cette rangée, ni sur cette colonne."
    else:
        row_text = f"Tu as {boucliers(row_count, 'vert')} sur cette rangée" if row_count > 0 else "Tu n'as aucun bouclier vert sur cette rangée"
        col_text = f"Tu as {boucliers(col_count, 'vert')} sur cette colonne" if col_count > 0 else "Tu n'as aucun bouclier vert sur cette colonne"
        explanation = f"""- {row_text}
- {col_text}
{count} x 3 = {score} points"""
    return score, explanation


def rule_043(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each red shield on the same row."""
    count = grid.count_shields_in_row(position, "red")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier rouge sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'rouge')} sur cette rangée.
{count} x 3 = {score} points"""
    return score, explanation


def rule_044(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if the board has no orange shield."""
    count = grid.count_shields_on_board("orange")
    if count == 0:
        return 10, "Tu n'as aucun bouclier orange sur le plateau.\n10 points"
    return 0, f"Tu as {boucliers(count, 'orange')} sur le plateau."


def rule_045(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each red shield on the same column."""
    count = grid.count_shields_in_col(position, "red")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier rouge sur cette colonne."
    else:
        explanation = f"""Tu as {boucliers(count, 'rouge')} sur cette colonne.
{count} x 3 = {score} points"""
    return score, explanation


def rule_046(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card from castle on the board."""
    count = grid.count_castle_cards()
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune carte château."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} château.
{count} x 2 = {score} points"""
    return score, explanation


def rule_047(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the top row."""
    if grid.is_top_row(position):
        return 5, "Ta carte est bien sur la rangée du haut.\n5 points"
    return 0, "Ta carte n'est pas sur la rangée du haut."


def rule_048(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each pink shield on the same row."""
    count = grid.count_shields_in_row(position, "pink")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier violet sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'violet')} sur cette rangée.
{count} x 3 = {score} points"""
    return score, explanation


def rule_049(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the right column."""
    if grid.is_right_col(position):
        return 5, "Ta carte est bien sur la colonne de droite.\n5 points"
    return 0, "Ta carte n'est pas sur la colonne de droite."


def rule_050(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 4 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 4)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 4).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_051(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 5 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 5)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 5).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_052(grid: Grid, position: int) -> tuple[int, str]:
    """6 points if this card is on the middle column."""
    if grid.is_middle_col(position):
        return 6, "Ta carte est bien sur la colonne du milieu.\n6 points"
    return 0, "Ta carte n'est pas sur la colonne du milieu."


def rule_053(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 9 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 9)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 9).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_054(grid: Grid, position: int) -> tuple[int, str]:
    """7 points for each trio of pink/red/yellow shields."""
    violet = grid.count_shields_on_board("pink")
    rouge = grid.count_shields_on_board("red")
    jaune = grid.count_shields_on_board("yellow")
    trios = min(violet, rouge, jaune)
    score = trios * 7
    explanation = f"""- {boucliers(violet, 'violet')}
- {boucliers(rouge, 'rouge')}
- {boucliers(jaune, 'jaune')}
Tu as {trios} {pluriel(trios, 'trio')} de boucliers violet/rouge/jaune.
{trios} x 7 = {score} points"""
    return score, explanation


def rule_055(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each yellow shield on the same column."""
    count = grid.count_shields_in_col(position, "yellow")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier jaune sur cette colonne."
    else:
        explanation = f"""Tu as {boucliers(count, 'jaune')} sur cette colonne.
{count} x 3 = {score} points"""
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


def rule_058(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 6 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 6)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 6).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_059(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 4 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 4)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 4).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_060(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each orange shield on the same row."""
    count = grid.count_shields_in_row(position, "orange")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier orange sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'orange')} sur cette rangée.
{count} x 3 = {score} points"""
    return score, explanation


def rule_061(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 7 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 7)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 7).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_062(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each pink shield on the same row and the same column."""
    row_count = grid.count_shields_in_row(position, "pink")
    col_count = grid.count_shields_in_col(position, "pink")
    self_count = grid.count_shields_on_card(position, "pink")
    count = row_count + col_count - self_count  # Avoid counting card twice
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucun bouclier violet. Ni sur cette rangée, ni sur cette colonne."
    else:
        row_text = f"Tu as {boucliers(row_count, 'violet')} sur cette rangée" if row_count > 0 else "Tu n'as aucun bouclier violet sur cette rangée"
        col_text = f"Tu as {boucliers(col_count, 'violet')} sur cette colonne" if col_count > 0 else "Tu n'as aucun bouclier violet sur cette colonne"
        explanation = f"""- {row_text}
- {col_text}
{count} x 2 = {score} points"""
    return score, explanation


def rule_063(grid: Grid, position: int) -> tuple[int, str]:
    """7 points if this card is on the bottom row."""
    if grid.is_bottom_row(position):
        return 7, "Ta carte est bien sur la rangée du bas.\n7 points"
    return 0, "Ta carte n'est pas sur la rangée du bas."


def rule_064(grid: Grid, position: int) -> tuple[int, str]:
    """9 points if there is no pink shield on the board."""
    count = grid.count_shields_on_board("pink")
    if count == 0:
        return 9, "Tu n'as aucun bouclier violet sur le plateau.\n9 points"
    return 0, f"Tu as {boucliers(count, 'violet')} sur le plateau."


def rule_065(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each red shield on the same row and the same column."""
    row_count = grid.count_shields_in_row(position, "red")
    col_count = grid.count_shields_in_col(position, "red")
    self_count = grid.count_shields_on_card(position, "red")
    count = row_count + col_count - self_count  # Avoid counting card twice
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier rouge. Ni sur cette rangée, ni sur cette colonne."
    else:
        row_text = f"Tu as {boucliers(row_count, 'rouge')} sur cette rangée" if row_count > 0 else "Tu n'as aucun bouclier rouge sur cette rangée"
        col_text = f"Tu as {boucliers(col_count, 'rouge')} sur cette colonne" if col_count > 0 else "Tu n'as aucun bouclier rouge sur cette colonne"
        explanation = f"""- {row_text}
- {col_text}
{count} x 3 = {score} points"""
    return score, explanation


def rule_066(grid: Grid, position: int, keys: int) -> tuple[int, str]:
    """1 point for each key the player owns."""
    score = keys
    if keys == 0:
        explanation = "Tu n'as pas de clés."
    elif keys == 1:
        explanation = f"Tu as 1 clé.\n1 x 1 = 1 point"
    else:
        explanation = f"Tu as {keys} clés.\n{keys} x 1 = {score} points"
    return score, explanation


def rule_067(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each yellow shield on the same row."""
    count = grid.count_shields_in_row(position, "yellow")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier jaune sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'jaune')} sur cette rangée.
{count} x 3 = {score} points"""
    return score, explanation


def rule_068(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each pair of green/yellow shields."""
    vert = grid.count_shields_on_board("green")
    jaune = grid.count_shields_on_board("yellow")
    paires = min(vert, jaune)
    score = paires * 4
    explanation = f"""- {boucliers(vert, 'vert')}
- {boucliers(jaune, 'jaune')}
Tu as {paires} {pluriel(paires, 'paire')} de boucliers vert/jaune.
{paires} x 4 = {score} points"""
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


def rule_070(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each card with a lock."""
    count = grid.count_cards_with_lock()
    score = count * 4
    if count == 0:
        explanation = "Tu n'as aucune carte avec cadenas."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec cadenas.
{count} x 4 = {score} points"""
    return score, explanation


def rule_071(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the middle row."""
    if grid.is_middle_row(position):
        return 5, "Ta carte est bien sur la rangée du milieu.\n5 points"
    return 0, "Ta carte n'est pas sur la rangée du milieu."


def rule_072(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if there is no green shield on the board."""
    count = grid.count_shields_on_board("green")
    if count == 0:
        return 10, "Tu n'as aucun bouclier vert sur le plateau.\n10 points"
    return 0, f"Tu as {boucliers(count, 'vert')} sur le plateau."


def rule_073(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each orange shield on the same row."""
    count = grid.count_shields_in_row(position, "orange")
    score = count * 3
    if count == 0:
        explanation = "Tu n'as aucun bouclier orange sur cette rangée."
    else:
        explanation = f"""Tu as {boucliers(count, 'orange')} sur cette rangée.
{count} x 3 = {score} points"""
    return score, explanation


def rule_074(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card from castle."""
    count = grid.count_castle_cards()
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune carte château."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} château.
{count} x 2 = {score} points"""
    return score, explanation


def rule_075(grid: Grid, position: int) -> tuple[int, str]:
    """7 points if there is at least one red shield on the same row."""
    count = grid.count_shields_in_row(position, "red")
    if count == 0:
        return 0, "Tu n'as aucun bouclier rouge sur cette rangée."
    elif count == 1:
        return 7, "Tu as au moins un bouclier rouge sur cette rangée.\n7 points"
    else:
        return 7, f"Tu as au moins un bouclier rouge sur cette rangée. Tu en as même {count}.\n7 points"


def rule_076(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each different shield color on the same column."""
    colors = grid.get_unique_colors_in_col(position)
    count = len(colors)
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune couleur de bouclier sur cette colonne."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'couleur')} différente{'' if count <= 1 else 's'} sur cette colonne.
{count} x 2 = {score} points"""
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


def rule_080(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each orange shield on the same row and the same column."""
    row_count = grid.count_shields_in_row(position, "orange")
    col_count = grid.count_shields_in_col(position, "orange")
    self_count = grid.count_shields_on_card(position, "orange")
    count = row_count + col_count - self_count  # Avoid counting card twice
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucun bouclier orange. Ni sur cette rangée, ni sur cette colonne."
    else:
        row_text = f"Tu as {boucliers(row_count, 'orange')} sur cette rangée" if row_count > 0 else "Tu n'as aucun bouclier orange sur cette rangée"
        col_text = f"Tu as {boucliers(col_count, 'orange')} sur cette colonne" if col_count > 0 else "Tu n'as aucun bouclier orange sur cette colonne"
        explanation = f"""- {row_text}
- {col_text}
{count} x 2 = {score} points"""
    return score, explanation


def rule_081(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 5 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 5)
    score = coins * 2
    if coins == 0:
        explanation = "Tu n'as aucune pièce sur cette carte."
    else:
        explanation = f"""Tu as {coins} {pluriel(coins, 'pièce')} sur cette carte (max 5).
{coins} x 2 = {score} points"""
    return score, explanation


def rule_082(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if the board contains at least one 089 card or one 090 card."""
    count = grid.cards.count("089") + grid.cards.count("090")
    if count == 0:
        return 0, "Tu n'as aucune carte retournée."
    elif count == 1:
        return 8, "Tu as 1 carte retournée.\n8 points"
    else:
        return 8, f"Tu as {count} cartes retournées.\n8 points"


def rule_083(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if there is no red shield on the board."""
    count = grid.count_shields_on_board("red")
    if count == 0:
        return 10, "Tu n'as aucun bouclier rouge sur le plateau.\n10 points"
    return 0, f"Tu as {boucliers(count, 'rouge')} sur le plateau."


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


def rule_086(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card with price of exactly 0."""
    count = grid.count_cards_with_exact_value(0)
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucune carte avec un coût de 0."
    else:
        explanation = f"""Tu as {count} {pluriel(count, 'carte')} avec un coût de 0.
{count} x 2 = {score} points"""
    return score, explanation


def rule_087(grid: Grid, position: int) -> tuple[int, str]:
    """4 points if the card is placed on corners (not borders or center)."""
    if grid.is_corner(position):
        corner_names = {0: "en haut à gauche", 2: "en haut à droite", 6: "en bas à gauche", 8: "en bas à droite"}
        location = corner_names.get(position, "")
        return 4, f"Ta carte est bien dans un coin ({location}).\n4 points"
    return 0, "Ta carte n'est pas dans un coin."


def rule_088(grid: Grid, position: int) -> tuple[int, str]:
    """3 points if there is at least one blue shield on the same column."""
    count = grid.count_shields_in_col(position, "blue")
    if count == 0:
        return 0, "Tu n'as aucun bouclier bleu sur cette colonne."
    elif count == 1:
        return 3, "Tu as au moins un bouclier bleu sur cette colonne.\n3 points"
    else:
        return 3, f"Tu as au moins un bouclier bleu sur cette colonne. Tu en as même {count}.\n3 points"


def rule_089(grid: Grid, position: int) -> tuple[int, str]:
    """This card doesn't give any points."""
    return 0, "Cette carte est retournée et ne rapporte pas de points."


def rule_090(grid: Grid, position: int) -> tuple[int, str]:
    """This card doesn't give any points."""
    return 0, "Cette carte est retournée et ne rapporte pas de points."


def rule_091(grid: Grid, position: int) -> tuple[int, str]:
    """9 points if there is no blue shield on the board."""
    count = grid.count_shields_on_board("blue")
    if count == 0:
        return 9, "Tu n'as aucun bouclier bleu sur le plateau.\n9 points"
    return 0, f"Tu as {boucliers(count, 'bleu')} sur le plateau."


def rule_092(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each yellow shield on the same row and the same column."""
    row_count = grid.count_shields_in_row(position, "yellow")
    col_count = grid.count_shields_in_col(position, "yellow")
    self_count = grid.count_shields_on_card(position, "yellow")
    count = row_count + col_count - self_count  # Avoid counting card twice
    score = count * 2
    if count == 0:
        explanation = "Tu n'as aucun bouclier jaune. Ni sur cette rangée, ni sur cette colonne."
    else:
        row_text = f"Tu as {boucliers(row_count, 'jaune')} sur cette rangée" if row_count > 0 else "Tu n'as aucun bouclier jaune sur cette rangée"
        col_text = f"Tu as {boucliers(col_count, 'jaune')} sur cette colonne" if col_count > 0 else "Tu n'as aucun bouclier jaune sur cette colonne"
        explanation = f"""- {row_text}
- {col_text}
{count} x 2 = {score} points"""
    return score, explanation


# Mapping from card ID to rule function
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
