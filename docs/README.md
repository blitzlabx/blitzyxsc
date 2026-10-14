# blitzyxsc — MDX-style docs

This directory contains long-form documentation for blitzyxsc, suitable for rendering as a static docs site (e.g., with Next.js MDX, Astro, Docusaurus, or any markdown-to-HTML pipeline).

## Files

- `README.md` — this index
- `getting-started.mdx` — installation and first request
- `architecture.mdx` — how the multi-provider router works
- `providers.mdx` — deep-dive into each provider
- `endpoints.mdx` — full endpoint reference (also available in Swagger UI)
- `deployment.mdx` — Vercel, Docker, Railway, VPS
- `examples.mdx` — code snippets in Python, JavaScript, Go, curl
- `postman_collection.json` — Postman v2.1 collection with all 220 endpoints
- `screenshots/` — captured live responses for embedding in docs

## Rendering

The `.mdx` files use standard markdown syntax. To render them as a docs site, you can use any of:

### Next.js + MDX
```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react
# Add to next.config.js: pageExtensions: ['ts', 'tsx', 'md', 'mdx']
# Drop the .mdx files in app/docs/
```

### Astro
```bash
npm create astro@latest
# Copy the .mdx files to src/pages/docs/
```

### Docusaurus
```bash
npm init docusaurus@latest
# Drop the .mdx files in docs/
```

### Plain HTML
Use any markdown-to-HTML converter (e.g., `pandoc`, `markdown-it`, `marked`).

## Branding

All docs are branded as **blitzyxsc by Blitz (`@blitzlabx`)**. Headers include:
- `blitzyxsc` logo (gradient blue→purple)
- Author attribution and link to https://x.com/blitzlabx
- Version 1.0.0
- MIT License

The Postman collection and OpenAPI spec also carry this branding in their info/name fields.
