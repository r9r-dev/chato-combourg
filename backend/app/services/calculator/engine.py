"""Main calculator engine for score calculation."""

from .grid import Grid
from .models import CalculateRequest, CalculateResponse, CardScoreDetail
from .rules import KEYS_RULES, RULES


def calculate_score(request: CalculateRequest) -> CalculateResponse:
    """
    Calculate the total score for a 3x3 card grid.

    Args:
        request: CalculateRequest with cards, keys, and coins_on_cards

    Returns:
        CalculateResponse with total score and detailed breakdown
    """
    grid = Grid(request.cards, request.coins_on_cards)
    details: list[CardScoreDetail] = []
    cards_score = 0

    for position, card_id in enumerate(request.cards):
        rule_func = RULES.get(card_id)

        if rule_func is None:
            # Unknown card, no points
            score = 0
            explanation = f"Carte {card_id} inconnue"
        elif card_id in KEYS_RULES:
            # Rules that need keys parameter
            score, explanation = rule_func(grid, position, request.keys)
        else:
            # Standard rules
            score, explanation = rule_func(grid, position)

        details.append(
            CardScoreDetail(
                position=position,
                card_id=card_id,
                score=score,
                explanation=explanation,
                coins=grid.get_coins_on_card(card_id),
            )
        )
        cards_score += score

    # Keys bonus: 1 point per remaining key
    keys_bonus = request.keys

    total_score = cards_score + keys_bonus

    return CalculateResponse(
        total_score=total_score,
        keys_bonus=keys_bonus,
        cards_score=cards_score,
        details=details,
    )
