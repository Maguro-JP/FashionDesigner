#!/usr/bin/env python3
"""FashionDesigner local image generation gateway. Python standard library only.
Requires an explicitly configured OpenAI-compatible image endpoint.
Never stores or logs API keys. Serves the existing FashionDesigner UI locally.
"""
import base64
import json
import os
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
import ipaddress

ROOT = Path(__file__).resolve().parent
MAX_BODY = 64 * 1024

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/api/generate":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            self.send_error(413, "Invalid request size")
            return
        try:
            data = json.loads(self.rfile.read(length))
            prompt = data.get("prompt")
            if not isinstance(prompt, str) or not 1 <= len(prompt) <= 2000:
                raise ValueError("Prompt must be 1-2000 characters")
            endpoint = os.environ.get("FD_IMAGE_API_URL", "").strip()
            if not endpoint:
                raise ValueError("Configure FD_IMAGE_API_URL (localhost or HTTPS)")
            url = urlsplit(endpoint)
            host = url.hostname or ""
            if url.username or url.password or url.fragment or url.scheme not in ("http", "https"):
                raise ValueError("Invalid image API URL")
            try:
                ip = ipaddress.ip_address(host)
            except ValueError:
                ip = None
            if url.scheme == "http" and not (host == "localhost" or ip and ip.is_loopback):
                raise ValueError("HTTP backend must be loopback")
            if not host or (ip and not ip.is_loopback):
                raise ValueError("IP backends must be loopback")
            payload = json.dumps({
                "model": os.environ.get("FD_IMAGE_MODEL", "gpt-image-1"),
                "prompt": "Single isolated clothing item, front view, centered, plain white background, no person, no mannequin. " + prompt,
                "size": "1024x1024",
                "response_format": "b64_json",
            }).encode()
            headers = {"Content-Type": "application/json"}
            if os.environ.get("FD_IMAGE_API_KEY"):
                headers["Authorization"] = "Bearer " + os.environ["FD_IMAGE_API_KEY"]
            req = Request(endpoint, data=payload, headers=headers, method="POST")
            with urlopen(req, timeout=180) as response:
                if response.status != 200:
                    raise ValueError("Image backend failed")
                result = json.load(response)
            image = result.get("data", [{}])[0].get("b64_json")
            if not image:
                raise ValueError("Backend did not return b64_json; check endpoint compatibility")
            raw = base64.b64decode(image, validate=True)
            if len(raw) > 15 * 1024 * 1024:
                raise ValueError("Image too large")
            self.reply(200, {"image": "data:image/png;base64," + image})
        except (ValueError, KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            self.reply(400, {"error": str(e)})
        except (HTTPError, URLError, TimeoutError) as e:
            self.reply(502, {"error": "Image backend unavailable: " + str(e)})

    def reply(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    print("FashionDesigner: http://127.0.0.1:8765/generate.html")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
