"""Calculator router for score calculation endpoint."""

from fastapi import APIRouter, HTTPException

from app.services.calculator import CalculateRequest, CalculateResponse, calculate_score
from app.services.calculator.grid import CARD_ATTRIBUTES

router = APIRouter(prefix="/api", tags=["calculator"])


def distribute_coins(cards: list[str], total_coins: int) -> dict[str, int]:
    """
    Distribute coins to cards with purses.

    Fills each purse up to max_coins before moving to the next.
    """
    coins_on_cards: dict[str, int] = {}
    remaining = total_coins

    for card_id in cards:
        if remaining <= 0:
            break
        attrs = CARD_ATTRIBUTES.get(card_id, {})
        if attrs.get("has_coin_purse", False):
            max_coins = attrs.get("max_coins", 0)
            coins_to_place = min(remaining, max_coins)
            if coins_to_place > 0:
                coins_on_cards[card_id] = coins_to_place
                remaining -= coins_to_place

    return coins_on_cards


@router.post("/calculate", response_model=CalculateResponse)
async def calculate(request: CalculateRequest) -> CalculateResponse:
    """
    Calculate the score for a 3x3 card grid.

    - **cards**: Array of 9 card IDs in grid order (0=top-left, 8=bottom-right)
    - **keys**: Number of keys the player has (each key = 1 bonus point)
    - **coins_on_cards**: Dict mapping card_id to coins placed on it
    - **total_coins**: Total coins to auto-distribute (overrides coins_on_cards)

    Returns total score with detailed breakdown per card.
    """
    # Validate all card IDs exist
    for card_id in request.cards:
        if card_id not in CARD_ATTRIBUTES:
            raise HTTPException(
                status_code=400,
                detail=f"Carte inconnue: {card_id}",
            )

    # Auto-distribute coins if total_coins is provided
    if request.total_coins is not None:
        coins_on_cards = distribute_coins(request.cards, request.total_coins)
    else:
        coins_on_cards = request.coins_on_cards
        # Validate manually provided coins
        for card_id, coins in coins_on_cards.items():
            if card_id not in request.cards:
                raise HTTPException(
                    status_code=400,
                    detail=f"Pièces placées sur une carte absente du plateau: {card_id}",
                )
            if coins < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nombre de pièces invalide pour {card_id}: {coins}",
                )
            # Check max coins for the card
            max_coins = CARD_ATTRIBUTES[card_id].get("max_coins", 0)
            if coins > max_coins:
                raise HTTPException(
                    status_code=400,
                    detail=f"Trop de pièces sur {card_id}: {coins} (max {max_coins})",
                )

    # Create modified request with distributed coins
    modified_request = CalculateRequest(
        cards=request.cards,
        keys=request.keys,
        coins_on_cards=coins_on_cards,
    )

    return calculate_score(modified_request)
