"""
Cryptographic JWT Authentication Engine for Backtest AI.
Issues and validates HMAC-SHA256 signed JSON Web Tokens for institutional sessions.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import jwt

# Institutional Secret Key (configurable via environment in production)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "backtest_ai_institutional_quant_enclave_key_2026")
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
