"""Tests for the game engine."""

import pytest
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestCardDatabase:
    """Tests for CardDatabase."""

    def test_load_cards(self):
        """Test that cards load correctly."""
        from chato_rl.game import CardDatabase

        db = CardDatabase()
        assert db.num_cards == 92
        assert len(db.all_card_ids()) == 92

    def test_get_card(self):
        """Test getting a specific card."""
        from chato_rl.game import CardDatabase

        db = CardDatabase()
        card = db.get("001")

        assert card.id == "001"
        assert card.value >= 0

    def test_castle_village_cards(self):
        """Test getting castle and village cards."""
        from chato_rl.game import CardDatabase

        db = CardDatabase()
        castle = db.get_castle_cards()
        village = db.get_village_cards()

        assert len(castle) > 0
        assert len(village) > 0
        # Total should be less than 92 (some cards are neutral)


class TestGameEngine:
    """Tests for GameEngine."""

    def test_create_game(self):
        """Test game creation."""
        from chato_rl.game import GameEngine

        engine = GameEngine(seed=42)
        state = engine.create_game([
            {"name": "Player 1", "color": "#FF0000"},
            {"name": "Player 2", "color": "#00FF00"},
        ])

        assert state.phase == "playing"
        assert len(state.players) == 2
        assert state.players[0].gold == 15
        assert state.players[0].keys == 2
        assert len(state.board.castle_cards) == 3
        assert len(state.board.village_cards) == 3

    def test_valid_actions(self):
        """Test getting valid actions."""
        from chato_rl.game import GameEngine

        engine = GameEngine(seed=42)
        state = engine.create_game([
            {"name": "Player 1", "color": "#FF0000"},
            {"name": "Player 2", "color": "#00FF00"},
        ])

        actions = engine.get_valid_actions(state)
        assert len(actions) > 0


class TestPlacements:
    """Tests for placement helpers."""

    def test_valid_placements_empty_board(self):
        """Test placements on empty board."""
        from chato_rl.game.engine import get_valid_placements

        board = [None] * 9
        valid = get_valid_placements(board)

        assert len(valid) == 9  # All positions valid on empty board

    def test_valid_placements_one_card(self):
        """Test placements with one card."""
        from chato_rl.game.engine import get_valid_placements
        from chato_rl.game import PlacedCard

        board = [None] * 9
        board[4] = PlacedCard(card_id="001", position=4)  # Center

        valid = get_valid_placements(board)

        # Adjacent to center: 1, 3, 5, 7
        assert set(valid) == {1, 3, 5, 7}


class TestShiftBoard:
    """Tests for board shifting."""

    def test_can_shift_empty(self):
        """Test shift on empty board."""
        from chato_rl.game.engine import can_shift_board

        board = [None] * 9
        assert not can_shift_board(board, "left")
        assert not can_shift_board(board, "right")

    def test_can_shift_left(self):
        """Test shift left possibility."""
        from chato_rl.game.engine import can_shift_board
        from chato_rl.game import PlacedCard

        board = [None] * 9
        board[4] = PlacedCard(card_id="001", position=4)  # Center

        # Can shift left (column 0 empty)
        assert can_shift_board(board, "left")

        # Can't shift right (column 2 not fully empty after shift)
        board[5] = PlacedCard(card_id="002", position=5)
        assert not can_shift_board(board, "right")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
