"""Transformer architecture for encoding cards and board state.

Uses attention mechanism to capture:
- Card-card relationships on the board
- Synergies between available and placed cards
- Positional information (3x3 grid)
"""

from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class PositionalEncoding(nn.Module):
    """Learnable positional encoding for the 3x3 grid."""

    def __init__(self, d_model: int, max_positions: int = 9):
        super().__init__()
        self.pos_embedding = nn.Embedding(max_positions, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Add positional encoding.

        Args:
            x: Input tensor of shape (batch, seq_len, d_model)

        Returns:
            Tensor with positional encoding added
        """
        batch_size, seq_len, _ = x.shape
        positions = torch.arange(seq_len, device=x.device)
        pos_enc = self.pos_embedding(positions)
        return x + pos_enc.unsqueeze(0)


class MultiHeadAttention(nn.Module):
    """Multi-head self-attention."""

    def __init__(
        self,
        d_model: int,
        num_heads: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()
        assert d_model % num_heads == 0

        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads

        self.w_q = nn.Linear(d_model, d_model)
        self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model)
        self.w_o = nn.Linear(d_model, d_model)

        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """Apply multi-head attention.

        Args:
            query: Query tensor (batch, seq_q, d_model)
            key: Key tensor (batch, seq_k, d_model)
            value: Value tensor (batch, seq_k, d_model)
            mask: Optional attention mask

        Returns:
            Attended output (batch, seq_q, d_model)
        """
        batch_size = query.size(0)

        # Linear projections
        q = self.w_q(query).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        k = self.w_k(key).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        v = self.w_v(value).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)

        # Scaled dot-product attention
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_k)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))

        attn = F.softmax(scores, dim=-1)
        attn = self.dropout(attn)

        # Apply attention to values
        context = torch.matmul(attn, v)

        # Concatenate heads
        context = context.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)

        return self.w_o(context)


class TransformerBlock(nn.Module):
    """Single transformer block with attention and feed-forward."""

    def __init__(
        self,
        d_model: int,
        num_heads: int = 4,
        d_ff: int = 256,
        dropout: float = 0.1,
    ):
        super().__init__()

        self.attention = MultiHeadAttention(d_model, num_heads, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)

        self.feed_forward = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
        """Apply transformer block.

        Args:
            x: Input tensor (batch, seq, d_model)
            mask: Optional attention mask

        Returns:
            Output tensor (batch, seq, d_model)
        """
        # Self-attention with residual
        attn_out = self.attention(x, x, x, mask)
        x = self.norm1(x + attn_out)

        # Feed-forward with residual
        ff_out = self.feed_forward(x)
        x = self.norm2(x + ff_out)

        return x


class TransformerEncoder(nn.Module):
    """Transformer encoder for sequence encoding."""

    def __init__(
        self,
        d_model: int = 64,
        num_heads: int = 4,
        num_layers: int = 2,
        d_ff: int = 256,
        dropout: float = 0.1,
        max_seq_len: int = 15,  # 9 board + 6 available
    ):
        super().__init__()

        self.d_model = d_model
        self.pos_encoding = PositionalEncoding(d_model, max_seq_len)

        self.layers = nn.ModuleList([
            TransformerBlock(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])

        self.norm = nn.LayerNorm(d_model)

    def forward(
        self,
        x: torch.Tensor,
        mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """Encode sequence with transformer.

        Args:
            x: Input sequence (batch, seq, d_model)
            mask: Optional attention mask

        Returns:
            Encoded sequence (batch, seq, d_model)
        """
        x = self.pos_encoding(x)

        for layer in self.layers:
            x = layer(x, mask)

        return self.norm(x)


class CardTransformer(nn.Module):
    """Transformer model for Chateau Combo.

    Processes:
    - Player's board (9 cards)
    - Opponent boards (up to 4 x 9 cards)
    - Available cards (6 cards)

    Outputs a fixed-size embedding for the policy network.
    """

    def __init__(
        self,
        board_feature_dim: int = 17,  # Player/opponent board features
        available_feature_dim: int = 16,  # Available cards features
        d_model: int = 64,
        num_heads: int = 4,
        num_layers: int = 2,
        d_ff: int = 256,
        dropout: float = 0.1,
        num_players: int = 2,
        output_dim: int = 128,
    ):
        super().__init__()

        self.d_model = d_model
        self.num_players = num_players
        self.board_feature_dim = board_feature_dim

        # Separate projections for board and available cards
        self.board_projection = nn.Linear(board_feature_dim, d_model)
        self.available_projection = nn.Linear(available_feature_dim, d_model)

        # Learnable tokens for special positions
        self.cls_token = nn.Parameter(torch.randn(1, 1, d_model))
        self.sep_token = nn.Parameter(torch.randn(1, 1, d_model))

        # Type embeddings (player board, opponent board, available)
        self.type_embedding = nn.Embedding(3, d_model)

        # Transformer encoder
        self.transformer = TransformerEncoder(
            d_model=d_model,
            num_heads=num_heads,
            num_layers=num_layers,
            d_ff=d_ff,
            dropout=dropout,
            max_seq_len=1 + 9 + (num_players - 1) * 9 + 6 + 3,  # CLS + boards + available + SEPs
        )

        # Output projection
        self.output_projection = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, output_dim),
        )

    def forward(
        self,
        player_board: torch.Tensor,
        opponent_boards: torch.Tensor,
        available_cards: torch.Tensor,
        resources: torch.Tensor,
        game_info: torch.Tensor,
    ) -> torch.Tensor:
        """Process game state and return embedding.

        Args:
            player_board: (batch, 9, board_features)
            opponent_boards: (batch, num_opponents, 9, board_features)
            available_cards: (batch, 6, available_features)
            resources: (batch, 4)
            game_info: (batch, 3)

        Returns:
            Game state embedding (batch, output_dim)
        """
        batch_size = player_board.size(0)

        # Project board features to d_model
        player_cards = self.board_projection(player_board)  # (batch, 9, d_model)

        # Reshape opponent boards
        num_opponents = opponent_boards.size(1)
        opponent_cards = self.board_projection(
            opponent_boards.view(batch_size, -1, opponent_boards.size(-1))
        )  # (batch, num_opp * 9, d_model)

        # Project available cards (different feature dim)
        available = self.available_projection(available_cards)  # (batch, 6, d_model)

        # Add type embeddings
        player_cards = player_cards + self.type_embedding(
            torch.zeros(9, dtype=torch.long, device=player_board.device)
        )
        opponent_cards = opponent_cards + self.type_embedding(
            torch.ones(num_opponents * 9, dtype=torch.long, device=player_board.device)
        )
        available = available + self.type_embedding(
            torch.full((6,), 2, dtype=torch.long, device=player_board.device)
        )

        # Build sequence: [CLS] player_board [SEP] opponent_boards [SEP] available
        cls_tokens = self.cls_token.expand(batch_size, -1, -1)
        sep_tokens = self.sep_token.expand(batch_size, -1, -1)

        sequence = torch.cat([
            cls_tokens,
            player_cards,
            sep_tokens,
            opponent_cards,
            sep_tokens,
            available,
        ], dim=1)

        # Apply transformer
        encoded = self.transformer(sequence)

        # Take CLS token output
        cls_output = encoded[:, 0]

        # Concatenate with resources and game info
        extra_features = torch.cat([resources, game_info], dim=1)

        # Project to output dimension
        # First, project extra features to same dimension
        # Project extra features (pad to match board_projection input)
        extra_padded = F.pad(extra_features, (0, self.board_feature_dim - extra_features.size(1)))
        combined = cls_output + self.board_projection(extra_padded)

        return self.output_projection(combined)


class CardEmbedding(nn.Module):
    """Learnable card embeddings as alternative to feature-based encoding."""

    def __init__(
        self,
        num_cards: int = 93,  # 0 = empty, 1-92 = cards
        embedding_dim: int = 64,
    ):
        super().__init__()
        self.embedding = nn.Embedding(num_cards, embedding_dim)

    def forward(self, card_ids: torch.Tensor) -> torch.Tensor:
        """Get embeddings for card IDs.

        Args:
            card_ids: Tensor of card IDs (0 = empty, 1-92 = cards)

        Returns:
            Card embeddings
        """
        return self.embedding(card_ids)
