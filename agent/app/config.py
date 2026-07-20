"""Runtime configuration resolved from environment variables.

Paths default to the repo layout (``../data`` and ``../sandbox`` relative to the
``agent`` project) but are overridden in Docker via ``DATA_DIR`` / ``SANDBOX_DIR``.
"""

import os
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = Path(os.getenv("DATA_DIR", _REPO_ROOT / "data"))
SANDBOX_DIR = Path(os.getenv("SANDBOX_DIR", _REPO_ROOT / "sandbox"))

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "")
