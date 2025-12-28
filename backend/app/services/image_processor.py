import io
from PIL import Image, ExifTags
import numpy as np


def get_exif_orientation(image: Image.Image) -> int | None:
    """Extract EXIF orientation tag from image."""
    try:
        exif = image._getexif()
        if exif is None:
            return None
        for tag_id, value in exif.items():
            tag = ExifTags.TAGS.get(tag_id)
            if tag == "Orientation":
                return value
    except (AttributeError, KeyError, IndexError):
        pass
    return None


def correct_orientation(image: Image.Image) -> Image.Image:
    """Apply EXIF orientation correction to image."""
    orientation = get_exif_orientation(image)
    if orientation is None:
        return image

    # EXIF orientation values and their corrections
    operations = {
        2: (Image.FLIP_LEFT_RIGHT,),
        3: (Image.ROTATE_180,),
        4: (Image.FLIP_TOP_BOTTOM,),
        5: (Image.FLIP_LEFT_RIGHT, Image.ROTATE_90),
        6: (Image.ROTATE_270,),
        7: (Image.FLIP_LEFT_RIGHT, Image.ROTATE_270),
        8: (Image.ROTATE_90,),
    }

    if orientation in operations:
        for op in operations[orientation]:
            image = image.transpose(op)

    return image


def load_image_from_bytes(data: bytes) -> Image.Image:
    """Load image from bytes and correct orientation."""
    image = Image.open(io.BytesIO(data))
    image = correct_orientation(image)
    # Convert to RGB if necessary
    if image.mode != "RGB":
        image = image.convert("RGB")
    return image


def image_to_numpy(image: Image.Image) -> np.ndarray:
    """Convert PIL Image to numpy array (RGB)."""
    return np.array(image)


def numpy_to_image(arr: np.ndarray) -> Image.Image:
    """Convert numpy array to PIL Image."""
    return Image.fromarray(arr)


def resize_image(image: Image.Image, max_size: int = 2048) -> Image.Image:
    """Resize image if larger than max_size while maintaining aspect ratio."""
    if max(image.size) <= max_size:
        return image
    ratio = max_size / max(image.size)
    new_size = (int(image.width * ratio), int(image.height * ratio))
    return image.resize(new_size, Image.Resampling.LANCZOS)
