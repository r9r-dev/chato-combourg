"""Calculator router for score calculation endpoint."""

from fastapi import APIRouter, HTTPException

from app.services.calculator import CalculateRequest, CalculateResponse, calculate_score
from app.services.calculator.grid import CARD_ATTRIBUTES

router = APIRouter(prefix="/api", tags=["calculator"])


@router.post("/calculate", response_model=CalculateResponse)
async def calculate(request: CalculateRequest) -> CalculateResponse:
    """
    Calculate the score for a 3x3 card grid.

    - **cards**: Array of 9 card IDs in grid order (0=top-left, 8=bottom-right)
    - **keys**: Number of keys the player has (each key = 1 bonus point)
    - **coins_on_cards**: Dict mapping card_id to coins placed on it

    Returns total score with detailed breakdown per card.
    """
    # Validate all card IDs exist
    for card_id in request.cards:
        if card_id not in CARD_ATTRIBUTES:
            raise HTTPException(
                status_code=400,
                detail=f"Carte inconnue: {card_id}",
            )

    # Validate coins are placed on valid cards that are on the board
    for card_id, coins in request.coins_on_cards.items():
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

    return calculate_score(request)
