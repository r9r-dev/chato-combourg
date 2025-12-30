from pydantic import BaseModel, Field


class CardMatch(BaseModel):
    id: str = Field(..., description="Card ID (e.g., '001')")
    probability: float = Field(..., ge=0, le=1, description="Match probability")


class BoundingBox(BaseModel):
    """Bounding box in percentage coordinates (0-100) relative to image size."""
    x: float = Field(..., description="Left edge as percentage of image width")
    y: float = Field(..., description="Top edge as percentage of image height")
    width: float = Field(..., description="Width as percentage of image width")
    height: float = Field(..., description="Height as percentage of image height")


class CardResult(BaseModel):
    position: tuple[int, int] = Field(..., description="Grid position (row, col)")
    matches: list[CardMatch] = Field(..., description="Possible matches sorted by probability")
    method: str = Field(..., description="Identification method used (e.g., 'yolo11')")
    bbox: BoundingBox | None = Field(None, description="Bounding box of detected card")


class AnalyzeResponse(BaseModel):
    success: bool
    message: str | None = None
    cards: list[CardResult] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: str | None = None
