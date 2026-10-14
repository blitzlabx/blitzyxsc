"""Tweet router — top-level /tweet shortcuts mirroring /posts.

Exposes ~15 tweet shortcut endpoints.
"""
from __future__ import annotations

from fastapi import APIRouter

from .posts import router as posts_router
from .replies import router as replies_router
from .quotes import router as quotes_router

router = APIRouter(prefix="/tweet", tags=["Tweet Shortcuts"])

# Re-export common endpoints under /tweet prefix for convenience.
# These wrap existing handlers.
router.include_router(posts_router)
