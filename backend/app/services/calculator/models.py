from pydantic import BaseModel, Field


class CalculateRequest(BaseModel):
    """Request model for score calculation."""

    cards: list[str] = Field(
        ...,
        min_length=9,
        max_length=9,
        description="Array of 9 card IDs in grid order (0=top-left, 8=bottom-right)",
    )
    keys: int = Field(default=0, ge=0, description="Number of keys the player has")
    coins_on_cards: dict[str, int] = Field(
        default_factory=dict,
        description="Coins placed on cards: {card_id: count}",
    )


class CardScoreDetail(BaseModel):
    """Score details for a single card."""

    position: int = Field(..., ge=0, le=8, description="Grid position (0-8)")
    card_id: str = Field(..., description="Card ID")
    score: int = Field(..., description="Points scored by this card")
    explanation: str = Field(..., description="Explanation in French")


class CalculateResponse(BaseModel):
    """Response model for score calculation."""

    total_score: int = Field(..., description="Total score")
    keys_bonus: int = Field(..., description="Bonus points from remaining keys")
    cards_score: int = Field(..., description="Total points from cards")
    details: list[CardScoreDetail] = Field(..., description="Score breakdown per card")
