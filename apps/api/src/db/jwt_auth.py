"""
Cryptographic JWT Authentication Engine for Backtest AI.
Issues and validates HMAC-SHA256 signed JSON Web Tokens for institutional sessions.
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, Optional
import jwt
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

logger = logging.getLogger("backtest_ai.auth.jwt")


def _load_secret() -> str:
    """
    Reads the signing secret from JWT_SECRET (name used in .env.example) or JWT_SECRET_KEY.
    There is no built-in default: without a configured secret, a random one is generated for
    this process only, so tokens stop working after a restart but can never be forged.
    """
    secret = (os.getenv("JWT_SECRET") or os.getenv("JWT_SECRET_KEY") or "").strip()
    if secret:
        return secret
    logger.error("JWT_SECRET is not set. Using a random per-process secret; set JWT_SECRET in .env.")
    return secrets.token_urlsafe(48)


JWT_SECRET_KEY = _load_secret()
JWT_ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Generate a signed JWT token containing user identity and authorization claims.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": "backtest-ai-quant-engine"
    })

    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a cryptographic JWT access token.
    Returns decoded payload claims or None if invalid/expired.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            issuer="backtest-ai-quant-engine"
        )
        return payload
    except jwt.PyJWTError:
        return None
