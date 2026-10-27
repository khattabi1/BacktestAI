import logging
import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

import MetaTrader5 as mt5
import pandas as pd
from fastmcp import FastMCP
from pydantic import BaseModel, field_validator, model_validator

logger = logging.getLogger(__name__)

# Load .env (paths, credentials) so _get_mt5_paths picks up portable Portable Broker config.
# Search UP from this file's location so it works regardless of process cwd.
_ENV_CANDIDATES = [
    Path(__file__).resolve().parent.parent.parent / ".env",  # repo root
    Path(".env"),
    Path(cwd) / ".env" if (cwd := os.getcwd()) else Path(".env"),
]
load_dotenv(next((str(p) for p in _ENV_CANDIDATES if p.exists()), None))


def _find_project_root() -> Path:
    cur = Path(__file__).resolve()
    for parent in cur.parents:
        if (parent / "mt5_workers").exists():
            return parent
    for parent in cur.parents:
        if (parent / "packages").exists():
            return parent
    return cur.parents[4]


mcp = FastMCP(
    "MetaTrader 5 MCP Server",
    instructions="""
    This server controls the MetaTrader 5 terminal via its Python API.

    IMPORTANT - REQUIRED SETUP SEQUENCE:
    Before calling ANY other tool, you MUST call initialize() first to establish
    the connection to the MT5 terminal. Without this, all other tools will fail
    with a 'No IPC connection' error.

    Typical usage sequence:
    1. initialize(path="C:\\Program Files\\MetaTrader 5\\terminal64.exe")
       - Must be called first, every time the server starts
       - Use the actual path to the MT5 terminal executable on the user's machine
    2. login(login=..., password=..., server=...) [optional]
       - Only needed if the terminal is not already logged in
    3. Now you can call any other tools: get_account_info(), order_send(), etc.

    Common MT5 terminal paths:
    - "C:\\Program Files\\MetaTrader 5\\terminal64.exe"
    - "C:\\Program Files (x86)\\MetaTrader 5\\terminal64.exe"

    If initialize() fails or you are unsure of the path, ask the user:
    "Where is your MetaTrader 5 terminal installed? Please provide the full path
    to terminal64.exe (e.g. C:\\Program Files\\MetaTrader 5\\terminal64.exe)"

    All action and type fields require INTEGER constants, not strings.
    Volume is always in LOTS (e.g. 0.01, 0.1, 1.0).
    """,
)


# Models for request/response data
class SymbolInfo(BaseModel):
    """Information about a trading symbol"""

    name: str
    description: str | None = None
    path: str | None = None
    session_deals: int | None = None
    session_buy_orders: int | None = None
    session_sell_orders: int | None = None
    volume: float | None = None
    volumehigh: float | None = None
    volumelow: float | None = None
    time: int | None = None
    digits: int | None = None
    spread: int | None = None
    spread_float: bool | None = None
    trade_calc_mode: int | None = None
    trade_mode: int | None = None
    start_time: int | None = None
    expiration_time: int | None = None
    trade_stops_level: int | None = None
    trade_freeze_level: int | None = None
    trade_exemode: int | None = None
    swap_mode: int | None = None
    swap_rollover3days: int | None = None
    margin_hedged_use_leg: bool | None = None
    expiration_mode: int | None = None
    filling_mode: int | None = None
    order_mode: int | None = None
    order_gtc_mode: int | None = None
    option_mode: int | None = None
    option_right: int | None = None
    bid: float | None = None
    bidhigh: float | None = None
    bidlow: float | None = None
    ask: float | None = None
    askhigh: float | None = None
    asklow: float | None = None
    last: float | None = None
    lasthigh: float | None = None
    lastlow: float | None = None
    point: float | None = None
    tick_value: float | None = None
    tick_value_profit: float | None = None
    tick_value_loss: float | None = None
    tick_size: float | None = None
    contract_size: float | None = None
    volume_min: float | None = None
    volume_max: float | None = None
    volume_step: float | None = None
    swap_long: float | None = None
    swap_short: float | None = None
    margin_initial: float | None = None
    margin_maintenance: float | None = None


class AccountInfo(BaseModel):
    """Trading account information"""

    login: int
    trade_mode: int
    leverage: int
    limit_orders: int
    margin_so_mode: int
    trade_allowed: bool
    trade_expert: bool
    margin_mode: int
    currency_digits: int
    fifo_close: bool
    balance: float
    credit: float
    profit: float
    equity: float
    margin: float
    margin_free: float
    margin_level: float
    margin_so_call: float
    margin_so_so: float
    margin_initial: float
    margin_maintenance: float
    assets: float
    liabilities: float
    commission_blocked: float
    name: str
    server: str
    currency: str
    company: str


class OrderRequest(BaseModel):
    """
    Order request parameters for placing trades.

    Important: All type/action fields require INTEGER constants, not strings!

    Fields:
        action: Trade operation type as INTEGER:
            - 1: TRADE_ACTION_DEAL (Execute deal immediately)
            - 5: TRADE_ACTION_PENDING (Place pending order)
            - 6: TRADE_ACTION_SLTP (Modify SL/TP)
            - 7: TRADE_ACTION_MODIFY (Modify pending order)
            - 8: TRADE_ACTION_REMOVE (Remove pending order)
            - 10: TRADE_ACTION_CLOSE_BY (Close by opposite position)

        symbol: Symbol name (e.g., "EURUSD", "XAUUSD")

        order: Pending order ticket for modify/remove operations

        position: Position ticket for SL/TP modification operations

        position_by: Opposite position ticket for close-by operations

        volume: Trade volume in lots (e.g., 0.01, 0.1, 1.0)

        type: Order type as INTEGER (NOT "market order" or "buy"):
            - 0: ORDER_TYPE_BUY (Buy market order)
            - 1: ORDER_TYPE_SELL (Sell market order)
            - 2: ORDER_TYPE_BUY_LIMIT (Buy limit order)
            - 3: ORDER_TYPE_SELL_LIMIT (Sell limit order)
            - 4: ORDER_TYPE_BUY_STOP (Buy stop order)
            - 5: ORDER_TYPE_SELL_STOP (Sell stop order)
            - 6: ORDER_TYPE_BUY_STOP_LIMIT (Buy stop-limit order)
            - 7: ORDER_TYPE_SELL_STOP_LIMIT (Sell stop-limit order)
            - 8: ORDER_TYPE_CLOSE_BY (Close by opposite position)

        price: Order price (use current ask/bid for market orders)

        sl: Stop Loss price (optional)
        tp: Take Profit price (optional)
        deviation: Maximum price deviation in points (optional)
        magic: Expert Advisor ID (optional)
        comment: Order comment (optional, max 31 chars)
        type_time: Order expiration type (optional)
        type_filling: Order filling type as INTEGER (optional):
            - 0: ORDER_FILLING_FOK (Fill or Kill)
            - 1: ORDER_FILLING_IOC (Immediate or Cancel)
            - 2: ORDER_FILLING_RETURN (Return remaining)
    """

    action: int
    order: int | None = None
    position: int | None = None
    position_by: int | None = None
    symbol: str | None = None
    volume: float | None = None
    type: int | None = None
    price: float | None = None
    sl: float | None = None
    tp: float | None = None
    deviation: int | None = None
    magic: int | None = None
    comment: str | None = None
    type_time: int | None = None
    type_filling: int | None = None
    expiration: int | None = None
    stoplimit: float | None = None

    @field_validator("volume")
    @classmethod
    def _vol_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("volume must be > 0 (in lots)")
        return v

    @field_validator("comment")
    @classmethod
    def _comment_len(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 31:
            raise ValueError("comment must be <= 31 characters")
        return v

    @field_validator("action")
    @classmethod
    def _action_valid(cls, v: int) -> int:
        allowed = {
            mt5.TRADE_ACTION_DEAL,
            mt5.TRADE_ACTION_PENDING,
            mt5.TRADE_ACTION_SLTP,
            mt5.TRADE_ACTION_MODIFY,
            mt5.TRADE_ACTION_REMOVE,
            mt5.TRADE_ACTION_CLOSE_BY,
        }
        if v not in allowed:
            raise ValueError(f"action must be one of {sorted(allowed)}")
        return v

    @model_validator(mode="after")
    def _validate_by_action(self) -> "OrderRequest":
        if self.action in {mt5.TRADE_ACTION_DEAL, mt5.TRADE_ACTION_PENDING}:
            missing = [
                name
                for name in ("symbol", "volume", "type", "price")
                if getattr(self, name) is None
            ]
            if missing:
                raise ValueError("Create/deal orders require: " + ", ".join(missing))

            if self.action == mt5.TRADE_ACTION_PENDING:
                stop_limit_types = {
                    mt5.ORDER_TYPE_BUY_STOP_LIMIT,
                    mt5.ORDER_TYPE_SELL_STOP_LIMIT,
                }
                if self.type in stop_limit_types and self.stoplimit is None:
                    raise ValueError("Stop-limit pending orders require: stoplimit")

                if self.type_time == mt5.ORDER_TIME_SPECIFIED and self.expiration is None:
                    raise ValueError("Pending orders with ORDER_TIME_SPECIFIED require: expiration")

        elif self.action == mt5.TRADE_ACTION_MODIFY:
            missing = [name for name in ("order", "price") if getattr(self, name) is None]
            if missing:
                raise ValueError("Pending order modify requires: " + ", ".join(missing))

        elif self.action == mt5.TRADE_ACTION_REMOVE:
            if self.order is None:
                raise ValueError("Pending order remove requires: order")

        elif self.action == mt5.TRADE_ACTION_SLTP:
            if self.position is None:
                raise ValueError("SL/TP modification requires: position")
            if self.sl is None and self.tp is None:
                raise ValueError("SL/TP modification requires at least one of: sl, tp")

        elif self.action == mt5.TRADE_ACTION_CLOSE_BY:
            missing = [name for name in ("position", "position_by") if getattr(self, name) is None]
            if missing:
                raise ValueError("Close-by operation requires: " + ", ".join(missing))

        return self


class OrderResult(BaseModel):
    """Order execution result"""

    retcode: int
    deal: int
    order: int
    volume: float
    price: float
    bid: float
    ask: float
    comment: str
    request_id: int
    retcode_external: int
    request: dict[str, Any]


class Position(BaseModel):
    """Trading position information"""

    ticket: int
    time: int
    time_msc: int
    time_update: int
    time_update_msc: int
    type: int
    magic: int
    identifier: int
    reason: int
    volume: float
    price_open: float
    sl: float
    tp: float
    price_current: float
    swap: float
    profit: float
    symbol: str
    comment: str
    external_id: str


class HistoryOrder(BaseModel):
    """Historical order information"""

    ticket: int
    time_setup: int
    time_setup_msc: int
    time_expiration: int
    type: int
    type_time: int
    type_filling: int
    state: int
    magic: int
    position_id: int
    position_by_id: int
    reason: int
    volume_initial: float
    volume_current: float
    price_open: float
    sl: float
    tp: float
    price_current: float
    price_stoplimit: float
    symbol: str
    comment: str
    external_id: str


class Deal(BaseModel):
    """Deal information"""

    ticket: int
    order: int
    time: int
    time_msc: int
    type: int
    entry: int
    magic: int
    position_id: int
    reason: int
    volume: float
    price: float
    commission: float
    swap: float
    profit: float
    fee: float
    symbol: str
    comment: str
    external_id: str


def _get_supported_filling_mode(symbol: str, action: int | None = None) -> int:
    """
    Get the supported filling mode for a symbol.

    Brokers support different order filling modes. This function checks the symbol's
    filling_mode bitmask and returns the best available option.

    Args:
        symbol: Symbol name (e.g., "EURUSD", "BTCUSD")
        action: Trade action type (optional). If mt5.TRADE_ACTION_PENDING (5),
                always returns mt5.ORDER_FILLING_RETURN (2).

    Returns:
        int: Filling mode constant (mt5.ORDER_FILLING_FOK=0, mt5.ORDER_FILLING_IOC=1, mt5.ORDER_FILLING_RETURN=2)
             Defaults to mt5.ORDER_FILLING_IOC if unable to determine.
    """
    # Pending orders always use RETURN filling mode
    if action is not None and action == mt5.TRADE_ACTION_PENDING:
        return mt5.ORDER_FILLING_RETURN

    try:
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            return mt5.ORDER_FILLING_IOC  # Default to IOC

        # filling_mode is a bitmask: 1=FOK, 2=IOC, 4=reserved (not used in standard MT5)
        # Note: RETURN (2) is NOT a symbol filling mode - it's used for pending orders
        filling_mask = getattr(symbol_info, "filling_mode", 0)

        # Priority: IOC > FOK > RETURN (for non-market execution)
        if filling_mask & 2:  # IOC supported?
            return mt5.ORDER_FILLING_IOC
        elif filling_mask & 1:  # FOK supported?
            return mt5.ORDER_FILLING_FOK
        else:
            # For non-market execution symbols, RETURN may be valid
            # SYMBOL_TRADE_EXECUTION_MARKET = 2 (not exposed in Python API)
            trade_exemode = getattr(symbol_info, "trade_exemode", None)
            if trade_exemode != 2:  # Not market execution
                return mt5.ORDER_FILLING_RETURN
            return mt5.ORDER_FILLING_IOC  # Default to IOC for market execution
    except Exception:
        return mt5.ORDER_FILLING_IOC  # Default to IOC on any error


def _ensure_type_filling(request_dict: dict[str, Any]) -> None:
    """
    Ensure type_filling is set in the request dictionary.

    Auto-detects the appropriate filling mode based on symbol and action
    if not already provided by the user.

    Args:
        request_dict: The order request dictionary to modify in-place.
    """
    if "type_filling" in request_dict or "symbol" not in request_dict:
        return

    action = request_dict.get("action")
    if action not in {mt5.TRADE_ACTION_DEAL, mt5.TRADE_ACTION_PENDING}:
        return

    symbol = request_dict["symbol"]
    filling_mode = _get_supported_filling_mode(symbol, action)
    request_dict["type_filling"] = filling_mode
    logger.info(f"Auto-selected filling mode {filling_mode} for {symbol}")


def _format_timestamps_to_iso8601_utc(df: pd.DataFrame) -> None:
    """
    Convert timestamp columns in a DataFrame to ISO 8601 UTC format strings.

    Modifies the DataFrame in-place, converting:
    - 'time' column: seconds -> ISO 8601 with Z suffix (e.g., "2024-01-22T10:00:00Z")
    - 'time_msc' column: milliseconds -> ISO 8601 with milliseconds and Z suffix (e.g., "2024-01-22T10:00:00.123Z")

    Args:
        df: DataFrame containing timestamp columns to format
    """
    if "time" in df.columns:
        df["time"] = pd.to_datetime(df["time"], unit="s", utc=True).dt.strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )

    if "time_msc" in df.columns:
        # Convert milliseconds to datetime, then format with millisecond precision
        dt_series = pd.to_datetime(df["time_msc"], unit="ms", utc=True)
        # Format with milliseconds (3 digits) instead of microseconds (6 digits)
        df["time_msc"] = (
            dt_series.dt.strftime("%Y-%m-%dT%H:%M:%S")
            + "."
            + (df["time_msc"] % 1000).astype(str).str.zfill(3)
            + "Z"
        )


timeframe_map = {
    # Minutes
    1: mt5.TIMEFRAME_M1,  # 1 minute
    2: mt5.TIMEFRAME_M2,  # 2 minutes
    3: mt5.TIMEFRAME_M3,  # 3 minutes
    4: mt5.TIMEFRAME_M4,  # 4 minutes
    5: mt5.TIMEFRAME_M5,  # 5 minutes
    6: mt5.TIMEFRAME_M6,  # 6 minutes
    10: mt5.TIMEFRAME_M10,  # 10 minutes
    12: mt5.TIMEFRAME_M12,  # 12 minutes
    15: mt5.TIMEFRAME_M15,  # 15 minutes
    20: mt5.TIMEFRAME_M20,  # 20 minutes
    30: mt5.TIMEFRAME_M30,  # 30 minutes
    # Hours
    60: mt5.TIMEFRAME_H1,  # 1 hour
    120: mt5.TIMEFRAME_H2,  # 2 hours
    180: mt5.TIMEFRAME_H3,  # 3 hours
    240: mt5.TIMEFRAME_H4,  # 4 hours
    360: mt5.TIMEFRAME_H6,  # 6 hours
    480: mt5.TIMEFRAME_H8,  # 8 hours
    720: mt5.TIMEFRAME_H12,  # 12 hours
    # Days/Weeks/Months
    1440: mt5.TIMEFRAME_D1,  # 1 day
    10080: mt5.TIMEFRAME_W1,  # 1 week
    43200: mt5.TIMEFRAME_MN1,  # 1 month
}


def get_timeframe_constant(timeframe: int) -> int:
    """
    Convert user-friendly timeframe integer to MT5 constant with validation.

    Args:
        timeframe: Timeframe in minutes (e.g., 60 for H1)

    Returns:
        MT5 timeframe constant

    Raises:
        ValueError: If timeframe is not supported
    """
    if timeframe not in timeframe_map:
        supported = ", ".join(str(k) for k in sorted(timeframe_map.keys()))
        raise ValueError(
            f"Unsupported timeframe: {timeframe}. Supported timeframes (in minutes): {supported}"
        )
    return timeframe_map[timeframe]


def _auto_login_if_needed() -> bool:
    """Read credentials from .env and log in to MT5 if the current account is
    not authenticated. Used by initialize() so the MCP session is always ready.

    Credentials (from .env / environment or Config/mt5-login.env):
        MT5_LOGIN          — int account number  (e.g. 12345678)
        MT5_PASSWORD       — str account password
        MT5_SERVER         — str server name    (e.g. YourBroker-Demo)

    Returns:
        True if already logged in or login succeeded, False otherwise.
    """
    # Load credentials from mt5-login.env (user-editable in kladblok) if not
    # already in the process environment. This lets the user set their
    # password in a file instead of the chat.
    _login_env = _get_mt5_paths().get("config_folder", "") + "/mt5-login.env"
    if os.path.exists(_login_env):
        load_dotenv(_login_env, override=False)

    # Bail out if no credentials are configured.
    raw_login = os.getenv("MT5_LOGIN")
    raw_pass  = os.getenv("MT5_PASSWORD")
    raw_srv   = os.getenv("MT5_SERVER")
    if not raw_login:
        return True  # nothing to auto-login; user calls login() explicitly

    try:
        login = int(raw_login)
    except (TypeError, ValueError):
        return False

    # Check whether we are already authenticated.
    try:
        info = mt5.account_info()
        if info and getattr(info, "login", 0) == login:
            return True
    except Exception:
        pass

    ok = mt5.login(login=login, password=raw_pass or "", server=raw_srv or "")
    if ok:
        logger.info(f"Auto-logged in to account #{login}")
    else:
        logger.error(f"Auto-login failed, error code: {mt5.last_error()}")
    return ok


def _spawn_portable_mt5(paths: dict) -> bool:
    """Start the portable MT5 terminal (with /portable flag) if it is not
    already running. Returns True if a terminal is running after this call.

    We use /portable so MT5 writes ALL data (accounts.dat, EBWebView, server
    cache) into C:\\AI\\MetaTrader5_Portable\\… instead of
    %APPDATA%\\MetaQuotes\\Terminal\\<hash>.  WITHOUT /portable the terminal
    creates the shared roaming hash dir and hits a WebView2 permission-dialog
    ('De gegevensmap kan niet worden gemaakt') that blocks headless IPC.
    """
    import subprocess, time

    exe = paths["terminal"]
    if not os.path.exists(exe):
        logger.error("Portable terminal executable not found: %s", exe)
        return False

    # Already running?
    try:
        tasklist = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq terminal64.exe"],
            capture_output=True, text=True
        )
        if "terminal64.exe" in tasklist.stdout:
            return True
    except Exception:
        pass

    # Start portable, detached in the user's desktop session.
    cwd = os.path.dirname(exe)
    try:
        subprocess.Popen(
            [exe, "/portable"],
            cwd=cwd,
            creationflags=subprocess.CREATE_NEW_CONSOLE | subprocess.DETACHED_PROCESS,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
        )
        logger.info("Started portable MT5: %s /portable", exe)
    except Exception as e:
        logger.error("Failed to spawn portable MT5: %s", e)
        return False

    # Give it time to write accounts.dat / IPC server
    for _ in range(12):
        time.sleep(2.5)
        if mt5.initialize(path=exe):
            return True
        try:
            if "terminal64.exe" in subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq terminal64.exe"],
                capture_output=True, text=True
            ).stdout:
                return True
        except Exception:
            pass
    logger.warning("Portable MT5 spawned but not yet connectable")
    return False


# Initialize MetaTrader 5 connection
@mcp.tool()
def initialize(path: str | None = None) -> bool:
    """
    Initialize the MetaTrader 5 terminal.

    This MUST be called first before using any other MT5 tools.
    Establishes connection to the MT5 terminal application.

    Args:
        path: Full path to the MT5 terminal executable.
              Common paths:
              - "C:\\Program Files\\MetaTrader 5\\terminal64.exe"
              - "C:\\Program Files (x86)\\MetaTrader 5\\terminal64.exe"

    Returns:
        bool: True if initialization was successful, False otherwise.

    Example:
        # Initialize MT5 connection first
        initialize(path="C:\\Program Files\\MetaTrader 5\\terminal64.exe")
        # Now you can use other tools like get_account_info(), symbol_select(), etc.
    """
    paths = _get_mt5_paths()
    # If the user did not supply a path, use the portable terminal from .env
    if not path:
        path = paths["terminal"]
    else:
        p_obj = Path(path.strip().strip('"').strip("'"))
        if not p_obj.is_absolute():
            ws_root = _find_project_root()
            cand = ws_root / p_obj
            path = str(cand.resolve()) if cand.exists() else str(p_obj.resolve())
        else:
            path = str(p_obj)

    # data_folder = the portable Config dir (used for mt5-login.env etc.)
    data_folder = os.path.dirname(path)

    # Ensure a portable MT5 terminal is running (start one with /portable
    # if needed — headless GUI spawn works via detached CREATE_NEW_CONSOLE).
    if not _spawn_portable_mt5(paths):
        # Could not start/confirm a running terminal → try direct init anyway
        pass

    # Connect to the running terminal via its IPC server using path=terminal64.exe
    # (NOT data_folder — the MetaTrader5 package requires the exe path to attach
    # to a running IPC server; path=<data_folder> gives IPC initialize failed).
    for attempt in range(3):
        if mt5.initialize(path=path):
            logger.info("MT5 connected to terminal (%s)", path)
            _auto_login_if_needed()
            return True
        logger.debug("initialize attempt %d failed: %s", attempt + 1, mt5.last_error())
        import time; time.sleep(5 * (attempt + 1))

    logger.error(f"MT5 initialization failed after retries, error code: {mt5.last_error()}")
    return False


# Shutdown MetaTrader 5 connection
@mcp.tool()
def shutdown() -> bool:
    """
    Shut down the connection to the MetaTrader 5 terminal.

    Returns:
        bool: True if shutdown was successful.
    """
    mt5.shutdown()
    logger.info("MT5 connection shut down")
    return True


# Login to MetaTrader 5 account
@mcp.tool()
def login(login: int, password: str, server: str) -> bool:
    """
    Log in to the MetaTrader 5 trading account.

    Call this AFTER initialize() if you need to switch accounts or login programmatically.
    Not required if MT5 terminal is already logged in to an account.

    Args:
        login: Trading account number (integer, e.g., 12345678)
        password: Trading account password (string)
        server: Trading server name (e.g., "Demo-Server", "YourBroker-Live")

    Returns:
        bool: True if login was successful, False otherwise.

    Example:
        # First initialize MT5
        initialize(path="C:\\Program Files\\MetaTrader 5\\terminal64.exe")
        # Then login to your account
        login(login=12345678, password="yourpassword", server="Demo-Server")
        # Now you can use get_account_info(), place trades, etc.
    """
    if not mt5.login(login=login, password=password, server=server):
        logger.error(f"MT5 login failed, error code: {mt5.last_error()}")
        return False

    logger.info(f"MT5 login successful to account #{login} on server {server}")
    return True


# Get account information
@mcp.tool()
def get_account_info() -> AccountInfo:
    """
    Get information about the current trading account.

    Important: Requires MT5 to be initialized and logged in.
    If this fails, ensure you have:
    1. Called initialize() first
    2. Logged in using login() if using a demo/live account
    3. Have an active connection to the terminal

    Returns:
        AccountInfo: Information about the trading account including balance, equity,
                     margin, profit, etc.

    Raises:
        ValueError: If account info cannot be retrieved. Common causes:
            - MT5 not initialized: Call initialize() first
            - Not logged in: Call login() with your credentials
            - Terminal not connected: Check MT5 connection status
    """
    account_info = mt5.account_info()
    if account_info is None:
        error_code, error_msg = mt5.last_error()
        logger.error(f"Failed to get account info, error: {error_code} - {error_msg}")
        raise ValueError(
            f"Failed to get account info. Error: {error_code} - {error_msg}. "
            f"Possible causes:\n"
            f"1. MT5 not initialized - Call initialize() first\n"
            f"2. Not logged in - Call login() with your credentials\n"
            f"3. Terminal not connected - Check MT5 terminal status\n"
            f"4. No active trading account - Ensure an account is configured in MT5"
        )

    # Convert named tuple to dictionary
    account_dict = account_info._asdict()
    return AccountInfo(**account_dict)


# Auto-initialize helper (private — NOT an MCP tool)
def _ensure_mt5_connected() -> bool:
    """Auto-initialize MT5 if no IPC connection exists.

    Returns True if connected (already or freshly initialized), False if
    initialization failed (e.g. no running terminal + headless spawn fails).
    """
    if mt5.terminal_info() is None:
        err = mt5.last_error()
        # -10004 = No IPC connection → terminal not started or not inited
        if err == -10004 or err == -10003:
            logger.info("No IPC connection (err %s); calling initialize()...", err)
            paths = _get_mt5_paths()
            # NOTE: empirically, the MetaTrader5 package requires path= the
            # *terminal64.exe* path (not the data folder) to attach to a running
            # instance. path= <data_folder> gives "IPC initialize failed".
            return mt5.initialize(path=paths["terminal"])
        return False
    return True


def get_terminal_info() -> dict[str, Any]:
    """
    Get information about the MetaTrader 5 terminal.

    Returns:
        Dict[str, Any]: Information about the terminal.
    """
    if not _ensure_mt5_connected():
        logger.error(f"Failed to get terminal info, error code: {mt5.last_error()}")
        raise ValueError("Failed to get terminal info")

    terminal_info = mt5.terminal_info()
    # Convert named tuple to dictionary
    return terminal_info._asdict()


# Get version information
@mcp.tool()
def get_version() -> dict[str, Any]:
    """
    Get the MetaTrader 5 version.

    Returns:
        Dict[str, Any]: Version information.
    """
    version = mt5.version()
    if version is None:
        logger.error(f"Failed to get version, error code: {mt5.last_error()}")
        raise ValueError("Failed to get version")

    return {"version": version[0], "build": version[1], "date": version[2]}


# Get symbols
@mcp.tool()
def get_symbols() -> list[str]:
    """
    Get all available symbols (financial instruments) from the MetaTrader 5 terminal.

    Returns:
        List[str]: List of symbol names.
    """
    symbols = mt5.symbols_get()
    if symbols is None:
        logger.error(f"Failed to get symbols, error code: {mt5.last_error()}")
        raise ValueError("Failed to get symbols")

    return [symbol.name for symbol in symbols]


# Get symbols by group
@mcp.tool()
def get_symbols_by_group(group: str) -> list[str]:
    """
    Get symbols that match a specific group or pattern.

    Args:
        group: Filter for arranging a group of symbols (e.g., "*", "EUR*", etc.)

    Returns:
        List[str]: List of symbol names that match the group.
    """
    symbols = mt5.symbols_get(group=group)
    if symbols is None:
        logger.error(f"Failed to get symbols for group {group}, error code: {mt5.last_error()}")
        return []

    return [symbol.name for symbol in symbols]


# Get symbol information
@mcp.tool()
def get_symbol_info(symbol: str) -> SymbolInfo:
    """
    Get information about a specific symbol.

    Args:
        symbol: Symbol name

    Returns:
        SymbolInfo: Information about the symbol.
    """
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        logger.error(f"Failed to get info for symbol {symbol}, error code: {mt5.last_error()}")
        raise ValueError(f"Failed to get info for symbol {symbol}")

    # Convert named tuple to dictionary
    symbol_dict = symbol_info._asdict()
    return SymbolInfo(**symbol_dict)


# Get symbol tick information
@mcp.tool()
def get_symbol_info_tick(symbol: str) -> dict[str, Any]:
    """
    Get the latest tick data for a symbol.

    Important: The symbol must be selected/visible in Market Watch.
    If this fails, try calling symbol_select() first to add the symbol.

    Args:
        symbol: Symbol name (e.g., "EURUSD", "XAUUSD", "GBPUSD")

    Returns:
        Dict[str, Any]: Latest tick data with fields: time, bid, ask, last, volume, etc.

    Raises:
        ValueError: If the symbol is not found or not selected in Market Watch.
            Try calling symbol_select(symbol="{symbol}", visible=True) first.
    """
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        error_code, error_msg = mt5.last_error()
        logger.error(f"Failed to get tick for symbol {symbol}, error: {error_code} - {error_msg}")
        raise ValueError(
            f"Failed to get tick for symbol {symbol}. "
            f"Error: {error_code} - {error_msg}. "
            f"The symbol may not be selected in Market Watch. "
            f"Try calling symbol_select(symbol='{symbol}', visible=True) first, "
            f"or check if the symbol name is correct and available with your broker."
        )

    # Convert named tuple to dictionary
    return tick._asdict()


# Select symbol in Market Watch
@mcp.tool()
def symbol_select(symbol: str, visible: bool = True) -> bool:
    """
    Select a symbol in the Market Watch window or remove a symbol from it.

    This is REQUIRED before you can get tick data or trade a symbol.
    If get_symbol_info_tick() or other symbol operations fail, call this first.

    Args:
        symbol: Symbol name (e.g., "EURUSD", "XAUUSD", "GBPUSD")
        visible: Symbol visibility flag
            - True: Add/show the symbol in Market Watch (default, recommended)
            - False: Hide the symbol from Market Watch

    Returns:
        bool: True if the symbol is selected successfully, False otherwise.

    Example:
        # Before getting tick data for XAUUSD:
        symbol_select(symbol="XAUUSD", visible=True)
        tick = get_symbol_info_tick(symbol="XAUUSD")
    """
    result = mt5.symbol_select(symbol, visible)
    if not result:
        logger.error(f"Failed to select symbol {symbol}, error code: {mt5.last_error()}")

    return result


# Copy rates from position
@mcp.tool()
def copy_rates_from_pos(
    symbol: str, timeframe: int, start_pos: int, count: int
) -> list[dict[str, Any]]:
    """
    Get bars from a specified symbol and timeframe starting from the specified position.

    Args:
        symbol: Symbol name (e.g., "EURUSD", "GBPUSD")
        timeframe: Timeframe in minutes as an INTEGER:
            - 1: TIMEFRAME_M1 (1 minute)
            - 5: TIMEFRAME_M5 (5 minutes)
            - 15: TIMEFRAME_M15 (15 minutes)
            - 30: TIMEFRAME_M30 (30 minutes)
            - 60: TIMEFRAME_H1 (1 hour)
            - 240: TIMEFRAME_H4 (4 hours)
            - 1440: TIMEFRAME_D1 (1 day)
            - 10080: TIMEFRAME_W1 (1 week)
            - 43200: TIMEFRAME_MN1 (1 month)
        start_pos: Starting position as an INTEGER (0 = most recent bar, 1 = second most recent, etc.)
        count: Number of bars to retrieve as an INTEGER (e.g., 100 for last 100 bars)

    Example:
        To get the last 100 bars: start_pos=0, count=100
        To get bars 10-20 from the end: start_pos=10, count=10

    Returns:
        List[Dict[str, Any]]: List of bars with time, open, high, low, close, tick_volume, spread, and real_volume.
    """
    rates = mt5.copy_rates_from_pos(symbol, get_timeframe_constant(timeframe), start_pos, count)
    if rates is None:
        logger.error(f"Failed to copy rates for {symbol}, error code: {mt5.last_error()}")
        raise ValueError(f"Failed to copy rates for {symbol}")

    # Convert numpy array to list of dictionaries
    df = pd.DataFrame(rates)
    # Convert timestamps to ISO 8601 UTC format for JSON serialization
    _format_timestamps_to_iso8601_utc(df)

    return df.to_dict("records")


# Copy rates from date
@mcp.tool()
def copy_rates_from_date(
    symbol: str, timeframe: int, date_from: datetime, count: int
) -> list[dict[str, Any]]:
    """
    Get bars from a specified symbol and timeframe starting from the specified date.

    Args:
        symbol: Symbol name
        timeframe: Timeframe (use TIMEFRAME_* constants)
        date_from: Start date for bar retrieval
        count: Number of bars to retrieve

    Returns:
        List[Dict[str, Any]]: List of bars with time, open, high, low, close, tick_volume, spread, and real_volume.
    """
    rates = mt5.copy_rates_from_date(symbol, get_timeframe_constant(timeframe), date_from, count)
    if rates is None:
        logger.error(
            f"Failed to copy rates for {symbol} from date {date_from}, error code: {mt5.last_error()}"
        )
        raise ValueError(f"Failed to copy rates for {symbol} from date {date_from}")

    # Convert numpy array to list of dictionaries
    df = pd.DataFrame(rates)
    # Convert timestamps to ISO 8601 UTC format for JSON serialization
    _format_timestamps_to_iso8601_utc(df)

    return df.to_dict("records")


# Copy rates range
@mcp.tool()
def copy_rates_range(
    symbol: str, timeframe: int, date_from: datetime, date_to: datetime
) -> list[dict[str, Any]]:
    """
    Get bars from a specified symbol and timeframe within the specified date range.

    Args:
        symbol: Symbol name
        timeframe: Timeframe (use TIMEFRAME_* constants)
        date_from: Start date for bar retrieval
        date_to: End date for bar retrieval

    Returns:
        List[Dict[str, Any]]: List of bars with time, open, high, low, close, tick_volume, spread, and real_volume.
    """
    rates = mt5.copy_rates_range(symbol, get_timeframe_constant(timeframe), date_from, date_to)
    if rates is None:
        logger.error(
            f"Failed to copy rates for {symbol} in range {date_from} to {date_to}, error code: {mt5.last_error()}"
        )
        raise ValueError(f"Failed to copy rates for {symbol} in range {date_from} to {date_to}")

    # Convert numpy array to list of dictionaries
    df = pd.DataFrame(rates)
    # Convert timestamps to ISO 8601 UTC format for JSON serialization
    _format_timestamps_to_iso8601_utc(df)

    return df.to_dict("records")


# Copy ticks from position
@mcp.tool()
def copy_ticks_from_pos(
    symbol: str, start_time: datetime, count: int, flags: int = mt5.COPY_TICKS_ALL
) -> list[dict[str, Any]]:
    """
    Get ticks from a specified symbol starting from the specified position.

    Args:
        symbol: Symbol name
        start_time: Initial time for tick retrieval
        count: Number of ticks to retrieve
        flags: Type of requested ticks:
            - mt5.COPY_TICKS_ALL: All ticks (default)
            - mt5.COPY_TICKS_INFO: Ticks containing bid and/or ask price changes
            - mt5.COPY_TICKS_TRADE: Ticks containing last price and volume changes

    Returns:
        List[Dict[str, Any]]: List of ticks.
    """
    ticks = mt5.copy_ticks_from(symbol, start_time, count, flags)
    if ticks is None:
        logger.error(f"Failed to copy ticks for {symbol}, error code: {mt5.last_error()}")
        raise ValueError(f"Failed to copy ticks for {symbol}")

    # Convert numpy array to list of dictionaries
    df = pd.DataFrame(ticks)
    # Convert timestamps to ISO 8601 UTC format for JSON serialization
    _format_timestamps_to_iso8601_utc(df)

    return df.to_dict("records")


# Copy ticks from date
@mcp.tool()
def copy_ticks_from_date(
    symbol: str, date_from: datetime, count: int, flags: int = mt5.COPY_TICKS_ALL
) -> list[dict[str, Any]]:
    """
    Get ticks from a specified symbol starting from the specified date.

    Args:
        symbol: Symbol name
        date_from: Start date for tick retrieval
        count: Number of ticks to retrieve
        flags: Type of requested ticks

    Returns:
        List[Dict[str, Any]]: List of ticks.
    """
    ticks = mt5.copy_ticks_from(symbol, date_from, count, flags)
    if ticks is None:
        logger.error(
            f"Failed to copy ticks for {symbol} from date {date_from}, error code: {mt5.last_error()}"
        )
        raise ValueError(f"Failed to copy ticks for {symbol} from date {date_from}")

    # Convert numpy array to list of dictionaries
    df = pd.DataFrame(ticks)
    # Convert timestamps to ISO 8601 UTC format for JSON serialization
    _format_timestamps_to_iso8601_utc(df)

    return df.to_dict("records")


# Copy ticks range
@mcp.tool()
def copy_ticks_range(
    symbol: str, date_from: datetime, date_to: datetime, flags: int = mt5.COPY_TICKS_ALL
) -> list[dict[str, Any]]:
    """
    Get ticks from a specified symbol within the specified date range.

    Args:
        symbol: Symbol name
        date_from: Start date for tick retrieval
        date_to: End date for tick retrieval
        flags: Type of requested ticks

    Returns:
        List[Dict[str, Any]]: List of ticks.
    """
    ticks = mt5.copy_ticks_range(symbol, date_from, date_to, flags)
    if ticks is None:
        logger.error(
            f"Failed to copy ticks for {symbol} in range {date_from} to {date_to}, error code: {mt5.last_error()}"
        )
        raise ValueError(f"Failed to copy ticks for {symbol} in range {date_from} to {date_to}")

    # Convert numpy array to list of dictionaries
    df = pd.DataFrame(ticks)
    # Convert timestamps to ISO 8601 UTC format for JSON serialization
    _format_timestamps_to_iso8601_utc(df)

    return df.to_dict("records")


# Get last error
@mcp.tool()
def get_last_error() -> dict[str, Any]:
    """
    Get the last error code and description.

    Returns:
        Dict[str, Any]: Last error code and description.
    """
    error_code, error_message = mt5.last_error()

    error_descriptions = {
        mt5.RES_S_OK: "OK",
        mt5.RES_E_FAIL: "Generic fail",
        mt5.RES_E_INVALID_PARAMS: "Invalid parameters",
        mt5.RES_E_NO_MEMORY: "No memory",
        mt5.RES_E_NOT_FOUND: "Not found",
        mt5.RES_E_INVALID_VERSION: "Invalid version",
        mt5.RES_E_AUTH_FAILED: "Authorization failed",
        mt5.RES_E_UNSUPPORTED: "Unsupported method",
        mt5.RES_E_AUTO_TRADING_DISABLED: "Auto-trading disabled",
        mt5.RES_E_INTERNAL_FAIL: "Internal failure",
    }

    error_description = error_descriptions.get(error_code, error_message or "Unknown error")

    return {"code": error_code, "description": error_description}


# Resource for timeframe constants
@mcp.resource("mt5://timeframes")
def get_timeframes() -> str:
    """
    Get information about available timeframes in MetaTrader 5.

    Returns:
        str: Information about available timeframes.
    """
    timeframes = {
        "TIMEFRAME_M1": 1,
        "TIMEFRAME_M2": 2,
        "TIMEFRAME_M3": 3,
        "TIMEFRAME_M4": 4,
        "TIMEFRAME_M5": 5,
        "TIMEFRAME_M6": 6,
        "TIMEFRAME_M10": 10,
        "TIMEFRAME_M12": 12,
        "TIMEFRAME_M15": 15,
        "TIMEFRAME_M20": 20,
        "TIMEFRAME_M30": 30,
        "TIMEFRAME_H1": 60,
        "TIMEFRAME_H2": 120,
        "TIMEFRAME_H3": 180,
        "TIMEFRAME_H4": 240,
        "TIMEFRAME_H6": 360,
        "TIMEFRAME_H8": 480,
        "TIMEFRAME_H12": 720,
        "TIMEFRAME_D1": 1440,
        "TIMEFRAME_W1": 10080,
        "TIMEFRAME_MN1": 43200,
    }

    result = "Available timeframes in MetaTrader 5:\n\n"
    for name, value in timeframes.items():
        result += f"{name}: {value}\n"

    return result


# Resource for tick flag constants
@mcp.resource("mt5://tick_flags")
def get_tick_flags() -> str:
    """
    Get information about tick flags in MetaTrader 5.

    Returns:
        str: Information about tick flags.
    """
    tick_flags = {
        "COPY_TICKS_ALL": mt5.COPY_TICKS_ALL,
        "COPY_TICKS_INFO": mt5.COPY_TICKS_INFO,
        "COPY_TICKS_TRADE": mt5.COPY_TICKS_TRADE,
    }

    result = "Available tick flags in MetaTrader 5:\n\n"
    for name, value in tick_flags.items():
        result += f"{name}: {value}\n"

    return result


# Send order
@mcp.tool()
def order_send(request: OrderRequest) -> OrderResult:
    """
    Send an order to the trade server.

    CRITICAL REQUIREMENTS:
    1. Pass the order fields inside request={...}
    2. Use INTEGER constants for action, type, type_filling - NO STRINGS
    3. Volume is in LOTS (0.01, 0.1, 1.0), NOT contract units (100000)
    4. Do NOT include unsupported fields like "group"
    5. action must use MT5 constants from your installed library

    Common Mistakes to Avoid:
    - ❌ "action": 0 → ✅ "action": 1 (for market) or 5 (for pending)
    - ❌ "action": "buy" → ✅ "action": 1
    - ❌ "type": "limit" → ✅ "type": 2
    - ❌ "volume": 100000 → ✅ "volume": 0.1
    - ❌ request: "{...json...}" → ✅ request: {...object...}

    Args:
        request: OrderRequest object with these fields:
            REQUIRED:
            - action (int): MT5 trade action constant, e.g. 1=DEAL, 5=PENDING
            - symbol (str): e.g., "EURUSD"
            - volume (float): Lots, e.g., 0.01 (micro), 0.1 (mini), 1.0 (standard)
            - type (int): 0=BUY, 1=SELL, 2=BUY_LIMIT, 3=SELL_LIMIT, etc.
            - price (float): Order price

            OPTIONAL (omit if not needed, don't set to None or 0):
            - sl (float): Stop loss price
            - tp (float): Take profit price
            - deviation (int): Max price deviation in points
            - magic (int): EA identifier
            - comment (str): Max 31 characters
            - type_time (int): Expiration type
            - type_filling (int): 0=FOK, 1=IOC, 2=RETURN (omit to auto-detect)

    Returns:
        OrderResult: Order execution result with return code, deal, order info.

    Example 1 - Market Buy Order (with all optional fields):
        {
            "action": 1,
            "symbol": "EURUSD",
            "volume": 0.1,
            "type": 0,
            "price": 1.1850,
            "sl": 1.1800,
            "tp": 1.1900,
            "deviation": 20,
            "magic": 123456,
            "comment": "Buy order",
            "type_filling": 2
        }

    Example 2 - Market Buy Order (minimal - only required fields):
        {
            "action": 1,
            "symbol": "EURUSD",
            "volume": 0.1,
            "type": 0,
            "price": 1.1850
        }

    Example 3 - Buy Limit Order (pending):
        {
            "action": 5,
            "symbol": "EURUSD",
            "volume": 0.1,
            "type": 2,
            "price": 1.3000,
            "sl": 1.2950,
            "tp": 1.3050
        }

    """
    # Convert request to dictionary and exclude None values
    # MT5 doesn't accept None for optional parameters - they must be omitted entirely
    request_dict = request.model_dump(exclude_none=True)

    # Auto-detect filling mode if not provided
    _ensure_type_filling(request_dict)

    # Send order
    result = mt5.order_send(request_dict)
    if result is None:
        error_code, error_msg = mt5.last_error()
        logger.error(f"Failed to send order, error: {error_code} - {error_msg}")
        raise ValueError(
            f"Failed to send order. MT5 Error {error_code}: {error_msg}\n"
            f"Request: {request_dict}\n"
            f"Common causes:\n"
            f"- MT5 not initialized: Call initialize() first\n"
            f"- Invalid symbol: Check symbol name and ensure it's selected\n"
            f"- Invalid price: Ensure price is current (use get_symbol_info_tick)\n"
            f"- Insufficient margin: Check account balance\n"
            f"- Market closed: Check if trading is allowed\n"
            f"- Auto-trading disabled: Enable in MT5 terminal\n"
            f"- Invalid volume: Check min/max/step volume for the symbol"
        )

    # Convert named tuple to dictionary
    result_dict = result._asdict()

    # Define MT5 success retcodes - these are NOT errors
    success_retcodes = {
        mt5.TRADE_RETCODE_DONE,  # 10009 - Order placed successfully (market order)
        mt5.TRADE_RETCODE_PLACED,  # 10008 - Order placed (pending order)
        mt5.TRADE_RETCODE_DONE_PARTIAL,  # 10010 - Partial fill (rest canceled)
    }

    # Check if order execution failed (retcode not in success set)
    retcode = result_dict.get("retcode")
    if retcode not in success_retcodes:
        comment = result_dict.get("comment", "Unknown error")
        logger.error(f"Order execution failed with retcode {retcode}: {comment}")

        # Map common error retcodes to helpful messages
        retcode_messages = {
            mt5.TRADE_RETCODE_REQUOTE: "TRADE_RETCODE_REQUOTE - Requote. Price changed, retry with new price",
            mt5.TRADE_RETCODE_REJECT: "TRADE_RETCODE_REJECT - Request rejected by broker",
            mt5.TRADE_RETCODE_CANCEL: "TRADE_RETCODE_CANCEL - Request canceled by trader",
            mt5.TRADE_RETCODE_ERROR: "TRADE_RETCODE_ERROR - Request processing error",
            mt5.TRADE_RETCODE_TIMEOUT: "TRADE_RETCODE_TIMEOUT - Request timeout",
            mt5.TRADE_RETCODE_INVALID: "TRADE_RETCODE_INVALID - Invalid request",
            mt5.TRADE_RETCODE_INVALID_VOLUME: "TRADE_RETCODE_INVALID_VOLUME - Invalid volume",
            mt5.TRADE_RETCODE_INVALID_PRICE: "TRADE_RETCODE_INVALID_PRICE - Invalid price",
            mt5.TRADE_RETCODE_INVALID_STOPS: "TRADE_RETCODE_INVALID_STOPS - Invalid stops (SL/TP)",
            mt5.TRADE_RETCODE_TRADE_DISABLED: "TRADE_RETCODE_TRADE_DISABLED - Trading disabled",
            mt5.TRADE_RETCODE_MARKET_CLOSED: "TRADE_RETCODE_MARKET_CLOSED - Market is closed",
            mt5.TRADE_RETCODE_NO_MONEY: "TRADE_RETCODE_NO_MONEY - Not enough money",
            mt5.TRADE_RETCODE_PRICE_CHANGED: "TRADE_RETCODE_PRICE_CHANGED - Price changed, retry",
            mt5.TRADE_RETCODE_PRICE_OFF: "TRADE_RETCODE_PRICE_OFF - No prices (broker not providing quotes)",
            mt5.TRADE_RETCODE_INVALID_EXPIRATION: "TRADE_RETCODE_INVALID_EXPIRATION - Invalid order expiration",
            mt5.TRADE_RETCODE_ORDER_CHANGED: "TRADE_RETCODE_ORDER_CHANGED - Order state changed",
            mt5.TRADE_RETCODE_TOO_MANY_REQUESTS: "TRADE_RETCODE_TOO_MANY_REQUESTS - Too many requests",
            mt5.TRADE_RETCODE_NO_CHANGES: "TRADE_RETCODE_NO_CHANGES - No changes in request",
            mt5.TRADE_RETCODE_SERVER_DISABLES_AT: "TRADE_RETCODE_SERVER_DISABLES_AT - Autotrading disabled by server",
            mt5.TRADE_RETCODE_CLIENT_DISABLES_AT: "TRADE_RETCODE_CLIENT_DISABLES_AT - Autotrading disabled by client",
            mt5.TRADE_RETCODE_LOCKED: "TRADE_RETCODE_LOCKED - Request locked for processing",
            mt5.TRADE_RETCODE_FROZEN: "TRADE_RETCODE_FROZEN - Order/position frozen",
            mt5.TRADE_RETCODE_INVALID_FILL: "TRADE_RETCODE_INVALID_FILL - Invalid filling type",
        }

        detailed_msg = retcode_messages.get(retcode, f"Unknown retcode {retcode}")
        raise ValueError(
            f"Order execution failed: {detailed_msg}\n"
            f"Comment from broker: {comment}\n"
            f"Request: {request_dict}\n"
            f"Result: {result_dict}"
        )

    # Convert request named tuple to dictionary if needed
    if hasattr(result_dict["request"], "_asdict"):
        result_dict["request"] = result_dict["request"]._asdict()

    return OrderResult(**result_dict)


# Check order
@mcp.tool()
def order_check(request: OrderRequest) -> dict[str, Any]:
    """
    Check if an order can be placed with the specified parameters.

    Use this BEFORE order_send() to validate the order without executing it.
    Follows the same requirements as order_send():
    - request must be an OBJECT (dict), not a JSON string
    - Use INTEGER constants for action, type, type_filling
    - Volume in LOTS (0.01, 0.1, 1.0), not contract units

    Args:
        request: OrderRequest object (same format as order_send)
                See order_send() documentation for field details and examples.

    Returns:
        Dict[str, Any]: Order check result with retcode, balance, equity, margin, etc.
            - retcode: 0 if check passed, error code otherwise
            - balance: Account balance after order
            - equity: Account equity after order
            - margin: Required margin
            - margin_free: Free margin after order
            - comment: Error description if check failed

    Example:
        # Check before sending
        result = order_check(request={
            "action": 1,
            "symbol": "EURUSD",
            "volume": 0.1,
            "type": 0,
            "price": 1.1850,
            "type_filling": 2
        })
        if result["retcode"] == 0:
            # OK to send the order
            order_send(request={...})
    """
    # Convert request to dictionary and exclude None values
    # MT5 doesn't accept None for optional parameters - they must be omitted entirely
    request_dict = request.model_dump(exclude_none=True)

    # Auto-detect filling mode if not provided
    _ensure_type_filling(request_dict)

    # Check order
    result = mt5.order_check(request_dict)
    if result is None:
        error_code, error_msg = mt5.last_error()
        logger.error(f"Failed to check order, error: {error_code} - {error_msg}")
        raise ValueError(
            f"Failed to check order. MT5 Error {error_code}: {error_msg}\n"
            f"Request: {request_dict}\n"
            f"Common causes:\n"
            f"- MT5 not initialized: Call initialize() first\n"
            f"- Invalid parameters: Check symbol, volume, price, etc."
        )

    # Convert named tuple to dictionary
    result_dict = result._asdict()

    # Convert request named tuple to dictionary if needed
    if hasattr(result_dict["request"], "_asdict"):
        result_dict["request"] = result_dict["request"]._asdict()

    return result_dict


# Get positions
@mcp.tool()
def positions_get(symbol: str | None = None, group: str | None = None) -> list[Position]:
    """
    Get open positions.

    Args:
        symbol: Symbol name. If specified, only positions for this symbol will be returned.
        group: Filter for arranging a group of positions (e.g., "*", "USD*", etc.)

    Returns:
        List[Position]: List of open positions.
    """
    if symbol is not None:
        positions = mt5.positions_get(symbol=symbol)
    elif group is not None:
        positions = mt5.positions_get(group=group)
    else:
        positions = mt5.positions_get()

    if positions is None:
        logger.error(f"Failed to get positions, error code: {mt5.last_error()}")
        return []

    result = []
    for position in positions:
        # Convert named tuple to dictionary
        position_dict = position._asdict()
        result.append(Position(**position_dict))

    return result


# Get position by ticket
@mcp.tool()
def positions_get_by_ticket(ticket: int) -> Position | None:
    """
    Get an open position by its ticket.

    Args:
        ticket: Position ticket

    Returns:
        Optional[Position]: Position information or None if not found.
    """
    position = mt5.positions_get(ticket=ticket)
    if position is None or len(position) == 0:
        logger.error(f"Failed to get position with ticket {ticket}, error code: {mt5.last_error()}")
        return None

    # Convert named tuple to dictionary
    position_dict = position[0]._asdict()
    return Position(**position_dict)


# Get orders
@mcp.tool()
def orders_get(symbol: str | None = None, group: str | None = None) -> list[dict[str, Any]]:
    """
    Get active orders.

    Args:
        symbol: Symbol name. If specified, only orders for this symbol will be returned.
        group: Filter for arranging a group of orders (e.g., "*", "USD*", etc.)

    Returns:
        List[Dict[str, Any]]: List of active orders.
    """
    if symbol is not None:
        orders = mt5.orders_get(symbol=symbol)
    elif group is not None:
        orders = mt5.orders_get(group=group)
    else:
        orders = mt5.orders_get()

    if orders is None:
        logger.error(f"Failed to get orders, error code: {mt5.last_error()}")
        return []

    result = []
    for order in orders:
        # Convert named tuple to dictionary
        order_dict = order._asdict()
        result.append(order_dict)

    return result


# Get order by ticket
@mcp.tool()
def orders_get_by_ticket(ticket: int) -> dict[str, Any] | None:
    """
    Get an active order by its ticket.

    Args:
        ticket: Order ticket

    Returns:
        Optional[Dict[str, Any]]: Order information or None if not found.
    """
    order = mt5.orders_get(ticket=ticket)
    if order is None or len(order) == 0:
        logger.error(f"Failed to get order with ticket {ticket}, error code: {mt5.last_error()}")
        return None

    # Convert named tuple to dictionary
    return order[0]._asdict()


def _call_mt5_history(
    mt5_func: Any,
    symbol: str | None,
    group: str | None,
    ticket: int | None,
    position: int | None,
    from_date: datetime | None,
    to_date: datetime | None,
) -> Any:
    """
    Call an MT5 history_*_get function using its actual calling convention.

    The MT5 Python API only accepts the date range positionally and only
    supports `group`, `ticket` and `position` as keyword arguments. Ticket and
    position lookups are standalone: they cannot be combined with a date range
    or a group filter. Anything else fails with error -2 "Invalid parameters".

    Args:
        mt5_func: Either mt5.history_orders_get or mt5.history_deals_get
        symbol: Symbol name, applied as a group filter since MT5 has no symbol filter
        group: Filter for arranging a group of orders/deals
        ticket: Order ticket. For deals, MT5 matches it against the deal's order
            (DEAL_ORDER), not the deal ticket.
        position: Position ticket
        from_date: Start of the date range
        to_date: End of the date range

    Returns:
        The raw MT5 result: a tuple of named tuples, or None on failure.
    """
    if ticket is not None:
        return mt5_func(ticket=ticket)

    if position is not None:
        return mt5_func(position=position)

    # MT5 requires both dates, so fall back to the widest sensible range.
    date_from = from_date if from_date is not None else datetime(1970, 1, 1)
    date_to = to_date if to_date is not None else datetime.now() + timedelta(days=1)

    group_filter = group if group is not None else symbol
    if group_filter is not None:
        return mt5_func(date_from, date_to, group=group_filter)

    return mt5_func(date_from, date_to)


# Get history orders
@mcp.tool()
def history_orders_get(
    symbol: str | None = None,
    group: str | None = None,
    ticket: int | None = None,
    position: int | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> list[HistoryOrder]:
    """
    Get orders from history.

    Args:
        symbol: Symbol name, used as a filter (e.g. "EURUSD"). Ignored when group is given.
        group: Filter for arranging a group of orders (e.g., "*", "USD*")
        ticket: Order ticket. Looked up on its own; other filters are ignored.
        position: Position ticket. Looked up on its own; other filters are ignored.
        from_date: Start date for order retrieval. Defaults to the epoch.
        to_date: End date for order retrieval. Defaults to tomorrow.

    Returns:
        List[HistoryOrder]: List of historical orders.
    """
    orders = _call_mt5_history(
        mt5.history_orders_get, symbol, group, ticket, position, from_date, to_date
    )

    if orders is None:
        logger.error(f"Failed to get history orders, error code: {mt5.last_error()}")
        return []

    result = []
    for order in orders:
        # Convert named tuple to dictionary
        order_dict = order._asdict()
        result.append(HistoryOrder(**order_dict))

    return result


# Get history deals
@mcp.tool()
def history_deals_get(
    symbol: str | None = None,
    group: str | None = None,
    ticket: int | None = None,
    position: int | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> list[Deal]:
    """
    Get deals from history.

    Args:
        symbol: Symbol name, used as a filter (e.g. "EURUSD"). Ignored when group is given.
        group: Filter for arranging a group of deals (e.g., "*", "USD*")
        ticket: Order ticket - returns the deals generated by that order (DEAL_ORDER),
            not a deal ticket. Looked up on its own; other filters are ignored.
        position: Position ticket. Looked up on its own; other filters are ignored.
        from_date: Start date for deal retrieval. Defaults to the epoch.
        to_date: End date for deal retrieval. Defaults to tomorrow.

    Returns:
        List[Deal]: List of historical deals.
    """
    deals = _call_mt5_history(
        mt5.history_deals_get, symbol, group, ticket, position, from_date, to_date
    )

    if deals is None:
        logger.error(f"Failed to get history deals, error code: {mt5.last_error()}")
        return []

    result = []
    for deal in deals:
        # Convert named tuple to dictionary
        deal_dict = deal._asdict()
        result.append(Deal(**deal_dict))

    return result


# Resource for order types
@mcp.resource("mt5://order_types")
def get_order_types() -> str:
    """
    Get information about order types in MetaTrader 5.

    Returns:
        str: Information about order types.
    """
    order_types = {
        "ORDER_TYPE_BUY": mt5.ORDER_TYPE_BUY,
        "ORDER_TYPE_SELL": mt5.ORDER_TYPE_SELL,
        "ORDER_TYPE_BUY_LIMIT": mt5.ORDER_TYPE_BUY_LIMIT,
        "ORDER_TYPE_SELL_LIMIT": mt5.ORDER_TYPE_SELL_LIMIT,
        "ORDER_TYPE_BUY_STOP": mt5.ORDER_TYPE_BUY_STOP,
        "ORDER_TYPE_SELL_STOP": mt5.ORDER_TYPE_SELL_STOP,
        "ORDER_TYPE_BUY_STOP_LIMIT": mt5.ORDER_TYPE_BUY_STOP_LIMIT,
        "ORDER_TYPE_SELL_STOP_LIMIT": mt5.ORDER_TYPE_SELL_STOP_LIMIT,
        "ORDER_TYPE_CLOSE_BY": mt5.ORDER_TYPE_CLOSE_BY,
    }

    result = "Available order types in MetaTrader 5:\n\n"
    for name, value in order_types.items():
        result += f"{name}: {value}\n"

    return result


# Resource for order filling types
@mcp.resource("mt5://order_filling_types")
def get_order_filling_types() -> str:
    """
    Get information about order filling types in MetaTrader 5.

    Returns:
        str: Information about order filling types.
    """
    filling_types = {
        "ORDER_FILLING_FOK": mt5.ORDER_FILLING_FOK,
        "ORDER_FILLING_IOC": mt5.ORDER_FILLING_IOC,
        "ORDER_FILLING_RETURN": mt5.ORDER_FILLING_RETURN,
    }

    result = "Available order filling types in MetaTrader 5:\n\n"
    for name, value in filling_types.items():
        result += f"{name}: {value}\n"

    return result


# Resource for order time types
@mcp.resource("mt5://order_time_types")
def get_order_time_types() -> str:
    """
    Get information about order time types in MetaTrader 5.

    Returns:
        str: Information about order time types.
    """
    time_types = {
        "ORDER_TIME_GTC": mt5.ORDER_TIME_GTC,
        "ORDER_TIME_DAY": mt5.ORDER_TIME_DAY,
        "ORDER_TIME_SPECIFIED": mt5.ORDER_TIME_SPECIFIED,
        "ORDER_TIME_SPECIFIED_DAY": mt5.ORDER_TIME_SPECIFIED_DAY,
    }

    result = "Available order time types in MetaTrader 5:\n\n"
    for name, value in time_types.items():
        result += f"{name}: {value}\n"

    return result


# Resource for trade request actions
@mcp.resource("mt5://trade_actions")
def get_trade_actions() -> str:
    """
    Get information about trade request actions in MetaTrader 5.

    Returns:
        str: Information about trade request actions.
    """
    actions = {
        "TRADE_ACTION_DEAL": mt5.TRADE_ACTION_DEAL,
        "TRADE_ACTION_PENDING": mt5.TRADE_ACTION_PENDING,
        "TRADE_ACTION_SLTP": mt5.TRADE_ACTION_SLTP,
        "TRADE_ACTION_MODIFY": mt5.TRADE_ACTION_MODIFY,
        "TRADE_ACTION_REMOVE": mt5.TRADE_ACTION_REMOVE,
        "TRADE_ACTION_CLOSE_BY": mt5.TRADE_ACTION_CLOSE_BY,
    }

    result = "Available trade request actions in MetaTrader 5:\n\n"
    for name, value in actions.items():
        result += f"{name}: {value}\n"

    return result




# ──────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS FOR STRATEGY TESTING (patched)
# ──────────────────────────────────────────────────────────────────────────────

"""Helper functions for MT5 strategy testing - spliced into main.py via patch script."""
import os, re, subprocess, time, uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
import logging

logger = logging.getLogger(__name__)

# MT5 period enum values (numeric)
# MT5 period enum values (numeric constants according to MT5 ENUM_TIMEFRAMES)
_PERIOD_ENUM = {
    # Minutes
    "M1": 1, "M2": 2, "M3": 3, "M4": 4, "M5": 5, "M6": 6,
    "M10": 10, "M12": 12, "M15": 15, "M20": 20, "M30": 30,
    # Hours
    "H1": 16385, "H2": 16386, "H3": 16387, "H4": 16388, "H6": 16390,
    "H8": 16392, "H12": 16396,
    # Days
    "D1": 16408, "D2": 16409, "D3": 16410, "D4": 16411, "D5": 16412,
    "D6": 16413, "D7": 16414,
    # Weeks
    "W1": 32769, "W2": 32770, "W3": 32771, "W4": 32772, "W5": 32773, "W6": 32774,
    # Months
    "MN1": 49153,
}


def _normalize_period_str(period_str: str) -> str:
    """Normalizes timeframe aliases (e.g. '15m', '1h', 'M15', '4h', '1d') to canonical MT5 period strings."""
    if not period_str:
        return "H1"
    s = period_str.strip().upper()
    alias_map = {
        "1M": "M1", "2M": "M2", "3M": "M3", "4M": "M4", "5M": "M5", "6M": "M6",
        "10M": "M10", "12M": "M12", "15M": "M15", "20M": "M20", "30M": "M30",
        "1H": "H1", "2H": "H2", "3H": "H3", "4H": "H4", "6H": "H6", "8H": "H8", "12H": "H12",
        "1D": "D1", "D": "D1", "DAILY": "D1",
        "1W": "W1", "W": "W1", "WEEKLY": "W1",
        "1MN": "MN1", "MN": "MN1", "MONTHLY": "MN1", "1MO": "MN1",
    }
    if s in alias_map:
        return alias_map[s]
    # Check if format is digit + unit (e.g. 15M -> M15)
    m = re.match(r"^(\d+)([MHDW])$", s)
    if m:
        val, unit = m.group(1), m.group(2)
        cand = f"{unit}{val}"
        if cand in _PERIOD_ENUM:
            return cand
    return s


def _period_to_mt5_enum(period_str: str) -> int:
    """Convert a period string like 'H1' or '15m' to MT5 numeric enum."""
    p = _normalize_period_str(period_str)
    if p in _PERIOD_ENUM:
        return _PERIOD_ENUM[p]
    try:
        return int(period_str)
    except ValueError:
        pass
    raise ValueError(f"Unknown period: {period_str}. Supported periods: {', '.join(sorted(_PERIOD_ENUM.keys()))}")


_active_tester_proc: Optional[subprocess.Popen] = None


def _terminate_proc_tree(proc: Optional[subprocess.Popen] = None, pid: Optional[int] = None) -> None:
    """
    Safely terminates a specific MT5 tester process and its child processes
    (e.g., metatester64.exe) by PID without affecting any other terminals.
    """
    target_pid = pid or (proc.pid if proc else None)
    if not target_pid:
        return
    try:
        # /T terminates process and all child processes, /F forces termination
        subprocess.run(["taskkill", "/PID", str(target_pid), "/T", "/F"],
                       capture_output=True, timeout=10)
    except Exception as exc:
        logger.warning(f"Error terminating process tree for PID {target_pid}: {exc}")
        if proc:
            try:
                proc.kill()
            except Exception:
                pass


def _kill_mt5_processes(target_proc: Optional[subprocess.Popen] = None) -> None:
    """
    Safely terminates MT5 tester processes.
    - If target_proc is provided, terminates only that process tree.
    - If target_proc is None, cleans up any previously tracked tester process.
    - Only falls back to terminating headless metatester64.exe workers,
      NEVER killing the user's interactive terminal64.exe GUI.
    """
    global _active_tester_proc
    if target_proc:
        _terminate_proc_tree(target_proc)
        if _active_tester_proc == target_proc:
            _active_tester_proc = None
        return

    if _active_tester_proc and _active_tester_proc.poll() is None:
        _terminate_proc_tree(_active_tester_proc)
        _active_tester_proc = None
        return

    # Fallback cleanup: terminate headless background tester agents only, NOT main GUI terminals
    try:
        subprocess.run(["taskkill", "/IM", "metatester64.exe", "/F"],
                       capture_output=True, timeout=10)
    except Exception:
        pass
    time.sleep(0.5)


def _clean_tester_logs(log_dir):
    """Remove old Tester log files so we can detect fresh entries."""
    p = Path(log_dir)
    search_dirs = [p]
    if p.parent.exists():
        search_dirs.append(p.parent)
    for d in search_dirs:
        if d.exists():
            for f in d.rglob("*.log"):
                try:
                    f.unlink()
                except Exception:
                    pass


def _read_log_file(path: str) -> str:
    """Read a log file safely handling UTF-16-LE (with or without BOM), UTF-8, and CP1252."""
    if not path or not os.path.exists(path):
        return ""
    try:
        with open(path, "rb") as f:
            raw = f.read()
        if not raw:
            return ""
        if raw[:2] == b"\xff\xfe":
            return raw[2:].decode("utf-16-le", errors="replace")
        if len(raw) > 2 and b"\x00" in raw[:100]:
            return raw.decode("utf-16-le", errors="replace")
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("cp1252", errors="replace")
    except Exception as e:
        logger.warning(f"Error reading log file {path}: {e}")
        return ""


def _read_utf16_log(path: str) -> str:
    """Backward-compatible alias for reading MT5 log files."""
    return _read_log_file(path)


def _find_latest_tester_log(log_dir):
    """Find the most recent Tester log file across Tester and Agent directories."""
    candidates = []
    p = Path(log_dir)
    search_dirs = [p]
    if p.parent.exists():
        search_dirs.append(p.parent)
    for d in search_dirs:
        if d.exists():
            candidates.extend(d.rglob("*.log"))
    if not candidates:
        return None
    candidates.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return str(candidates[0])


def _check_tester_log(log_dir):
    """Check Tester log for test completion."""
    result = {"test_done": False, "done_time": None, "log_text": ""}
    log_file = _find_latest_tester_log(log_dir)
    if not log_file:
        return result
    try:
        content = _read_utf16_log(log_file)
        result["log_text"] = content[-3000:]
        for line in content.split('\n'):
            line = line.strip().lower()
            if 'test passed' in line or 'test completed' in line or 'shutdown finished' in line or 'metatester 5 stopped' in line:
                result["test_done"] = True
                result["done_time"] = time.time()
    except Exception as e:
        logger.warning(f"Error reading Tester log: {e}")
    return result


def _parse_tester_log(content):
    """Parse Tester log content for key metrics."""
    metrics = {}
    deals = 0
    for line in content.split('\n'):
        line = line.strip()
        # Deal count: count "deal #N" lines (not "deal performed")
        if re.match(r'^.*\s+deal\s+#?\d+', line, re.IGNORECASE):
            if 'buy' in line.lower() or 'sell' in line.lower():
                deals += 1
        if 'Test passed' in line or 'Test completed' in line:
            m = re.search(r'(\d+:\d+:\d+)', line)
            if m:
                metrics["test_duration"] = m.group(1)
        if 'final balance' in line.lower():
            m = re.search(r'final\s+balance\s+([\d.,]+)', line, re.IGNORECASE)
            if m:
                metrics["final_balance"] = m.group(1)
        if 'bars in test' in line.lower():
            m = re.search(r'(\d+)', line)
            if m:
                metrics["bars_in_test"] = int(m.group(1))
        if 'bars modelled' in line.lower():
            m = re.search(r'(\d+)', line)
            if m:
                metrics["bars_modelled"] = int(m.group(1))
        # Only match date ranges that look like "from YYYY.MM.DD ... to YYYY.MM.DD"
        if 'testing of' in line.lower() and 'from' in line.lower() and 'to' in line.lower():
            dm = re.search(r'from\s+(\d{4}\.\d{2}\.\d{2})\s+.*?to\s+(\d{4}\.\d{2}\.\d{2})', line, re.IGNORECASE)
            if dm:
                metrics["date_range"] = f"{dm.group(1)} to {dm.group(2)}"
    metrics["total_deals"] = deals
    return metrics


def _modify_terminal_ini(ini_path, changes):
    """Safely modify terminal.ini (UTF-16-LE with BOM).

    Only modifies values within the [Tester] section.
    Preserves the file's UTF-16-LE encoding and BOM.
    """
    if not os.path.exists(ini_path):
        logger.warning(f"terminal.ini not found at {ini_path}")
        return {}

    with open(ini_path, 'rb') as f:
        raw = f.read()

    has_bom = raw[:2] == b'\xff\xfe'
    if has_bom:
        text = raw[2:].decode('utf-16-le', errors='replace')
    else:
        text = raw.decode('utf-16-le', errors='replace')

    lines = text.split('\r\n')
    modified = []
    in_tester = False
    changes_made = {}

    for line in lines:
        stripped = line.replace('\x00', '').strip()

        if stripped == '[Tester]':
            in_tester = True
            modified.append(line)
            continue
        if stripped.startswith('[') and stripped != '[Tester]':
            if in_tester:
                for key, new_val in changes.items():
                    if key not in changes_made:
                        modified.append(f"{key}={new_val}")
                        changes_made[key] = True
            in_tester = False

        if in_tester:
            matched = False
            for key, new_val in changes.items():
                eq_idx = line.find('=')
                if eq_idx > 0 and line[:eq_idx].replace('\x00', '').strip() == key:
                    new_line = line[:eq_idx+1] + new_val
                    modified.append(new_line)
                    changes_made[key] = True
                    matched = True
                    break
            if not matched:
                modified.append(line)
        else:
            modified.append(line)

    if in_tester:
        for key, new_val in changes.items():
            if key not in changes_made:
                modified.append(f"{key}={new_val}")
                changes_made[key] = True

    new_text = '\r\n'.join(modified)

    if has_bom:
        new_raw = b'\xff\xfe' + new_text.encode('utf-16-le')
    else:
        new_raw = new_text.encode('utf-16-le')

    with open(ini_path, 'wb') as f:
        f.write(new_raw)

    return changes_made
# ──────────────────────────────────────────────────────────────────────────────
# MQL5 COMPILATION & STRATEGY TESTING TOOLS
# ──────────────────────────────────────────────────────────────────────────────


def _resolve_path_setting(env_var: str, default: str) -> str:
    raw = os.getenv(env_var, default)
    if not raw:
        return ""
    clean = raw.strip().strip('"').strip("'")
    p = Path(clean)
    if p.is_absolute():
        return str(p)
    ws_root = _find_project_root()
    candidate_ws = ws_root / clean
    if candidate_ws.exists():
        return str(candidate_ws.resolve())
    repo_root = Path(__file__).resolve().parent.parent.parent
    candidate_repo = repo_root / clean
    if candidate_repo.exists():
        return str(candidate_repo.resolve())
    return str(candidate_ws.resolve())


def _get_mt5_paths() -> dict[str, str]:
    """Read MT5 paths from environment / .env, supporting relative and absolute paths."""
    return {
        "terminal": _resolve_path_setting(
            "MT5_PATH",
            r"mt5_workers/worker_1/terminal64.exe",
        ),
        "metaeditor": _resolve_path_setting(
            "MT5_METAEDITOR_PATH",
            r"mt5_workers/worker_1/MetaEditor64.exe",
        ),
        "data_folder": _resolve_path_setting(
            "MT5_DATA_FOLDER",
            r"mt5_workers/worker_1",
        ),
        "config_folder": _resolve_path_setting(
            "MT5_CONFIG_FOLDER",
            r"mt5_workers/worker_1/Config",
        ),
        "tester_log": _resolve_path_setting(
            "MT5_TESTER_LOG",
            r"mt5_workers/worker_1/Tester/logs",
        ),
        "terminal_ini": _resolve_path_setting(
            "MT5_TERMINAL_INI",
            r"mt5_workers/worker_1/Config/terminal.ini",
        ),
        "common_ini": _resolve_path_setting(
            "MT5_COMMON_INI",
            r"mt5_workers/worker_1/Config/common.ini",
        ),
    }



def _deploy_ea_binary(ex5_src: str) -> list[str]:
    """
    Copies a compiled .ex5 file to mt5_workers/shared_experts and all worker terminal
    MQL5/Experts directories so the MT5 Strategy Tester can resolve it without sandbox issues.
    """
    deployed: list[str] = []
    if not ex5_src or not os.path.exists(ex5_src):
        return deployed

    ws_root = _find_project_root()
    ea_name = os.path.basename(ex5_src)
    workers_dir = ws_root / "mt5_workers"

    targets: list[Path] = []
    # 1. Target shared_experts
    shared_experts = workers_dir / "shared_experts"
    if shared_experts.exists() or workers_dir.exists():
        targets.append(shared_experts / ea_name)

    # 2. Target all worker directories under mt5_workers
    if workers_dir.exists():
        for worker_folder in sorted(workers_dir.glob("worker_*")):
            if worker_folder.is_dir():
                experts_dir = worker_folder / "MQL5" / "Experts"
                targets.append(experts_dir / ea_name)

    # Deduplicate targets by canonical resolved real path
    seen_canonical_paths: set[str] = set()
    src_canonical = str(Path(ex5_src).resolve())

    for dest in targets:
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            canonical_dest = str(dest.resolve())
            if canonical_dest in seen_canonical_paths:
                continue
            seen_canonical_paths.add(canonical_dest)

            # Avoid copying file onto itself
            if canonical_dest == src_canonical:
                deployed.append(str(dest))
                continue

            shutil.copy2(ex5_src, dest)
            deployed.append(str(dest))
        except Exception as exc:
            logger.warning(f"Failed to copy {ea_name} to {dest}: {exc}")

    return deployed


@mcp.tool()
def compile_mql5(filepath: str, metaeditor_path: str | None = None) -> dict[str, Any]:
    """
    Compile an MQL5 source file (.mq5, .mqh, .mqi) into a binary module (.ex5)
    using MetaEditor's command-line interface — no GUI launch required.

    This is the MCP-server equivalent of pressing F7 in MetaEditor.  The output
    .ex5 is written to the **same directory** as the source file (that is where
    MetaEditor places it).  If the file has dependencies (#import, #include),
    MetaEditor resolves them via its standard include path and the project's
    MQL5 folder.

    Args:
        filepath: Absolute path to the .mq5 source file.
                  e.g. "C:\\Users\\...\\MQL5\\Experts\\MyEA.mq5"
        metaeditor_path: (optional) override path to MetaEditor64.exe.
                         Falls back to MT5_METAEDITOR_PATH env var.

    Returns:
        Dict with:
          - success (bool): True if compilation produced no errors
          - returncode (int): MetaEditor exit code (0 = success)
          - log (str): compilation log text (if a .log file was generated)
          - log_path (str): path to the .log file
          - ex5_path (str): expected path of the compiled .ex5
          - deployed_to (list[str]): target worker paths the .ex5 was synced to
    """
    paths = _get_mt5_paths()
    if metaeditor_path:
        me_obj = Path(metaeditor_path.strip().strip('"').strip("'"))
        if not me_obj.is_absolute():
            ws_root = _find_project_root()
            cand = ws_root / me_obj
            me = str(cand.resolve()) if cand.exists() else str(me_obj.resolve())
        else:
            me = str(me_obj)
    else:
        me = paths["metaeditor"]

    fp_obj = Path(filepath.strip().strip('"').strip("'"))
    ws_root = _find_project_root()
    resolved_path: Optional[Path] = None

    # 1. If absolute path already exists on disk
    if fp_obj.is_absolute() and fp_obj.exists():
        resolved_path = fp_obj
    else:
        # 2. Check direct path under ws_root
        cand = ws_root / fp_obj
        if cand.exists():
            resolved_path = cand
        # 3. Check shared_experts
        elif (ws_root / "mt5_workers" / "shared_experts" / fp_obj.name).exists():
            resolved_path = ws_root / "mt5_workers" / "shared_experts" / fp_obj.name
        # 4. Search data/users recursively for the filename (e.g. data/users/senior/<file>)
        elif (ws_root / "data" / "users").exists():
            for match in (ws_root / "data" / "users").rglob(fp_obj.name):
                if match.is_file():
                    resolved_path = match
                    break
        # 5. Search workspace broadly for the filename (excluding noisy dirs)
        if resolved_path is None:
            for match in ws_root.rglob(fp_obj.name):
                if not any(part in (".git", ".venv", "node_modules", "Tester", ".next") for part in match.parts) and match.is_file():
                    resolved_path = match
                    break

    if resolved_path and resolved_path.exists():
        filepath = str(resolved_path.resolve())
    else:
        filepath = str(fp_obj.resolve()) if not fp_obj.is_absolute() else str(fp_obj)

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"MQL5 source file not found: {filepath}")

    if not os.path.exists(me):
        raise FileNotFoundError(f"MetaEditor not found at: {me}")

    # MetaEditor CLI: /compile:<file> /log:<logfile>
    # The /log flag tells MetaEditor to write a compile log.
    log_path = filepath.rsplit(".", 1)[0] + ".log"
    # Remove old log so we can detect if a new one was created
    if os.path.exists(log_path):
        os.remove(log_path)

    cmd = [me, f"/compile:{filepath}", f"/log:{log_path}"]
    logger.info(f"Compiling: {cmd}")

    # MetaEditor /compile spawns a GUI window briefly. Use Popen with a new
    # console so the MCP stdio loop never blocks. We poll for the .ex5 output
    # instead of waiting forever for MetaEditor's (possibly-zombie) GUI proc.
    DETACHED = 0x00000010  # CREATE_NEW_CONSOLE
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, creationflags=DETACHED,
        )
        proc.wait(timeout=20)  # give MetaEditor 20s to compile+exit cleanly
    except subprocess.TimeoutExpired:
        # MetaEditor may still be running (GUI hang), but the .ex5 may exist.
        logger.warning("MetaEditor compile did not exit in 20s; checking for .ex5 output…")
        try:
            proc.kill()
        except Exception:
            pass
    except Exception as e:
        logger.error(f"MetaEditor spawn failed: {e}")
        return {"success": False, "returncode": -1, "log": str(e), "log_path": log_path, "ex5_path": ex5_path}

    log_content = _read_log_file(log_path)

    ex5_path = filepath.rsplit(".", 1)[0] + ".ex5"
    ex5_exists = os.path.exists(ex5_path)

    deployed_to: list[str] = []
    if ex5_exists:
        deployed_to = _deploy_ea_binary(ex5_path)
        logger.info(f"Auto-deployed compiled EA '{ex5_path}' to {len(deployed_to)} worker locations.")

    # Check log for errors
    has_errors = "error" in log_content.lower() if log_content else False
    rc = proc.returncode if proc else -1

    return {
        "success": ex5_exists,
              # ^ ex5_exists is authoritative: MetaEditor returns 143 (SIGTERM)
              #   when the GUI process is killed after compiling; the .ex5 on
              #   disk proves the compile succeeded regardless of returncode.
        "returncode": rc,
        "log": log_content[:8000],  # truncate to keep MCP response manageable
        "log_path": log_path,
        "ex5_path": ex5_path,
        "ex5_exists": ex5_exists,
        "deployed_to": deployed_to,
        "stderr": "",
    }


@mcp.tool()
def run_strategy_tester(
    ea_name: str,
    symbol: str,
    period: str = "H1",
    model: int = 0,
    deposit: float = 10000.0,
    currency: str = "USD",
    leverage: int = 100,
    from_date: str | None = None,
    to_date: str | None = None,
    report_path: str | None = None,
    timeout: int = 600,
) -> dict[str, Any]:
    """
    Run the MetaTrader 5 Strategy Tester.

    CRITICAL WORKFLOW (learned through testing):
    1. MT5 ignores TestDateMode/TestFromDate/TestToDate in the config .ini.
       Date ranges MUST be set by editing terminal.ini's [Tester] section
       using Unix timestamps (DateFrom / DateTo).
    2. The config file MUST NOT contain a [Common] section.
    3. Model=0 (every tick) is the only model that produces a report.
       Model=3 silently triggers math mode with no data.
    4. Expert must NOT have the Experts\\ prefix (MT5 adds it automatically).
    5. After the test completes the terminal needs ~3-5s to flush the report.

    Args:
        ea_name: EA filename WITHOUT "Experts\\" prefix.
                 e.g. "Moving Average.ex5" or "Advisors\\MyEA.ex5"
        symbol: Trading symbol, e.g. "EURUSD", "XAUUSD"
        period: Timeframe: "M1", "M5", "H1", "D1", "W1", "MN1"
        model: 0=every tick (recommended), 2=control points. AVOID 3 (math mode).
        deposit: Initial deposit
        currency: Account currency
        leverage: e.g. 100 for 1:100
        from_date: "YYYY.MM.DD" start date (optional)
        to_date: "YYYY.MM.DD" end date (optional)
        report_path: Where to save HTML report. Auto-generated if None.
        timeout: Seconds to wait (default 600)

    Returns:
        Dict with success, metrics, config_file, report_path, tester_log.
    """
    paths = _get_mt5_paths()
    terminal_path = paths["terminal"]
    config_folder = paths["config_folder"]
    data_folder = paths["data_folder"]
    tester_log_dir = paths["tester_log"]
    terminal_ini = paths["terminal_ini"]

    if not os.path.exists(terminal_path):
        raise FileNotFoundError(f"MT5 terminal not found at: {terminal_path}")

    os.makedirs(config_folder, exist_ok=True)

    # Normalize EA name and guarantee it is deployed to worker terminal MQL5/Experts
    clean_ea = ea_name.strip().strip('"').strip("'")
    if clean_ea.lower().startswith("experts\\") or clean_ea.lower().startswith("experts/"):
        clean_ea = clean_ea[8:]
    if clean_ea.lower().endswith(".mq5"):
        clean_ea = clean_ea[:-4] + ".ex5"
    elif not clean_ea.lower().endswith(".ex5"):
        clean_ea = clean_ea + ".ex5"

    ea_basename = os.path.basename(clean_ea)
    target_expert_path = Path(data_folder) / "MQL5" / "Experts" / ea_basename

    if not target_expert_path.exists():
        found_src = None
        # 1. Direct path check
        cand_direct = Path(ea_name.strip().strip('"').strip("'"))
        if cand_direct.suffix.lower() == ".mq5":
            cand_direct = cand_direct.with_suffix(".ex5")
        if cand_direct.exists():
            found_src = str(cand_direct.resolve())

        ws_root = _find_project_root()
        # 2. Project root check
        if not found_src:
            cand_ws = ws_root / clean_ea
            if cand_ws.exists():
                found_src = str(cand_ws.resolve())

        # 3. Check shared_experts
        if not found_src:
            cand_shared = ws_root / "mt5_workers" / "shared_experts" / ea_basename
            if cand_shared.exists():
                found_src = str(cand_shared.resolve())

        # 4. Search recursively in data/users
        if not found_src:
            data_users = ws_root / "data" / "users"
            if data_users.exists():
                for match in data_users.rglob(ea_basename):
                    if match.is_file():
                        found_src = str(match.resolve())
                        break

        # 5. Search workspace broadly
        if not found_src:
            for match in ws_root.rglob(ea_basename):
                if "Tester" not in match.parts and ".git" not in match.parts and match.is_file():
                    found_src = str(match.resolve())
                    break

        if found_src and os.path.exists(found_src):
            _deploy_ea_binary(found_src)
            logger.info(f"Auto-deployed EA binary '{ea_basename}' from '{found_src}' to worker Experts.")

    # Determine relative EA name for the MT5 tester configuration
    expert_ini_val = ea_basename
    if "/" in clean_ea or "\\" in clean_ea:
        subfolder_expert = Path(data_folder) / "MQL5" / "Experts" / clean_ea
        if subfolder_expert.exists():
            expert_ini_val = clean_ea.replace("/", "\\")

    # Build the INI config file (simple [Tester] section, NO [Common])
    period_canonical = _normalize_period_str(period)
    period_num = _period_to_mt5_enum(period_canonical)
    config_lines = [
        "[Tester]",
        f"Expert={expert_ini_val}",
        f"Symbol={symbol}",
        f"Period={period_canonical}",
        f"Model={model}",
        f"Deposit={deposit}",
        f"Currency={currency}",
        f"Leverage={leverage}",
        f"Optimization=0",
        "ExecutionMode=0",
        "ShutdownTerminal=1",
        "ReplaceReport=1",
    ]

    if report_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_rel = f"MQL5\\Files\\report_{ts}.htm"
        report_path = str(Path(data_folder) / report_rel)
    else:
        try:
            report_rel = str(Path(report_path).relative_to(data_folder))
        except ValueError:
            report_rel = os.path.basename(report_path)
        if not (report_rel.lower().endswith(".htm") or report_rel.lower().endswith(".xml")):
            report_rel = report_rel[:-1] if report_rel.lower().endswith(".html") else str(Path(report_rel).with_suffix(".htm"))
            report_path = report_path[:-1] if report_path.lower().endswith(".html") else str(Path(report_path).with_suffix(".htm"))

    Path(report_path).parent.mkdir(parents=True, exist_ok=True)
    config_lines.append(f"Report={report_rel}")
    config_content = "\n".join(config_lines) + "\n"

    config_file = os.path.join(config_folder, "tester_config_mcp.ini")
    with open(config_file, "w") as f:
        f.write(config_content)

    logger.info(f"Config written to: {config_file}")
    logger.info(f"Report target: {report_path}")

    # Modify terminal.ini for date range (CRITICAL - config date params are ignored)
    date_changes = {}
    if from_date:
        try:
            dt = datetime.strptime(from_date, "%Y.%m.%d")
            import calendar
            date_changes["DateFrom"] = str(calendar.timegm(dt.timetuple()))
        except ValueError:
            logger.warning(f"Could not parse from_date '{from_date}'")
    if to_date:
        try:
            dt = datetime.strptime(to_date, "%Y.%m.%d")
            import calendar
            date_changes["DateTo"] = str(calendar.timegm(dt.timetuple()))
        except ValueError:
            logger.warning(f"Could not parse to_date '{to_date}'")
    if date_changes:
        # DateRange=3 enforces custom interval in MT5 Strategy Tester (prevents defaulting to Last year)
        date_changes["DateRange"] = "3"
        changes = _modify_terminal_ini(terminal_ini, date_changes)
        logger.info(f"terminal.ini modifications: {changes}")

    # Kill any running MT5 processes
    _kill_mt5_processes()

    # Clean old Tester logs
    _clean_tester_logs(tester_log_dir)

    # Start terminal with config in portable mode
    cmd = [terminal_path, "/portable", f"/config:{config_file}"]
    logger.info(f"Launching: {cmd}")
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    global _active_tester_proc
    _active_tester_proc = proc

    # Wait for report or timeout
    report_exists = False
    test_completed = False
    elapsed = 0
    poll_interval = 2
    max_wait = timeout

    while elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval

        # Check for HTML report
        if os.path.exists(report_path) and os.path.getsize(report_path) > 1000:
            report_exists = True
            test_completed = True
            break

        # Check if terminal process has exited (due to ShutdownTerminal=1)
        if proc.poll() is not None:
            test_completed = True
            time.sleep(3)
            if os.path.exists(report_path):
                report_exists = True
            break

        # Check Tester log for completion
        log_result = _check_tester_log(tester_log_dir)
        if log_result["test_done"]:
            test_completed = True
            # Wait for report to flush
            time.sleep(5)
            if os.path.exists(report_path):
                report_exists = True
                break
            time.sleep(5)
            if os.path.exists(report_path):
                report_exists = True
            break

    # Terminate the launched tester process tree
    _kill_mt5_processes(proc)

    # Parse results from report or Tester log
    metrics = {}
    deals = []
    deals_count = 0
    tester_log_content = ""

    if report_exists:
        try:
            rep_data = read_test_report(report_path)
            metrics = rep_data.get("metrics", {})
            deals = rep_data.get("deals", [])
            deals_count = rep_data.get("deals_count", len(deals))
        except Exception as e:
            logger.warning(f"Error reading report {report_path}: {e}")

    log_file = _find_latest_tester_log(tester_log_dir)
    if log_file:
        tester_log_content = _read_utf16_log(log_file)
        log_metrics = _parse_tester_log(tester_log_content)
        for k, v in log_metrics.items():
            if k not in metrics or not metrics[k]:
                metrics[k] = v

    if not test_completed and tester_log_content:
        for line in tester_log_content.split('\n'):
            line_lower = line.strip().lower()
            if any(term in line_lower for term in ['test passed', 'test completed', 'shutdown finished', 'metatester 5 stopped']):
                test_completed = True
                break

    return {
        "success": test_completed or report_exists,
        "config_file": config_file,
        "report_path": report_path,
        "report_exists": report_exists,
        "test_completed": test_completed,
        "tester_log": tester_log_content[:5000] if tester_log_content else "",
        "metrics": metrics,
        "deals_count": deals_count,
        "deals": deals,
        "elapsed_seconds": elapsed,
    }



@mcp.tool()
def read_test_report(report_path: str) -> dict[str, Any]:
    """
    Read and parse a MetaTrader 5 Strategy Tester report.

    Prefers the HTML (.htm / .html) report if it exists; falls back to parsing the
    Tester log (UTF-16-LE) for key metrics when no HTML is available.

    Args:
        report_path: Path to the .htm/.html report or Tester .log file.

    Returns:
        Dict with success, metrics, deals list, and summary.
    """
    import re

    if not os.path.exists(report_path):
        raise FileNotFoundError(f"Report file not found: {report_path}")

    # If it's an HTML / HTM report
    if report_path.lower().endswith((".htm", ".html")):
        with open(report_path, "rb") as f:
            raw = f.read()

        # Auto-detect encoding (MT5 exports UTF-16 LE)
        if raw.startswith(b"\xff\xfe") or b"\x00" in raw[:200]:
            html = raw.decode("utf-16", errors="replace")
        else:
            html = raw.decode("utf-8", errors="replace")

        metrics: dict[str, str] = {}

        # Extract all label: bold value pairs
        pairs = re.findall(
            r"<td[^>]*>([^<:]+):?\s*</td>\s*<td[^>]*><b>(.*?)</b></td>",
            html,
        )
        for k, v in pairs:
            cleaned_k = k.strip()
            cleaned_v = re.sub(r"<[^>]+>", "", v).strip()
            if cleaned_k and cleaned_v:
                metrics[cleaned_k] = cleaned_v

        def _to_float(val: Any) -> float:
            try:
                s = str(val or "").replace(" ", "").replace("\xa0", "").strip()
                return float(s) if s else 0.0
            except Exception:
                return 0.0

        # Extract Orders table (carries initial S/L and initial T/P)
        orders: list[dict[str, Any]] = []
        orders_by_ticket: dict[str, dict[str, Any]] = {}
        orders_match = re.search(
            r"<b>Orders</b></div></th>\s*</tr>\s*<tr[^>]*>.*?</tr>(.*?)(?:<b>Deals</b>|</table>)",
            html,
            re.DOTALL | re.IGNORECASE,
        )
        if orders_match:
            o_rows = re.findall(r"<tr[^>]*>(.*?)</tr>", orders_match.group(1), re.DOTALL)
            for r in o_rows:
                cols = [
                    re.sub(r"<[^>]+>", "", c).strip()
                    for c in re.findall(r"<td[^>]*>(.*?)</td>", r, re.DOTALL)
                ]
                if len(cols) >= 8:
                    ticket = cols[1]
                    sl_val = _to_float(cols[6]) if len(cols) > 6 else 0.0
                    tp_val = _to_float(cols[7]) if len(cols) > 7 else 0.0
                    order_obj = {
                        "open_time": cols[0],
                        "order": ticket,
                        "symbol": cols[2] if len(cols) > 2 else "",
                        "type": cols[3] if len(cols) > 3 else "",
                        "volume": cols[4] if len(cols) > 4 else "",
                        "price": _to_float(cols[5]) if len(cols) > 5 else 0.0,
                        "initial_sl": sl_val,
                        "initial_tp": tp_val,
                        "stop_loss": sl_val,
                        "take_profit": tp_val,
                        "close_time": cols[8] if len(cols) > 8 else "",
                        "state": cols[9] if len(cols) > 9 else "",
                        "comment": cols[10] if len(cols) > 10 else "",
                    }
                    orders.append(order_obj)
                    if ticket:
                        orders_by_ticket[ticket] = order_obj

        # Extract Deals table (carries execution price, commissions, profit, and balance)
        deals: list[dict[str, Any]] = []
        deals_match = re.search(
            r"<b>Deals</b></div></th>\s*</tr>\s*<tr[^>]*>.*?</tr>(.*?)</table>",
            html,
            re.DOTALL | re.IGNORECASE,
        )
        if deals_match:
            rows = re.findall(r"<tr[^>]*>(.*?)</tr>", deals_match.group(1), re.DOTALL)
            last_in_order_meta: dict[str, Any] = {}
            for r in rows:
                cols = [
                    re.sub(r"<[^>]+>", "", c).strip()
                    for c in re.findall(r"<td[^>]*>(.*?)</td>", r, re.DOTALL)
                ]
                if len(cols) >= 12:
                    order_ticket = cols[7]
                    order_meta = orders_by_ticket.get(order_ticket, {})
                    direction_str = cols[4].lower().strip()
                    comment_str = cols[12] if len(cols) > 12 else ""
                    deal_price = _to_float(cols[6])
                    profit_val = _to_float(cols[10])

                    if direction_str == "in":
                        last_in_order_meta = order_meta

                    init_sl = order_meta.get("initial_sl", 0.0) or last_in_order_meta.get("initial_sl", 0.0)
                    init_tp = order_meta.get("initial_tp", 0.0) or last_in_order_meta.get("initial_tp", 0.0)

                    # Fallback to comment regex for SL/TP
                    if init_sl <= 0 and "sl " in comment_str.lower():
                        m_sl = re.search(r"sl\s*([\d.]+)", comment_str, re.I)
                        if m_sl:
                            init_sl = _to_float(m_sl.group(1))
                    if init_tp <= 0 and "tp " in comment_str.lower():
                        m_tp = re.search(r"tp\s*([\d.]+)", comment_str, re.I)
                        if m_tp:
                            init_tp = _to_float(m_tp.group(1))

                    exit_reason = ""
                    if direction_str in ("out", "close"):
                        cmt_lower = comment_str.lower()
                        if "tp" in cmt_lower or (init_tp > 0 and abs(deal_price - init_tp) <= 1.0):
                            exit_reason = "TP_HIT"
                        elif "sl" in cmt_lower or (init_sl > 0 and abs(deal_price - init_sl) <= 1.0):
                            exit_reason = "SL_HIT"
                        elif profit_val >= 0:
                            exit_reason = "PROFIT_EXIT"
                        else:
                            exit_reason = "LOSS_EXIT"

                    deal_dict = {
                        "time": cols[0],
                        "deal": cols[1],
                        "symbol": cols[2],
                        "type": cols[3],
                        "direction": cols[4],
                        "volume": cols[5],
                        "price": cols[6],
                        "order": order_ticket,
                        "commission": cols[8],
                        "swap": cols[9],
                        "profit": cols[10],
                        "balance": cols[11],
                        "comment": comment_str,
                        "initial_sl": init_sl,
                        "initial_tp": init_tp,
                        "stop_loss": init_sl,
                        "take_profit": init_tp,
                    }
                    if exit_reason:
                        deal_dict["exit_reason"] = exit_reason

                    deals.append(deal_dict)

        return {
            "success": True,
            "report_path": report_path,
            "html_length": len(html),
            "metrics": metrics,
            "orders_count": len(orders),
            "orders": orders,
            "deals_count": len(deals),
            "deals": deals,
        }

    # If it's a Tester log file (UTF-16-LE)
    else:
        log_content = _read_utf16_log(report_path)
        # Check if this is a compilation log from MetaEditor, NOT an actual tester log
        if "information: compiling" in log_content or "Result: 0 errors" in log_content:
            paths = _get_mt5_paths()
            files_dir = Path(paths["data_folder"]) / "MQL5" / "Files"
            candidates = sorted(
                [f for f in files_dir.glob("report_*.htm*") if f.is_file()],
                key=lambda f: f.stat().st_mtime,
                reverse=True
            )
            if candidates:
                logger.info(f"[read_test_report] Auto-redirected compilation log '{report_path}' to latest HTML test report: {candidates[0]}")
                return read_test_report(str(candidates[0].resolve()))
            return {
                "success": False,
                "error": f"'{report_path}' is a MetaEditor compilation log, not an MT5 Strategy Tester report. Strategy Tester reports are saved in: {files_dir}\\report_<timestamp>.htm",
                "metrics": {},
                "deals": [],
                "deals_count": 0,
            }

        metrics = _parse_tester_log(log_content)
        return {
            "success": True,
            "report_path": report_path,
            "log_content": log_content[:5000],
            "metrics": metrics,
            "deals_count": metrics.get("total_deals", 0),
            "deals": [],
        }



@mcp.tool()
def list_strategies() -> list[dict[str, str]]:
    """
    List all MQL5 strategy files (.mq5 source and .ex5 compiled) found in
    the Portable Broker Experts folder.  Useful for discovering what EAs are
    available to compile and test.

    Returns:
        List of dicts with keys: name, type ("source" or "compiled"), path
    """
    paths = _get_mt5_paths()
    experts_folder = Path(paths["data_folder"]) / "MQL5" / "Experts"

    results: list[dict[str, str]] = []
    if not experts_folder.exists():
        return results

    # Scan recursively for .mq5 and .ex5 files
    for pattern in ["*.mq5", "*.ex5"]:
        for f in experts_folder.rglob(pattern):
            results.append(
                {
                    "name": f.name,
                    "type": "source" if f.suffix == ".mq5" else "compiled",
                    "path": str(f),
                }
            )

    return results
