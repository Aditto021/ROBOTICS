"""Open-vocabulary classes for YOLO-World and how the dashboard treats each one.

The vocabulary is baked into models/resqbot-world.pt by download_models.py.
If you change it, run  download_models.py  again (needs internet once).
"""

# label -> category
#   critical : fire and smoke
#   hazard   : things that can hurt a victim or a rescuer
#   resource : useful for the rescue team
#   obstacle : blocks the rover's way
#   animal   : living things other than people
VOCAB = {
    "fire": "critical",
    "smoke": "critical",
    "gas cylinder": "hazard",
    "knife": "hazard",
    "scissors": "hazard",
    "broken glass": "hazard",
    "electric cable": "hazard",
    "fire extinguisher": "resource",
    "first aid kit": "resource",
    "cell phone": "resource",
    "backpack": "resource",
    "chair": "obstacle",
    "door": "obstacle",
    "stairs": "obstacle",
    "bottle": "obstacle",
    "dog": "animal",
    "cat": "animal",
}

CLASSES = list(VOCAB)

# Minimum confidence per category (YOLO-World is zero-shot, so its scores are low).
THRESHOLDS = {
    "critical": 0.25,
    "hazard": 0.30,
    "resource": 0.30,
    "obstacle": 0.35,
    "animal": 0.35,
    "object": 0.35,
}


def category(label: str) -> str:
    return VOCAB.get(label, "object")
