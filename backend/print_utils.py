from print_config import PX_PER_CM

def cm_to_px(cm: float) -> int:
    return int(cm * PX_PER_CM)

def can_place(x, y, w, h, occupied):
    for ox, oy, ow, oh in occupied:
        if not (x + w <= ox or x >= ox + ow or y + h <= oy or y >= oy + oh):
            return False
    return True

def trim_transparent(img):
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img
