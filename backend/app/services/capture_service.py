"""Service for managing captures and their categorization for training data.

Captures are organized into categories:
- pending/: Initial captures waiting for user action
- suspicious/: 0 detections (potential issues with image quality)
- failed/: Had detections but user didn't validate (took new capture)
- fixed/: Validated with corrections (good for training)
- success/: Validated without corrections (ground truth)
"""
import json
import shutil
from pathlib import Path
from enum import Enum

from app.config import settings


class CaptureStatus(str, Enum):
    SUSPICIOUS = "suspicious"  # 0 detections
    FAILED = "failed"  # Had detections but not validated
    FIXED = "fixed"  # Validated with corrections
    SUCCESS = "success"  # Validated without corrections


class CaptureService:
    """Service for managing capture categorization."""

    def __init__(self):
        self.captures_dir = settings.captures_dir

    def _get_pending_path(self, capture_id: str) -> Path:
        """Get path to a pending capture."""
        return self.captures_dir / "pending" / capture_id

    def _get_category_path(self, category: CaptureStatus) -> Path:
        """Get path to a category directory."""
        return self.captures_dir / category.value

    def finalize_capture(
        self,
        capture_id: str,
        status: CaptureStatus,
        detection_count: int,
        original_cards: list[dict] | None = None,
        final_cards: list[dict] | None = None,
    ) -> bool:
        """Move capture from pending to its final category.

        Args:
            capture_id: The capture ID (timestamp)
            status: The final status (failed, fixed, success)
            detection_count: Number of original detections
            original_cards: Original detected cards (for fixed/success)
            final_cards: Final cards after corrections (for fixed/success)

        Returns:
            True if successful, False otherwise
        """
        pending_path = self._get_pending_path(capture_id)

        if not pending_path.exists():
            return False

        # Determine actual status based on detection count for suspicious
        actual_status = status
        if status == CaptureStatus.FAILED and detection_count == 0:
            actual_status = CaptureStatus.SUSPICIOUS

        # Create target directory
        target_dir = self._get_category_path(actual_status)
        target_path = target_dir / capture_id
        target_dir.mkdir(parents=True, exist_ok=True)

        # Update report with final labels
        report_path = pending_path / "report.json"
        if report_path.exists():
            with open(report_path, encoding="utf-8") as f:
                report = json.load(f)

            # Add finalization info
            report["status"] = actual_status.value
            report["detection_count"] = detection_count

            if original_cards is not None:
                report["original_labels"] = original_cards

            if final_cards is not None:
                report["final_labels"] = final_cards

                # Compute corrections
                if original_cards is not None:
                    corrections = []
                    original_map = {c["position"]: c["card_id"] for c in original_cards}
                    final_map = {c["position"]: c["card_id"] for c in final_cards}

                    for pos in range(9):
                        orig = original_map.get(pos)
                        final = final_map.get(pos)
                        if orig != final:
                            corrections.append({
                                "position": pos,
                                "from": orig,
                                "to": final,
                            })

                    report["corrections"] = corrections
                    report["correction_count"] = len(corrections)

            # Save updated report
            with open(report_path, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)

        # Move folder to target category
        shutil.move(str(pending_path), str(target_path))

        return True

    def delete_pending_capture(self, capture_id: str) -> bool:
        """Delete a pending capture.

        Args:
            capture_id: The capture ID (timestamp)

        Returns:
            True if deleted, False if not found
        """
        pending_path = self._get_pending_path(capture_id)

        if not pending_path.exists():
            return False

        shutil.rmtree(pending_path)
        return True

    def get_capture_info(self, capture_id: str) -> dict | None:
        """Get info about a capture (from pending or any category)."""
        # Check pending first
        pending_path = self._get_pending_path(capture_id)
        if pending_path.exists():
            report_path = pending_path / "report.json"
            if report_path.exists():
                with open(report_path, encoding="utf-8") as f:
                    return json.load(f)

        # Check all categories
        for status in CaptureStatus:
            category_path = self._get_category_path(status) / capture_id
            if category_path.exists():
                report_path = category_path / "report.json"
                if report_path.exists():
                    with open(report_path, encoding="utf-8") as f:
                        return json.load(f)

        return None

    def cleanup_old_pending(self, max_age_hours: int = 24) -> int:
        """Clean up old pending captures that were never finalized.

        Args:
            max_age_hours: Maximum age in hours before cleanup

        Returns:
            Number of captures cleaned up
        """
        import time
        from datetime import datetime

        pending_dir = self.captures_dir / "pending"
        if not pending_dir.exists():
            return 0

        count = 0
        now = time.time()
        max_age_seconds = max_age_hours * 3600

        for folder in pending_dir.iterdir():
            if not folder.is_dir():
                continue

            # Parse timestamp from folder name (format: YYYYMMDD_HHMMSS_ffffff)
            try:
                timestamp_str = folder.name[:15]  # YYYYMMDD_HHMMSS
                capture_time = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                age = now - capture_time.timestamp()

                if age > max_age_seconds:
                    shutil.rmtree(folder)
                    count += 1
            except (ValueError, OSError):
                continue

        return count


# Singleton instance
capture_service = CaptureService()
