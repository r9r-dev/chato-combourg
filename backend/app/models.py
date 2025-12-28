from pydantic import BaseModel, Field


class CardMatch(BaseModel):
    id: str = Field(..., description="Card ID (e.g., '001')")
    probability: float = Field(..., ge=0, le=1, description="Match probability")


class CardResult(BaseModel):
    position: tuple[int, int] = Field(..., description="Grid position (row, col)")
    matches: list[CardMatch] = Field(..., description="Possible matches sorted by probability")
    method: str = Field(..., description="Identification method: 'clip' or 'claude'")


class AnalyzeResponse(BaseModel):
    success: bool
    message: str | None = None
    cards: list[CardResult] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: str | None = None
