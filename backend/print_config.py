# backend/print_config.py

DPI = 300
PX_PER_CM = DPI / 2.54

SHEET_WIDTH_CM = 57.0
SHEET_HEIGHT_CM = 100.0
SPACING_CM = 0.2  # 2mm de margem mínima

def cm_to_px(cm: float) -> int:
    return round(cm * PX_PER_CM)

SHEET_WIDTH_PX = cm_to_px(SHEET_WIDTH_CM)
SHEET_HEIGHT_PX = cm_to_px(SHEET_HEIGHT_CM)
SPACING_PX = cm_to_px(SPACING_CM)
