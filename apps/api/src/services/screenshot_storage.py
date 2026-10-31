"""
Screenshot Storage Service.
Decodes WebP base64 snapshots from Backtest Studio, saves them as native .webp files
under data/uploads/screenshots/{session_id}/{trade_id}.webp, and manages cascade disk cleanup.
"""

from __future__ import annotations
import base64
import logging
import os
import re
import shutil
from pathlib import Path
from typing import Optional

logger = logging.getLogger("screenshot_storage")
BASE_UPLOAD_DIR = Path("data/uploads/screenshots")


def sanitize_filename_part(part: str) -> str:
    """Sanitize strings for Windows/POSIX safe directory and file names."""
    if not part:
        return "unnamed"
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", part.strip())


def save_screenshot_file(
    session_id: str,
    trade_id: str,
    base64_data: str,
) -> Optional[str]:
    """
    Decodes a base64 WebP image and writes it directly to disk under:
    data/uploads/screenshots/{clean_session_id}/{clean_trade_id}.webp.
    Returns the relative web path: /uploads/screenshots/{clean_session_id}/{clean_trade_id}.webp
    """
    if not base64_data:
        return None

    try:
        # Strip data URL prefix if present
        raw = base64_data
        if "," in raw:
            raw = raw.split(",", 1)[1]

        image_bytes = base64.b64decode(raw)
        if not image_bytes:
            logger.warning("[ScreenshotStorage] Base64 decoded to 0 bytes for trade %s", trade_id)
            return None

        clean_session_id = sanitize_filename_part(session_id)
        clean_trade_id = sanitize_filename_part(trade_id)

        session_dir = BASE_UPLOAD_DIR / clean_session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        file_path = session_dir / f"{clean_trade_id}.webp"
        file_path.write_bytes(image_bytes)

        logger.info(
            "[ScreenshotStorage] Persisted screenshot: %s (%d bytes)",
            file_path,
            len(image_bytes),
        )

        # Standard web URL path stored in PostgreSQL
        return f"/uploads/screenshots/{clean_session_id}/{clean_trade_id}.webp"
    except Exception as exc:
        logger.error("[ScreenshotStorage] Failed to save screenshot for trade %s: %s", trade_id, exc, exc_info=True)
        return None


def delete_session_screenshots(session_id: str) -> bool:
    """
    Recursively deletes all saved screenshot files for a given session.
    """
    try:
        clean_session_id = sanitize_filename_part(session_id)
        session_dir = BASE_UPLOAD_DIR / clean_session_id
        if session_dir.exists() and session_dir.is_dir():
            shutil.rmtree(session_dir)
            logger.info("[ScreenshotStorage] Deleted screenshots for session: %s", clean_session_id)
            return True
        return False
    except Exception as exc:
        logger.error("[ScreenshotStorage] Error deleting screenshots for session %s: %s", session_id, exc)
        return False

