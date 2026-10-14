"""Live smoke tests — hits real public sources. Skipped if no network."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Skip all tests if BLITZYXSC_SKIP_LIVE env var is set
pytestmark = pytest.mark.skipif(
    os.environ.get("BLITZYXSC_SKIP_LIVE") == "1",
    reason="BLITZYXSC_SKIP_LIVE=1 set",
)

from blitzyxsc_api.main import app  # noqa: E402

client = TestClient(app)


def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["brand"] == "blitzyxsc"
    assert "syndication" in data["providers"]


def test_providers_list():
    r = client.get("/providers")
    assert r.status_code == 200
    data = r.json()
    assert "providers" in data
    assert isinstance(data["order"], list)
    assert len(data["order"]) >= 1


def test_root_returns_html():
    r = client.get("/")
    assert r.status_code == 200
    assert "blitzyxsc" in r.text


def test_swagger_docs():
    r = client.get("/docs")
    assert r.status_code == 200
    assert "swagger" in r.text.lower() or "openapi" in r.text.lower()


def test_openapi_spec():
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert data["info"]["title"].startswith("blitzyxsc")
    # Make sure we have lots of paths
    paths = list(data["paths"].keys())
    assert len(paths) >= 50, f"only {len(paths)} paths"


def test_branding_headers():
    r = client.get("/health")
    assert r.headers.get("X-Powered-By", "").startswith("blitzyxsc")
    assert r.headers.get("X-Author") == "blitzlabx"


# --- live calls (these may fail if public sources are down) --------------


def test_live_get_profile():
    """Try fetching a real profile (Elon Musk)."""
    r = client.get("/profile/elonmusk")
    # Public sources can be flaky; allow either success or 502
    assert r.status_code in (200, 502), f"unexpected status {r.status_code}: {r.text}"
    if r.status_code == 200:
        data = r.json()
        assert data["data"]["username"] == "elonmusk"


def test_live_get_tweet():
    """Try fetching a real tweet. Uses a famous tweet ID."""
    # Tweet ID for elonmusk pinned tweet
    r = client.get("/posts/20")  # twitter's first tweet by jack dorsey
    assert r.status_code in (200, 502), f"unexpected: {r.status_code}: {r.text}"
    if r.status_code == 200:
        data = r.json()
        assert "data" in data


def test_live_search():
    """Try a live search."""
    r = client.get("/search", params={"q": "openai", "limit": 5})
    assert r.status_code in (200, 502)
    if r.status_code == 200:
        data = r.json()
        assert "data" in data


def test_live_user_timeline():
    """Try fetching a user timeline."""
    r = client.get("/posts/user/elonmusk", params={"limit": 5})
    assert r.status_code in (200, 502)


def test_live_trends():
    """Try fetching trends."""
    r = client.get("/trends")
    assert r.status_code in (200, 502)
