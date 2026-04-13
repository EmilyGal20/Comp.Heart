import ctypes
from pathlib import Path


def _candidate_paths() -> list[Path]:
    base = Path(__file__).resolve().parent
    return [
        base / "risk_score.dll",
        base / "librisk_score.so",
        base / "librisk_score.dylib",
    ]


def _load_library():
    for candidate in _candidate_paths():
        if candidate.exists():
            library = ctypes.CDLL(str(candidate))
            library.task_risk_score.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int]
            library.task_risk_score.restype = ctypes.c_int
            return library
    return None


_LIBRARY = _load_library()


def python_task_risk_score(hours_overdue: int, priority_weight: int, unread_notifications: int, sla_breached: bool) -> int:
    score = 10 + max(hours_overdue, 0) * 2 + priority_weight * 12 + unread_notifications * 5 + (25 if sla_breached else 0)
    return max(0, min(score, 100))


def task_risk_score(hours_overdue: int, priority_weight: int, unread_notifications: int, sla_breached: bool) -> int:
    if _LIBRARY is None:
        return python_task_risk_score(hours_overdue, priority_weight, unread_notifications, sla_breached)
    return int(
        _LIBRARY.task_risk_score(
            int(hours_overdue),
            int(priority_weight),
            int(unread_notifications),
            int(1 if sla_breached else 0),
        )
    )
