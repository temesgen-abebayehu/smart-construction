import json
import logging
import threading
from pathlib import Path
from typing import Optional, TypedDict

import joblib
import pandas as pd

logger = logging.getLogger(__name__)

ML_DIR = Path(__file__).resolve().parents[2] / "ml"
MODEL_PATH = ML_DIR / "rf_classifier.pkl"
IMPUTER_PATH = ML_DIR / "imputer.pkl"
FEATURES_PATH = ML_DIR / "feature_names.json"

# Provisional mapping — confirm with the ML owner.
# Model classes: [0, 1, 2, 3]
CLASS_TO_LEVEL: dict[int, str] = {0: "low", 1: "medium", 2: "high", 3: "critical"}


class PredictionResult(TypedDict):
    class_index: int
    risk_level: str
    confidence: float           # max class probability, 0.0–1.0
    probabilities: dict[str, float]


_model = None
_imputer = None
_features: Optional[list[str]] = None
_lock = threading.Lock()


def load_artifacts() -> bool:
    """Load model + imputer + feature list. Idempotent. Returns True on success."""
    global _model, _imputer, _features
    with _lock:
        if _model is not None:
            return True
        if not (MODEL_PATH.exists() and IMPUTER_PATH.exists() and FEATURES_PATH.exists()):
            logger.warning(
                "ML artifacts missing (model=%s imputer=%s features=%s). "
                "Risk prediction will fall back to rule-based logic.",
                MODEL_PATH.exists(), IMPUTER_PATH.exists(), FEATURES_PATH.exists(),
            )
            return False
        try:
            with open(FEATURES_PATH) as f:
                _features = json.load(f)
            _imputer = joblib.load(IMPUTER_PATH)
            _model = joblib.load(MODEL_PATH)
            logger.info("ML artifacts loaded: %d features, %d classes", len(_features), len(_model.classes_))
            return True
        except Exception as e:
            logger.exception("Failed to load ML artifacts: %s", e)
            _model = _imputer = _features = None
            return False


def is_loaded() -> bool:
    return _model is not None


def predict(features_dict: dict) -> Optional[PredictionResult]:
    """
    Run inference. `features_dict` may have None/missing values — the imputer fills them.
    Returns None if the model isn't loaded.
    """
    if _model is None or _imputer is None or _features is None:
        return None

    # Build a DataFrame with the exact column order the model expects.
    row = pd.DataFrame([{f: features_dict.get(f) for f in _features}])
    imputed = pd.DataFrame(_imputer.transform(row), columns=_features)

    pred_class = int(_model.predict(imputed)[0])
    proba = _model.predict_proba(imputed)[0]

    probabilities = {
        CLASS_TO_LEVEL.get(int(cls), str(int(cls))): float(p)
        for cls, p in zip(_model.classes_, proba)
    }

    return {
        "class_index": pred_class,
        "risk_level": CLASS_TO_LEVEL.get(pred_class, str(pred_class)),
        "confidence": float(max(proba)),
        "probabilities": probabilities,
    }
