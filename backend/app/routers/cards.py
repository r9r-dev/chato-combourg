"""Cards data router for serving card attributes and effects."""

from fastapi import APIRouter

from app.services.card_data import get_all_attributes, get_all_effects

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("/attributes")
async def get_card_attributes_endpoint() -> dict:
    """
    Get all card attributes.

    Returns a dictionary mapping card IDs to their attributes:
    - value: Card cost (0-8)
    - shields: Array of {count, color}
    - category: "village" | "castle" | null
    - has_messenger: Boolean
    - has_price_reduction: Boolean
    - has_lock: Boolean
    - has_coin_purse: Boolean
    - max_coins: Number
    """
    return get_all_attributes()


@router.get("/effects")
async def get_card_effects_endpoint() -> dict:
    """
    Get all card effects for the Play mode.

    Returns a dictionary mapping card IDs to their effects:
    - has_messenger: Boolean
    - effects: Array of effect objects
    - lock_effect: Effect triggered when using a key on the card's lock
    """
    return get_all_effects()
