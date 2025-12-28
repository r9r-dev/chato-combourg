"""Scoring rules for each card (001-092)."""

from .grid import Grid


def pluriel(n: int, singular: str, plural: str = None) -> str:
    """Return singular or plural form based on count."""
    if plural is None:
        plural = singular + "s"
    return singular if n <= 1 else plural


def boucliers(n: int, color: str) -> str:
    """Format shield count with color (handles plural)."""
    return f"{n} {pluriel(n, 'bouclier')} {color}"


def rule_001(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each blue shield on the same column."""
    count = grid.count_shields_in_col(position, "blue")
    score = count * 4
    return score, f"{score} points ({count} bouclier(s) bleu(s) sur la colonne x 4)"


def rule_002(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if at least one green shield on the same column."""
    if grid.has_color_in_col(position, "green"):
        return 5, "5 points (au moins un bouclier vert sur la colonne)"
    return 0, "0 point (aucun bouclier vert sur la colonne)"


def rule_003(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if this card is on the top row."""
    if grid.is_top_row(position):
        return 8, "8 points (carte sur la rangée du haut)"
    return 0, "0 point (carte pas sur la rangée du haut)"


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
    return score, f"{score} points ({count} couleur(s) différente(s) sur la rangée x 4)"


def rule_006(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card from village."""
    count = grid.count_village_cards()
    score = count * 2
    return score, f"{score} points ({count} carte(s) village x 2)"


def rule_007(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the bottom row."""
    if grid.is_bottom_row(position):
        return 5, "5 points (carte sur la rangée du bas)"
    return 0, "0 point (carte pas sur la rangée du bas)"


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
    return score, f"{score} points ({count} bouclier(s) bleu(s) sur la colonne x 3)"


def rule_010(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each card with different price on the board."""
    unique_values = grid.get_unique_values_on_board()
    count = len(unique_values)
    score = count * 3
    return score, f"{score} points ({count} coût(s) différent(s) x 3)"


def rule_011(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each green shield on the same row."""
    count = grid.count_shields_in_row(position, "green")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) vert(s) sur la rangée x 3)"


def rule_012(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each different shield color on the same row."""
    colors = grid.get_unique_colors_in_row(position)
    count = len(colors)
    score = count * 2
    return score, f"{score} points ({count} couleur(s) différente(s) sur la rangée x 2)"


def rule_013(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each blue shield on the same row."""
    count = grid.count_shields_in_row(position, "blue")
    score = count * 4
    return score, f"{score} points ({count} bouclier(s) bleu(s) sur la rangée x 4)"


def rule_014(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 3 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 3)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 3)"


def rule_015(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card with exactly one shield."""
    count = grid.count_cards_with_shield_count(1)
    score = count * 2
    return score, f"{score} points ({count} carte(s) avec exactement 1 bouclier x 2)"


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
    return score, f"{score} point(s) ({keys} clé(s))"


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
    count = grid.count_shields_in_row_and_col(position, "blue")
    score = count * 2
    return score, f"{score} points ({count} bouclier(s) bleu(s) sur rangée et colonne x 2)"


def rule_020(grid: Grid, position: int) -> tuple[int, str]:
    """1 point for each provided coin on cards."""
    total = grid.get_total_coins_on_cards()
    score = total
    return score, f"{score} point(s) ({total} pièce(s) placée(s) sur les cartes)"


def rule_021(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if the card is on the left column."""
    if grid.is_left_col(position):
        return 8, "8 points (carte sur la colonne de gauche)"
    return 0, "0 point (carte pas sur la colonne de gauche)"


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
    count = grid.count_shields_in_row_and_col(position, "blue")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) bleu(s) sur rangée et colonne x 3)"


def rule_024(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each different shield color on the board."""
    colors = grid.get_unique_colors_on_board()
    count = len(colors)
    score = count * 2
    return score, f"{score} points ({count} couleur(s) différente(s) sur le plateau x 2)"


def rule_025(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 5 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 5)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 5)"


def rule_026(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if the board has no yellow shield."""
    if not grid.has_color_on_board("yellow"):
        return 10, "10 points (aucun bouclier jaune sur le plateau)"
    return 0, "0 point (il y a des boucliers jaunes)"


def rule_027(grid: Grid, position: int) -> tuple[int, str]:
    """6 points for each time 3 shields of the same color can be counted on the board."""
    total_sets = 0
    for color in Grid.COLORS:
        count = grid.count_shields_on_board(color)
        total_sets += count // 3
    score = total_sets * 6
    return score, f"{score} points ({total_sets} lot(s) de 3 boucliers x 6)"


def rule_028(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each blue shield on the same row."""
    count = grid.count_shields_in_row(position, "blue")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) bleu(s) sur la rangée x 3)"


def rule_029(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each different shield color on the same column."""
    colors = grid.get_unique_colors_in_col(position)
    count = len(colors)
    score = count * 4
    return score, f"{score} points ({count} couleur(s) différente(s) sur la colonne x 4)"


def rule_030(grid: Grid, position: int) -> tuple[int, str]:
    """6 points if the card is on the left column."""
    if grid.is_left_col(position):
        return 6, "6 points (carte sur la colonne de gauche)"
    return 0, "0 point (carte pas sur la colonne de gauche)"


def rule_031(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if the card is on the right column."""
    if grid.is_right_col(position):
        return 8, "8 points (carte sur la colonne de droite)"
    return 0, "0 point (carte pas sur la colonne de droite)"


def rule_032(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each card with a price reduction on the board."""
    count = grid.count_cards_with_price_reduction()
    score = count * 4
    return score, f"{score} points ({count} carte(s) avec réduction de prix x 4)"


def rule_033(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each green shield on the same column."""
    count = grid.count_shields_in_col(position, "green")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) vert(s) sur la colonne x 3)"


def rule_034(grid: Grid, position: int) -> tuple[int, str]:
    """Sum of all card costs on the same row."""
    total = grid.sum_values_in_row(position)
    return total, f"{total} points (somme des coûts sur la rangée)"


def rule_035(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if at least one shield is pink on the same row."""
    if grid.has_color_in_row(position, "pink"):
        return 5, "5 points (au moins un bouclier violet sur la rangée)"
    return 0, "0 point (aucun bouclier violet sur la rangée)"


def rule_036(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 8 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 8)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 8)"


def rule_037(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each pink shield on the same column."""
    count = grid.count_shields_in_col(position, "pink")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) violet(s) sur la colonne x 3)"


def rule_038(grid: Grid, position: int) -> tuple[int, str]:
    """6 points for each different shield NOT on the board."""
    present_colors = grid.get_unique_colors_on_board()
    missing = len(Grid.COLORS) - len(present_colors)
    score = missing * 6
    return score, f"{score} points ({missing} couleur(s) absente(s) x 6)"


def rule_039(grid: Grid, position: int) -> tuple[int, str]:
    """5 points for each card with 5 price or more."""
    count = grid.count_cards_with_value_or_more(5)
    score = count * 5
    return score, f"{score} points ({count} carte(s) avec coût >= 5 x 5)"


def rule_040(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each card with a price of exactly 4."""
    count = grid.count_cards_with_exact_value(4)
    score = count * 3
    return score, f"{score} points ({count} carte(s) avec coût = 4 x 3)"


def rule_041(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 4 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 4)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 4)"


def rule_042(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each green shield on the same row and same column."""
    count = grid.count_shields_in_row_and_col(position, "green")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) vert(s) sur rangée et colonne x 3)"


def rule_043(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each red shield on the same row."""
    count = grid.count_shields_in_row(position, "red")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) rouge(s) sur la rangée x 3)"


def rule_044(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if the board has no orange shield."""
    if not grid.has_color_on_board("orange"):
        return 10, "10 points (aucun bouclier orange sur le plateau)"
    return 0, "0 point (il y a des boucliers oranges)"


def rule_045(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each red shield on the same column."""
    count = grid.count_shields_in_col(position, "red")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) rouge(s) sur la colonne x 3)"


def rule_046(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card from castle on the board."""
    count = grid.count_castle_cards()
    score = count * 2
    return score, f"{score} points ({count} carte(s) château x 2)"


def rule_047(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the top row."""
    if grid.is_top_row(position):
        return 5, "5 points (carte sur la rangée du haut)"
    return 0, "0 point (carte pas sur la rangée du haut)"


def rule_048(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each pink shield on the same row."""
    count = grid.count_shields_in_row(position, "pink")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) violet(s) sur la rangée x 3)"


def rule_049(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the right column."""
    if grid.is_right_col(position):
        return 5, "5 points (carte sur la colonne de droite)"
    return 0, "0 point (carte pas sur la colonne de droite)"


def rule_050(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 4 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 4)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 4)"


def rule_051(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 5 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 5)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 5)"


def rule_052(grid: Grid, position: int) -> tuple[int, str]:
    """6 points if this card is on the middle column."""
    if grid.is_middle_col(position):
        return 6, "6 points (carte sur la colonne du milieu)"
    return 0, "0 point (carte pas sur la colonne du milieu)"


def rule_053(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 9 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 9)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 9)"


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
    return score, f"{score} points ({count} bouclier(s) jaune(s) sur la colonne x 3)"


def rule_056(grid: Grid, position: int) -> tuple[int, str]:
    """12 points if the board doesn't contain cards 089 or 090."""
    has_089 = grid.has_card_on_board("089")
    has_090 = grid.has_card_on_board("090")
    if not has_089 and not has_090:
        return 12, "12 points (pas de carte 089 ni 090 sur le plateau)"
    return 0, "0 point (carte 089 ou 090 présente)"


def rule_057(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card with exactly two shields."""
    count = grid.count_cards_with_shield_count(2)
    score = count * 2
    return score, f"{score} points ({count} carte(s) avec exactement 2 boucliers x 2)"


def rule_058(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 6 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 6)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 6)"


def rule_059(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 4 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 4)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 4)"


def rule_060(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each orange shield on the same row."""
    count = grid.count_shields_in_row(position, "orange")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) orange(s) sur la rangée x 3)"


def rule_061(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 7 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 7)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 7)"


def rule_062(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each pink shield on the same row and the same column."""
    count = grid.count_shields_in_row_and_col(position, "pink")
    score = count * 2
    return score, f"{score} points ({count} bouclier(s) violet(s) sur rangée et colonne x 2)"


def rule_063(grid: Grid, position: int) -> tuple[int, str]:
    """7 points if this card is on the bottom row."""
    if grid.is_bottom_row(position):
        return 7, "7 points (carte sur la rangée du bas)"
    return 0, "0 point (carte pas sur la rangée du bas)"


def rule_064(grid: Grid, position: int) -> tuple[int, str]:
    """9 points if there is no pink shield on the board."""
    if not grid.has_color_on_board("pink"):
        return 9, "9 points (aucun bouclier violet sur le plateau)"
    return 0, "0 point (il y a des boucliers violets)"


def rule_065(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each red shield on the same row and the same column."""
    count = grid.count_shields_in_row_and_col(position, "red")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) rouge(s) sur rangée et colonne x 3)"


def rule_066(grid: Grid, position: int, keys: int) -> tuple[int, str]:
    """1 point for each key the player owns."""
    score = keys
    return score, f"{score} point(s) ({keys} clé(s))"


def rule_067(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each yellow shield on the same row."""
    count = grid.count_shields_in_row(position, "yellow")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) jaune(s) sur la rangée x 3)"


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
    return score, f"{score} points ({village_count} village(s), {sets} lot(s) de 3 x 7)"


def rule_070(grid: Grid, position: int) -> tuple[int, str]:
    """4 points for each card with a lock."""
    count = grid.count_cards_with_lock()
    score = count * 4
    return score, f"{score} points ({count} carte(s) avec cadenas x 4)"


def rule_071(grid: Grid, position: int) -> tuple[int, str]:
    """5 points if this card is on the middle row."""
    if grid.is_middle_row(position):
        return 5, "5 points (carte sur la rangée du milieu)"
    return 0, "0 point (carte pas sur la rangée du milieu)"


def rule_072(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if there is no green shield on the board."""
    if not grid.has_color_on_board("green"):
        return 10, "10 points (aucun bouclier vert sur le plateau)"
    return 0, "0 point (il y a des boucliers verts)"


def rule_073(grid: Grid, position: int) -> tuple[int, str]:
    """3 points for each orange shield on the same row."""
    count = grid.count_shields_in_row(position, "orange")
    score = count * 3
    return score, f"{score} points ({count} bouclier(s) orange(s) sur la rangée x 3)"


def rule_074(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card from castle."""
    count = grid.count_castle_cards()
    score = count * 2
    return score, f"{score} points ({count} carte(s) château x 2)"


def rule_075(grid: Grid, position: int) -> tuple[int, str]:
    """7 points if there is at least one red shield on the same row."""
    if grid.has_color_in_row(position, "red"):
        return 7, "7 points (au moins un bouclier rouge sur la rangée)"
    return 0, "0 point (aucun bouclier rouge sur la rangée)"


def rule_076(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each different shield color on the same column."""
    colors = grid.get_unique_colors_in_col(position)
    count = len(colors)
    score = count * 2
    return score, f"{score} points ({count} couleur(s) différente(s) sur la colonne x 2)"


def rule_077(grid: Grid, position: int) -> tuple[int, str]:
    """Sum of all card costs on the same column."""
    total = grid.sum_values_in_col(position)
    return total, f"{total} points (somme des coûts sur la colonne)"


def rule_078(grid: Grid, position: int) -> tuple[int, str]:
    """1 point for each card from village."""
    count = grid.count_village_cards()
    score = count
    return score, f"{score} point(s) ({count} carte(s) village)"


def rule_079(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if there is no card with coin purse."""
    if grid.count_cards_with_coin_purse() == 0:
        return 10, "10 points (aucune carte avec bourse)"
    return 0, "0 point (il y a des cartes avec bourse)"


def rule_080(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each orange shield on the same row and the same column."""
    count = grid.count_shields_in_row_and_col(position, "orange")
    score = count * 2
    return score, f"{score} points ({count} bouclier(s) orange(s) sur rangée et colonne x 2)"


def rule_081(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each coin on this card. Maximum 5 coins."""
    card_id = grid.get_card_at(position)
    coins = min(grid.get_coins_on_card(card_id), 5)
    score = coins * 2
    return score, f"{score} points ({coins} pièce(s) sur la carte x 2, max 5)"


def rule_082(grid: Grid, position: int) -> tuple[int, str]:
    """8 points if the board contains at least one 089 card or one 090 card."""
    has_089 = grid.has_card_on_board("089")
    has_090 = grid.has_card_on_board("090")
    if has_089 or has_090:
        return 8, "8 points (carte 089 ou 090 présente sur le plateau)"
    return 0, "0 point (pas de carte 089 ni 090)"


def rule_083(grid: Grid, position: int) -> tuple[int, str]:
    """10 points if there is no red shield on the board."""
    if not grid.has_color_on_board("red"):
        return 10, "10 points (aucun bouclier rouge sur le plateau)"
    return 0, "0 point (il y a des boucliers rouges)"


def rule_084(grid: Grid, position: int) -> tuple[int, str]:
    """1 point for each castle card."""
    count = grid.count_castle_cards()
    score = count
    return score, f"{score} point(s) ({count} carte(s) château)"


def rule_085(grid: Grid, position: int) -> tuple[int, str]:
    """3 points if the card is placed on borders (not corners or center)."""
    if grid.is_border(position):
        return 3, "3 points (carte sur un bord)"
    return 0, "0 point (carte pas sur un bord)"


def rule_086(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each card with price of exactly 0."""
    count = grid.count_cards_with_exact_value(0)
    score = count * 2
    return score, f"{score} points ({count} carte(s) avec coût = 0 x 2)"


def rule_087(grid: Grid, position: int) -> tuple[int, str]:
    """4 points if the card is placed on corners (not borders or center)."""
    if grid.is_corner(position):
        return 4, "4 points (carte sur un coin)"
    return 0, "0 point (carte pas sur un coin)"


def rule_088(grid: Grid, position: int) -> tuple[int, str]:
    """3 points if there is at least one blue shield on the same column."""
    if grid.has_color_in_col(position, "blue"):
        return 3, "3 points (au moins un bouclier bleu sur la colonne)"
    return 0, "0 point (aucun bouclier bleu sur la colonne)"


def rule_089(grid: Grid, position: int) -> tuple[int, str]:
    """This card doesn't give any points."""
    return 0, "0 point (cette carte ne rapporte pas de points)"


def rule_090(grid: Grid, position: int) -> tuple[int, str]:
    """This card doesn't give any points."""
    return 0, "0 point (cette carte ne rapporte pas de points)"


def rule_091(grid: Grid, position: int) -> tuple[int, str]:
    """9 points if there is no blue shield on the board."""
    if not grid.has_color_on_board("blue"):
        return 9, "9 points (aucun bouclier bleu sur le plateau)"
    return 0, "0 point (il y a des boucliers bleus)"


def rule_092(grid: Grid, position: int) -> tuple[int, str]:
    """2 points for each yellow shield on the same row and the same column."""
    count = grid.count_shields_in_row_and_col(position, "yellow")
    score = count * 2
    return score, f"{score} points ({count} bouclier(s) jaune(s) sur rangée et colonne x 2)"


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
