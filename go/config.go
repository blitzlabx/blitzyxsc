// Package main: blitzyxsc — Go (net/http) mirror.
//
// Configuration mirrors the Python pydantic-settings in
// blitzyxsc_api/config.py — all values are read from the environment with
// the BLITZYXSC_ prefix where applicable, falling back to safe defaults.
package main

import (
	"os"
	"strconv"
	"strings"
)

// Version + brand constants — used everywhere branding is required.
const (
	Brand   = "blitzyxsc"
	Version = "1.0.0"
	Author  = "Blitz <blitzlabx>"
	AuthorURL = "https://x.com/blitzlabx"
)

// Settings holds the runtime configuration. Fields are populated from the
// environment on startup by LoadSettings().
type Settings struct {
	Brand   string
	Author  string
	Host    string
	Port    int

	// Per-provider timeouts (seconds).
	ComposableTimeout  int
	SyndicationTimeout int
	NitterTimeout      int
	RSSTimeout         int

	// Provider priority order — first that succeeds wins.
	ProviderOrder []string

	// Nitter instances tried in order.
	NitterInstances []string

	// Upstream endpoints.
	ComposableBaseURL   string
	SyndicationBaseURL  string
	SyndicationTimelineURL string

	// Defaults.
	DefaultPageSize int
	MaxPageSize     int

	// Real Chrome UA — fxtwitter returns 403 without it.
	UserAgent string

	// CORS origins — comma-separated. "*" by default.
	CORSOrigins []string

	// Cache TTL (seconds) — reserved for future use, kept to mirror Python config.
	CacheTTLMilliseconds int
}

// envOr reads an env var, returning the fallback when unset / empty.
func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

// envInt reads an env var as int, returning fallback on parse failure / unset.
func envInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

// envList reads a comma-separated env var into a []string.
func envList(key string, fallback []string) []string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}

// LoadSettings reads configuration from the environment using the BLITZYXSC_
// prefix and returns a fully populated Settings value.
func LoadSettings() *Settings {
	return &Settings{
		Brand: Brand,
		Author: Author,
		Host:    envOr("BLITZYXSC_HOST", "0.0.0.0"),
		Port:    envInt("BLITZYXSC_PORT", envInt("PORT", 8080)),

		ComposableTimeout:  envInt("BLITZYXSC_COMPOSABLE_TIMEOUT", 15),
		SyndicationTimeout: envInt("BLITZYXSC_SYNDICATION_TIMEOUT", 10),
		NitterTimeout:      envInt("BLITZYXSC_NITTER_TIMEOUT", 15),
		RSSTimeout:         envInt("BLITZYXSC_RSS_TIMEOUT", 15),

		ProviderOrder: envList("BLITZYXSC_PROVIDER_ORDER", []string{
			"composable", "syndication", "nitter", "rss",
		}),

		NitterInstances: envList("BLITZYXSC_NITTER_INSTANCES", []string{
			"https://nitter.meowing.monster",
			"https://nitter.poast.org",
			"https://nitter.privacydev.net",
			"https://nitter.cz",
			"https://nitter.woodland.cafe",
			"https://nitter.1d4.us",
			"https://nitter.kavin.rocks",
			"https://nitter.unixfox.eu",
		}),

		ComposableBaseURL:      envOr("BLITZYXSC_COMPOSABLE_BASE_URL", "https://api.fxtwitter.com"),
		SyndicationBaseURL:     envOr("BLITZYXSC_SYNDICATION_BASE_URL", "https://cdn.syndication.twimg.com"),
		SyndicationTimelineURL: envOr("BLITZYXSC_SYNDICATION_TIMELINE_URL", "https://cdn.syndication.twimg.com/timeline/profile"),

		DefaultPageSize: envInt("BLITZYXSC_DEFAULT_PAGE_SIZE", 20),
		MaxPageSize:     envInt("BLITZYXSC_MAX_PAGE_SIZE", 100),

		UserAgent: envOr("BLITZYXSC_USER_AGENT",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "+
				"(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),

		CORSOrigins: envList("BLITZYXSC_CORS_ORIGINS", []string{"*"}),

		CacheTTLMilliseconds: envInt("BLITZYXSC_CACHE_TTL_SECONDS", 60),
	}
}

// settings is the package-level singleton, populated in main().
var settings *Settings
