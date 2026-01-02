import io
import zipfile
import requests


def create_zip_from_urls(urls: list[str]) -> bytes:
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        for i, url in enumerate(urls):
            r = requests.get(url)
            r.raise_for_status()
            z.writestr(f"folha_{i+1}.png", r.content)

    buffer.seek(0)
    return buffer.read()
