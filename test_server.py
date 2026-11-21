"""Run: python -m unittest test_server.py -v (no API account required)."""
import base64
import io
import json
import os
import unittest
from unittest.mock import patch
from server import Handler

class FakeResponse:
    status = 200
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, *args): return self.payload.read(*args)
    def __init__(self, value): self.payload = io.BytesIO(json.dumps(value).encode())

class GatewayTests(unittest.TestCase):
    def request(self, prompt):
        handler = object.__new__(Handler)
        body = json.dumps({"prompt": prompt}).encode()
        handler.path = "/api/generate"
        handler.headers = {"Content-Length": str(len(body))}
        handler.rfile = io.BytesIO(body)
        handler.wfile = io.BytesIO()
        handler.send_response = lambda status: setattr(handler, "status_code", status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        return handler

    def test_missing_endpoint(self):
        handler = self.request("dress")
        with patch.dict(os.environ, {}, clear=True):
            handler.do_POST()
        self.assertEqual(handler.status_code, 400)
        self.assertIn(b"FD_IMAGE_API_URL", handler.wfile.getvalue())

    def test_generate_with_mock_backend(self):
        handler = self.request("blue dress")
        img = base64.b64encode(b"fake-image").decode()
        with patch.dict(os.environ, {"FD_IMAGE_API_URL": "http://127.0.0.1:8188/v1/images/generations", "FD_IMAGE_MODEL": "test"}, clear=True):
            with patch("server.urlopen", return_value=FakeResponse({"data": [{"b64_json": img}]})) as backend:
                handler.do_POST()
        self.assertEqual(handler.status_code, 200)
        result = json.loads(handler.wfile.getvalue())
        self.assertEqual(result["image"], "data:image/png;base64," + img)
        payload = json.loads(backend.call_args.args[0].data)
        self.assertEqual(payload["model"], "test")
        self.assertIn("blue dress", payload["prompt"])

    def test_reject_external_http(self):
        handler = self.request("coat")
        with patch.dict(os.environ, {"FD_IMAGE_API_URL": "http://example.com/generate"}, clear=True):
            handler.do_POST()
        self.assertEqual(handler.status_code, 400)
        self.assertIn(b"loopback", handler.wfile.getvalue())

    def test_reject_url_credentials(self):
        handler = self.request("coat")
        with patch.dict(os.environ, {"FD_IMAGE_API_URL": "https://name:password@example.com/generate"}, clear=True):
            handler.do_POST()
        self.assertEqual(handler.status_code, 400)

    def test_invalid_prompt(self):
        handler = self.request("")
        handler.do_POST()
        self.assertEqual(handler.status_code, 400)

if __name__ == "__main__":
    unittest.main()
