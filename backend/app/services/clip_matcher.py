import pickle
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from app.config import settings
from app.services.card_database import card_database


class CLIPMatcher:
    """CLIP-based card matching service."""

    def __init__(self):
        self.model = None
        self.preprocess = None
        self.device = None
        self.embeddings: dict[str, np.ndarray] = {}
        self._initialized = False

    def initialize(self) -> None:
        """Initialize CLIP model and load/compute embeddings."""
        if self._initialized:
            return

        import clip

        # Select device (MPS for Mac M-series, CUDA for GPU, or CPU)
        if torch.backends.mps.is_available():
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")

        # Load CLIP model
        self.model, self.preprocess = clip.load(settings.clip_model, device=self.device)
        self.model.eval()

        # Load or compute embeddings
        self._load_or_compute_embeddings()
        self._initialized = True

    def _get_embeddings_path(self) -> Path:
        """Get path for cached embeddings."""
        return settings.embeddings_dir / f"card_embeddings_{settings.clip_model.replace('/', '_')}.pkl"

    def _load_or_compute_embeddings(self) -> None:
        """Load embeddings from cache or compute them."""
        embeddings_path = self._get_embeddings_path()

        if embeddings_path.exists():
            with open(embeddings_path, "rb") as f:
                self.embeddings = pickle.load(f)
            # Verify all cards are present
            card_ids = set(card_database.get_card_ids())
            cached_ids = set(self.embeddings.keys())
            if card_ids == cached_ids:
                return

        # Compute embeddings for all cards
        self._compute_all_embeddings()

        # Save to cache
        embeddings_path.parent.mkdir(parents=True, exist_ok=True)
        with open(embeddings_path, "wb") as f:
            pickle.dump(self.embeddings, f)

    def _compute_all_embeddings(self) -> None:
        """Compute CLIP embeddings for all reference cards."""
        cards = card_database.get_all_cards()
        for card in cards:
            image = card.load_image()
            embedding = self._compute_embedding(image)
            self.embeddings[card.id] = embedding

    def _compute_embedding(self, image: Image.Image) -> np.ndarray:
        """Compute CLIP embedding for a single image."""
        with torch.no_grad():
            image_input = self.preprocess(image).unsqueeze(0).to(self.device)
            embedding = self.model.encode_image(image_input)
            embedding = embedding / embedding.norm(dim=-1, keepdim=True)
            return embedding.cpu().numpy().flatten()

    def find_matches(
        self, image: Image.Image, top_k: int = None
    ) -> list[tuple[str, float]]:
        """Find matching cards for an input image.

        Returns list of (card_id, similarity_score) sorted by score descending.
        """
        self.initialize()
        top_k = top_k or settings.top_k_matches

        # Compute embedding for input image
        query_embedding = self._compute_embedding(image)

        # Compute similarities with all reference cards
        similarities = []
        for card_id, ref_embedding in self.embeddings.items():
            similarity = np.dot(query_embedding, ref_embedding)
            similarities.append((card_id, float(similarity)))

        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x[1], reverse=True)

        # Return top-k
        return similarities[:top_k]

    def get_confidence(self, matches: list[tuple[str, float]]) -> float:
        """Get confidence score based on matches.

        Confidence is based on the gap between top match and second match.
        """
        if len(matches) < 2:
            return matches[0][1] if matches else 0.0

        top_score = matches[0][1]
        second_score = matches[1][1]

        # Confidence is higher when there's a clear winner
        # Normalize similarity scores (CLIP gives -1 to 1, usually 0.1 to 0.5 for images)
        # Convert to probability-like score
        confidence = (top_score + 1) / 2  # Scale from [-1,1] to [0,1]

        # Boost confidence if there's a large gap
        gap = top_score - second_score
        if gap > 0.1:
            confidence = min(1.0, confidence + gap)

        return confidence


# Singleton instance
clip_matcher = CLIPMatcher()
