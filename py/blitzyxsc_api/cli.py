"""blitzyxsc CLI — convenience launcher.

Usage:
    blitzyxsc            # starts uvicorn on 0.0.0.0:8000
    blitzyxsc --port 5000
    blitzyxsc --reload
"""
from __future__ import annotations

import argparse


def main():
    parser = argparse.ArgumentParser(prog="blitzyxsc", description="blitzyxsc — X/Twitter free API by blitzlabx")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()

    import uvicorn
    uvicorn.run(
        "blitzyxsc_api.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers,
    )


if __name__ == "__main__":
    main()
