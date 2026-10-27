"""
Workspace runtime customization for Backtest AI.
Excludes user strategies and data directories (data/, data/users/, node_modules/, .next/)
from uvicorn file-reloader supervisors (StatReload and WatchFilesReload) so that
editing, testing, or synthesizing strategy files never restarts the FastAPI server.
"""
from pathlib import Path

# 1. Patch StatReload (default supervisor on Windows)
try:
    import uvicorn.supervisors.statreload as _sr

    _orig_iter = _sr.StatReload.iter_py_files

    def _filtered_iter_py_files(self):
        for file_path in _orig_iter(self):
            parts = file_path.parts
            if any(p in ("data", "node_modules", ".next", ".gemini", "dist") for p in parts):
                continue
            yield file_path

    _sr.StatReload.iter_py_files = _filtered_iter_py_files
except Exception:
    pass

# 2. Patch WatchFilesReload (when watchfiles supervisor is active)
try:
    import uvicorn.supervisors.watchfilesreload as _wfr

    _orig_filter_call = _wfr.FileFilter.__call__

    def _filtered_file_filter_call(self, path: Path) -> bool:
        parts = path.parts
        if any(p in ("data", "node_modules", ".next", ".gemini", "dist") for p in parts):
            return False
        return _orig_filter_call(self, path)

    _wfr.FileFilter.__call__ = _filtered_file_filter_call
except Exception:
    pass
