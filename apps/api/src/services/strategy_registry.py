import importlib.util
import logging
import os
from pathlib import Path
from typing import Dict, Any, Type, List, Optional
from backtest_si.strategy import BaseStrategy
from domain.models import StrategyMetadata

logger = logging.getLogger("backtest_ai.strategy_registry")
PROJECT_ROOT = Path(__file__).resolve().parents[4]
USERS_STORAGE_DIR = PROJECT_ROOT / "data" / "users"


class StrategyRegistry:
    """Central registry for discovering and instantiating backtesting strategies."""
    def __init__(self):
        self._strategies: Dict[str, Type[BaseStrategy]] = {}
        self._metadata: Dict[str, StrategyMetadata] = {}

    def register(self, id: str, strategy_cls: Type[BaseStrategy], metadata: StrategyMetadata) -> None:
        self._strategies[id] = strategy_cls
        self._metadata[id] = metadata

    def _discover_and_load_strategy(self, id: str) -> Optional[Type[BaseStrategy]]:
        """Dynamically finds and loads a Python strategy script from the workspace data/users directory."""
        clean_id = id.strip()
        if clean_id.endswith(".py"):
            clean_id = clean_id[:-3]

        candidate_names = [f"{clean_id}.py", f"{clean_id}_v1.py", f"{clean_id}_v2.py"]
        found_path: Optional[Path] = None

        norm_id = clean_id.lower().replace("_", "").replace("-", "")
        if USERS_STORAGE_DIR.is_dir():
            for root, _, files in os.walk(USERS_STORAGE_DIR):
                for cand in candidate_names:
                    if cand in files:
                        found_path = Path(root) / cand
                        break
                if not found_path:
                    for f in files:
                        if f.endswith(".py"):
                            clean_f = f[:-3].lower().replace("_", "").replace("-", "")
                            if clean_f == norm_id or clean_f == f"{norm_id}v1" or clean_f == f"{norm_id}v2":
                                found_path = Path(root) / f
                                break
                if found_path:
                    break

            # Fallback: check __pycache__ for compiled bytecode
            if not found_path:
                for root, _, files in os.walk(USERS_STORAGE_DIR):
                    for f in files:
                        if f.endswith(".pyc") and norm_id in f.lower().replace("_", "").replace("-", ""):
                            found_path = Path(root) / f
                            break
                    if found_path:
                        break

        if not found_path or not found_path.is_file():
            return None

        try:
            import sys
            import backtest_si.strategy
            importlib.reload(backtest_si.strategy)

            mod_name = f"dynamic_strat_{clean_id}"
            spec = importlib.util.spec_from_file_location(mod_name, found_path)
            if not spec or not spec.loader:
                return None
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            for attr_name in dir(mod):
                attr = getattr(mod, attr_name)
                if (
                    isinstance(attr, type)
                    and attr.__name__ != "BaseStrategy"
                    and any(b.__name__ == "BaseStrategy" for b in getattr(attr, "__mro__", []))
                ):
                    meta = StrategyMetadata(
                        id=id,
                        name=attr.__name__,
                        description=getattr(attr, "__doc__", "") or f"Workspace strategy from {found_path.name}",
                        category="workspace",
                        parameters=[],
                    )
                    self.register(id, attr, meta)
                    if clean_id != id:
                        self.register(clean_id, attr, meta)
                    return attr
        except Exception as err:
            logger.warning(f"Error dynamically loading strategy '{id}' from {found_path}: {err}")
            return None
        return None

    def _ensure_base_methods(self, instance: BaseStrategy) -> None:
        """Defensively guarantees that all standard BaseStrategy quant methods exist on instance."""
        import types
        from backtest_si.strategy import BaseStrategy as CanonicalBase
        standard_methods = (
            "has_position", "get_position", "get_positions", "is_long", "is_short",
            "position_size", "entry_price", "unrealized_pnl", "close_position",
            "close_partial", "move_to_breakeven", "trail_stop", "modify_stop_loss",
            "modify_take_profit", "set_stop_loss", "set_take_profit",
            "calculate_risk_quantity", "round_lot"
        )
        for meth in standard_methods:
            if not hasattr(instance, meth) and hasattr(CanonicalBase, meth):
                setattr(instance, meth, types.MethodType(getattr(CanonicalBase, meth), instance))

    def _instantiate_strategy(self, cls: Type[BaseStrategy], parameters: Optional[Dict[str, Any]] = None) -> BaseStrategy:
        """Instantiates a BaseStrategy subclass adapting to its __init__ signature."""
        import inspect
        params = parameters or {}
        instance: BaseStrategy
        try:
            sig = inspect.signature(cls.__init__)
            param_names = set(sig.parameters.keys()) - {"self"}

            # If it accepts **kwargs or 'parameters', pass parameters dict
            if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
                try:
                    instance = cls(parameters=params, **params)
                except TypeError:
                    instance = cls(**params)
            elif "parameters" in param_names:
                instance = cls(parameters=params)
            else:
                # Filter params to match explicit signature arguments
                filtered = {k: v for k, v in params.items() if k in param_names}
                instance = cls(**filtered)
        except Exception:
            # Fallback to default constructor
            instance = cls()

        if not hasattr(instance, "parameters") or not instance.parameters:
            instance.parameters = params
        if not hasattr(instance, "orders_to_submit"):
            instance.orders_to_submit = []
        if not hasattr(instance, "order_counter"):
            instance.order_counter = 0
        if not hasattr(instance, "_active_positions"):
            instance._active_positions = {}

        self._ensure_base_methods(instance)
        return instance

    def get_strategy(self, id: str, parameters: Optional[Dict[str, Any]] = None) -> BaseStrategy:
        # Dynamic search across user workspace scripts first so newest edits on disk are always executed
        dynamic_cls = self._discover_and_load_strategy(id)
        if dynamic_cls:
            return self._instantiate_strategy(dynamic_cls, parameters)

        if id in self._strategies:
            return self._instantiate_strategy(self._strategies[id], parameters)

        raise KeyError(f"Strategy '{id}' not found in registry. Available: {list(self._strategies.keys())}")

    def list_metadata(self) -> List[StrategyMetadata]:
        return list(self._metadata.values())

    def get_metadata(self, id: str) -> Optional[StrategyMetadata]:
        return self._metadata.get(id)

# Singleton registry instance
strategy_registry = StrategyRegistry()
