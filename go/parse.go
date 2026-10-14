// Package main: fxtwitter response parsers.
//
// Pure functions that take raw JSON-decoded map[string]interface{} values
// from fxtwitter / the syndication CDN and return normalized blitzyxsc
// Tweet / Profile values. Mirrors the Python _parse_tweet / get_profile
// logic in blitzyxsc_api/providers/composable.py and the TS port in
// blitzyxsc/ts/lib/parseFxtwitter.ts.
package main

import (
        "encoding/json"
        "fmt"
        "regexp"
        "strconv"
        "strings"
        "time"
)

var twitterDateRe = regexp.MustCompile(
        `^([A-Z][a-z]{2})\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\+0000)\s+(\d{4})$`,
)

// ParseTwitterDate handles Twitter's "Tue Mar 21 20:50:14 +0000 2006"
// form plus ISO 8601 and the legacy RSS pubDate. Returns nil on failure.
func ParseTwitterDate(s string) *time.Time {
        if s = strings.TrimSpace(s); s == "" {
                return nil
        }
        // 1) ISO 8601 — most modern APIs (fxtwitter) return this directly.
        if t, err := time.Parse(time.RFC3339, s); err == nil {
                utc := t.UTC()
                return &utc
        }
        if t, err := time.Parse("2006-01-02T15:04:05.000Z", s); err == nil {
                utc := t.UTC()
                return &utc
        }
        if t, err := time.Parse("2006-01-02T15:04:05Z", s); err == nil {
                utc := t.UTC()
                return &utc
        }
        if t, err := time.Parse("2006-01-02 15:04:05", s); err == nil {
                utc := t.UTC()
                return &utc
        }
        if t, err := time.Parse("2006-01-02", s); err == nil {
                utc := t.UTC()
                return &utc
        }
        // 2) Twitter's "Tue Mar 21 20:50:14 +0000 2006" form
        if m := twitterDateRe.FindStringSubmatch(s); m != nil {
                // Reformat to a Go-parseable layout: "Mon Jan 2 15:04:05 -0700 2006".
                layout := "Mon Jan 2 15:04:05 -0700 2006"
                // Map short month names to canonical form (already short, but normalize).
                if t, err := time.Parse(layout, m[1]+" "+m[2]+" "+m[3]+" "+m[4]+":"+m[5]+":"+m[6]+" "+m[7]+" "+m[8]); err == nil {
                        utc := t.UTC()
                        return &utc
                }
        }
        // 3) RSS pubDate: "Tue, 21 Mar 2006 20:50:14 GMT"
        if t, err := time.Parse(time.RFC1123Z, s); err == nil {
                utc := t.UTC()
                return &utc
        }
        if t, err := time.Parse(time.RFC1123, s); err == nil {
                utc := t.UTC()
                return &utc
        }
        return nil
}

// ---- low-level coercion helpers -------------------------------------------

func toStr(v interface{}) string {
        if v == nil {
                return ""
        }
        switch s := v.(type) {
        case string:
                return s
        case float64:
                return strconv.FormatFloat(s, 'f', -1, 64)
        case int:
                return strconv.Itoa(s)
        case int64:
                return strconv.FormatInt(s, 10)
        case json.Number:
                return s.String()
        case bool:
                if s {
                        return "true"
                }
                return "false"
        default:
                return fmt.Sprintf("%v", v)
        }
}

func toInt(v interface{}) *int {
        if v == nil {
                return nil
        }
        switch n := v.(type) {
        case float64:
                i := int(n)
                return &i
        case int:
                return &n
        case int64:
                i := int(n)
                return &i
        case json.Number:
                if i, err := n.Int64(); err == nil {
                        ii := int(i)
                        return &ii
                }
        case string:
                if i, err := strconv.Atoi(strings.TrimSpace(n)); err == nil {
                        return &i
                }
        case bool:
                // treat bool as 0/1
                var i int
                if n {
                        i = 1
                }
                return &i
        }
        return nil
}

func toBool(v interface{}) *bool {
        if v == nil {
                return nil
        }
        switch b := v.(type) {
        case bool:
                return &b
        case string:
                if b == "true" {
                        t := true
                        return &t
                } else if b == "false" {
                        f := false
                        return &f
                }
        case float64:
                bb := b != 0
                return &bb
        case int:
                bb := b != 0
                return &bb
        }
        return nil
}

func toStrPtr(v interface{}) *string {
        if v == nil {
                return nil
        }
        s := toStr(v)
        if s == "" {
                empty := ""
                return &empty
        }
        return &s
}

// nonEmptyStrPtr returns *string only when v is a non-empty string.
func nonEmptyStrPtr(v interface{}) *string {
        if v == nil {
                return nil
        }
        s, ok := v.(string)
        if !ok || s == "" {
                return nil
        }
        return &s
}

// objFromMap returns a sub-map[string]interface{} when v is a JSON object.
func objFromMap(v interface{}) map[string]interface{} {
        if v == nil {
                return nil
        }
        if m, ok := v.(map[string]interface{}); ok {
                return m
        }
        return nil
}

// arrFromMap returns a []interface{} when v is a JSON array.
func arrFromMap(v interface{}) []interface{} {
        if v == nil {
                return nil
        }
        if a, ok := v.([]interface{}); ok {
                return a
        }
        return nil
}

// ---- fxtwitter parsers -----------------------------------------------------

// ParseFxtwitterTweet normalizes a single fxtwitter tweet object into the
// blitzyxsc Tweet shape. Recursively parses the quoted tweet when present.
//
// fxtwitter field conventions:
//   - tweet objects:  `author` block, `replies/retweets/likes/quotes/views`
//   - media block:    `{ all: [...] }` or `[...]`
//   - mentions:       `[{ screen_name, name, id_str, id }]`
func ParseFxtwitterTweet(t map[string]interface{}) Tweet {
        if t == nil {
                return BlankTweet()
        }

        // Author block: fxtwitter uses `author` for tweets.
        userData := objFromMap(t["author"])
        if userData == nil {
                userData = objFromMap(t["user"])
        }
        if userData == nil {
                userData = map[string]interface{}{}
        }
        author := &TweetAuthor{
                ID:          toStr(userData["id"]),
                Username:    firstNonEmptyStr(asString(userData["screen_name"]), asString(userData["username"])),
                DisplayName: asString(userData["name"]),
                Avatar:      firstNonEmptyStr(asString(userData["profile_image_url"]), asString(userData["avatar_url"])),
                Verified:    toBool(userData["verified"]),
        }

        // Media: { all: [...] } or [ ... ]
        media := []MediaItem{}
        mediaBlock := t["media"]
        var allMedia []interface{}
        if arr := arrFromMap(mediaBlock); arr != nil {
                allMedia = arr
        } else if m := objFromMap(mediaBlock); m != nil {
                allMedia = arrFromMap(m["all"])
        }
        for _, mi := range allMedia {
                m := objFromMap(mi)
                if m == nil {
                        continue
                }
                typ := asString(m["type"])
                if typ == "" {
                        typ = "photo"
                }
                media = append(media, MediaItem{
                        Type:       typ,
                        URL:        asString(m["url"]),
                        Alt:        asString(m["altText"]),
                        Width:      toIntOrZero(m["width"]),
                        Height:     toIntOrZero(m["height"]),
                        Thumbnail:  asString(m["thumbnail_url"]),
                        DurationMs: toIntOrZero(m["duration"]),
                })
        }

        // Mentions
        mentions := []TweetAuthor{}
        for _, mi := range arrFromMap(t["mentions"]) {
                m := objFromMap(mi)
                if m == nil {
                        continue
                }
                mentions = append(mentions, TweetAuthor{
                        Username: firstNonEmptyStr(asString(m["screen_name"]), asString(m["name"])),
                        ID:       firstNonEmptyStr(asString(m["id_str"]), asString(m["id"])),
                })
        }

        // URLs: list of { url, expanded_url } or plain strings
        urls := []string{}
        for _, ui := range arrFromMap(t["urls"]) {
                if s, ok := ui.(string); ok {
                        urls = append(urls, s)
                        continue
                }
                m := objFromMap(ui)
                if m == nil {
                        continue
                }
                u := firstNonEmptyStr(asString(m["url"]), asString(m["expanded_url"]))
                if u != "" {
                        urls = append(urls, u)
                }
        }

        // Hashtags / Cashtags — already string arrays in fxtwitter.
        hashtags := []string{}
        for _, h := range arrFromMap(t["hashtags"]) {
                if s, ok := h.(string); ok {
                        hashtags = append(hashtags, s)
                }
        }
        cashtags := []string{}
        for _, c := range arrFromMap(t["cashtags"]) {
                if s, ok := c.(string); ok {
                        cashtags = append(cashtags, s)
                }
        }

        // Quoted tweet (recursive).
        var quoted *Tweet
        var isQuote *bool
        if q := objFromMap(t["quote"]); q != nil {
                parsed := ParseFxtwitterTweet(q)
                quoted = &parsed
                t := true
                isQuote = &t
        } else {
                f := false
                isQuote = &f
        }

        // Conversation / reply-to — fxtwitter uses conversation_str / in_reply_to_str
        var convID, inReplyTo *string
        if s := nonEmptyStrPtr(t["conversation_id_str"]); s != nil {
                convID = s
        } else {
                convID = nonEmptyStrPtr(t["conversation_id"])
        }
        if s := nonEmptyStrPtr(t["in_reply_to_status_id_str"]); s != nil {
                inReplyTo = s
        } else {
                inReplyTo = nonEmptyStrPtr(t["in_reply_to"])
        }

        return Tweet{
                ID:             toStr(t["id"]),
                Text:           toStr(t["text"]),
                Author:         author,
                CreatedAt:      ParseTwitterDate(asString(t["created_at"])),
                Language:       nonEmptyStrPtr(t["lang"]),
                Source:         nonEmptyStrPtr(t["source"]),
                ReplyCount:     toInt(t["replies"]),
                RetweetCount:   toInt(t["retweets"]),
                LikeCount:      toInt(t["likes"]),
                QuoteCount:     toInt(t["quotes"]),
                BookmarkCount:  toInt(t["bookmark_count"]),
                ViewCount:      toInt(t["views"]),
                Media:          media,
                URLs:           urls,
                Hashtags:       hashtags,
                Mentions:       mentions,
                Cashtags:       cashtags,
                ConversationID: convID,
                InReplyTo:      inReplyTo,
                IsQuote:        isQuote,
                QuotedTweet:    quoted,
                IsRetweet:      toBool(t["is_retweet"]),
                URL:            nonEmptyStrPtr(t["url"]),
                Sensitive:      toBool(t["possibly_sensitive"]),
        }
}

// ParseFxtwitterProfile normalizes a fxtwitter profile payload
// ({ "user": {...} }) into the blitzyxsc Profile shape.
func ParseFxtwitterProfile(data map[string]interface{}, username string) Profile {
        u := objFromMap(data["user"])
        if u == nil {
                u = map[string]interface{}{}
        }

        // fxtwitter verification can be a bool or { verified: bool } object.
        var verified *bool
        if vobj := objFromMap(u["verification"]); vobj != nil {
                verified = toBool(vobj["verified"])
        } else if vb, ok := u["verification"].(bool); ok {
                b := vb
                verified = &b
        }

        // website = u.website or u.url — fxtwitter may return either as a plain
        // string or as an object with { url, display_url } sub-fields.
        website := extractURLField(u["website"])
        if website == "" {
                website = extractURLField(u["url"])
        }

        return Profile{
                ID:          toStr(u["id"]),
                Username:    firstNonEmptyStr(asString(u["screen_name"]), username),
                DisplayName: asString(u["name"]),
                Bio:         asString(u["description"]),
                Location:    asString(u["location"]),
                Website:     website,
                Avatar:      asString(u["avatar_url"]),
                Banner:      asString(u["banner_url"]),
                Followers:   toInt(u["followers"]),
                Following:   toInt(u["following"]),
                TweetsCount: toInt(u["tweets"]),
                LikesCount:  toInt(u["likes"]),
                ListedCount: nil,
                Verified:    verified,
                Protected:   toBool(u["protected"]),
                JoinedAt:    ParseTwitterDate(asString(u["created_at"])),
                PinnedTweet: nil,
        }
}

// ---- syndication parser ---------------------------------------------------

// ParseSyndicationTweet normalizes a raw syndication CDN tweet-result object
// into the blitzyxsc Tweet shape. Mirrors the Python SyndicationProvider._parse_tweet.
func ParseSyndicationTweet(raw map[string]interface{}) Tweet {
        if raw == nil {
                return BlankTweet()
        }

        userRaw := objFromMap(raw["user"])
        if userRaw == nil {
                userRaw = map[string]interface{}{}
        }
        author := &TweetAuthor{
                ID:          firstNonEmptyStr(asString(userRaw["id_str"]), asString(userRaw["id"])),
                Username:    asString(userRaw["screen_name"]),
                DisplayName: asString(userRaw["name"]),
                Avatar:      firstNonEmptyStr(asString(userRaw["profile_image_url_https"]), asString(userRaw["profile_image_url"])),
                Verified:    toBool(userRaw["verified"]),
        }

        // mediaDetails or entities.extended_entities.media
        media := []MediaItem{}
        var mediaList []interface{}
        if md := arrFromMap(raw["mediaDetails"]); md != nil {
                mediaList = md
        } else if ent := objFromMap(raw["extended_entities"]); ent != nil {
                mediaList = arrFromMap(ent["media"])
        }
        for _, mi := range mediaList {
                m := objFromMap(mi)
                if m == nil {
                        continue
                }
                typ := asString(m["type"])
                if typ == "" {
                        typ = "photo"
                }
                origInfo := objFromMap(m["original_info"])
                media = append(media, MediaItem{
                        Type:       typ,
                        URL:        firstNonEmptyStr(asString(m["media_url_https"]), asString(m["media_url"])),
                        Alt:        firstNonEmptyStr(asString(m["altText"]), asString(m["display_url"])),
                        Width:      toIntOrZero(origInfo["width"]),
                        Height:     toIntOrZero(origInfo["height"]),
                        Thumbnail:  asString(m["media_url_https"]),
                        DurationMs: toIntOrZero(m["duration_millis"]),
                })
        }

        // entities: urls, hashtags, user_mentions, symbols
        entities := objFromMap(raw["entities"])
        if entities == nil {
                entities = map[string]interface{}{}
        }

        urls := []string{}
        for _, ui := range arrFromMap(entities["urls"]) {
                m := objFromMap(ui)
                if m == nil {
                        continue
                }
                u := firstNonEmptyStr(asString(m["expanded_url"]), asString(m["url"]))
                if u != "" {
                        urls = append(urls, u)
                }
        }

        hashtags := []string{}
        for _, h := range arrFromMap(entities["hashtags"]) {
                if m := objFromMap(h); m != nil {
                        if t := asString(m["text"]); t != "" {
                                hashtags = append(hashtags, t)
                        }
                }
        }

        mentions := []TweetAuthor{}
        for _, mi := range arrFromMap(entities["user_mentions"]) {
                m := objFromMap(mi)
                if m == nil {
                        continue
                }
                mentions = append(mentions, TweetAuthor{
                        Username: asString(m["screen_name"]),
                        ID:       firstNonEmptyStr(asString(m["id_str"]), asString(m["id"])),
                })
        }

        cashtags := []string{}
        for _, c := range arrFromMap(entities["symbols"]) {
                if m := objFromMap(c); m != nil {
                        if t := asString(m["text"]); t != "" {
                                cashtags = append(cashtags, t)
                        }
                }
        }

        // Quoted tweet
        var quoted *Tweet
        var isQuote *bool
        q := objFromMap(raw["quoted_status"])
        if q != nil || asString(raw["quoted_status_id_str"]) != "" {
                if q != nil {
                        parsed := ParseSyndicationTweet(q)
                        quoted = &parsed
                }
                t := true
                isQuote = &t
        } else {
                f := false
                isQuote = &f
        }

        id := firstNonEmptyStr(asString(raw["id_str"]), asString(raw["id"]))
        text := firstNonEmptyStr(asString(raw["text"]), asString(raw["full_text"]))
        url := fmt.Sprintf("https://x.com/%s/status/%s", author.Username, id)
        if id == "" {
                url = ""
        }

        convID := nonEmptyStrPtr(raw["conversation_id_str"])
        inReplyTo := nonEmptyStrPtr(raw["in_reply_to_status_id_str"])

        return Tweet{
                ID:             id,
                Text:           text,
                Author:         author,
                CreatedAt:      ParseTwitterDate(asString(raw["created_at"])),
                Language:       nonEmptyStrPtr(raw["lang"]),
                Source:         nonEmptyStrPtr(raw["source"]),
                ReplyCount:     toInt(raw["reply_count"]),
                RetweetCount:   toInt(raw["retweet_count"]),
                LikeCount:      toInt(raw["favorite_count"]),
                QuoteCount:     toInt(raw["quote_count"]),
                BookmarkCount:  toInt(raw["bookmark_count"]),
                ViewCount:      toInt(raw["view_count"]),
                Media:          media,
                URLs:           urls,
                Hashtags:       hashtags,
                Mentions:       mentions,
                Cashtags:       cashtags,
                ConversationID: convID,
                InReplyTo:      inReplyTo,
                IsQuote:        isQuote,
                QuotedTweet:    quoted,
                URL:            &url,
                Sensitive:      toBool(raw["possibly_sensitive"]),
        }
}

// BlankTweet returns an empty Tweet with non-nil slices so JSON marshalling
// emits [] rather than null, matching the Python shape.
func BlankTweet() Tweet {
        falseVal := false
        return Tweet{
                ID:       "",
                Text:     "",
                Author:   nil,
                Media:    []MediaItem{},
                URLs:     []string{},
                Hashtags: []string{},
                Mentions: []TweetAuthor{},
                Cashtags: []string{},
                IsQuote:  &falseVal,
        }
}

// ---- tiny helpers ---------------------------------------------------------

// asString returns v as a string if it is one (or a JSON number / bool as a
// normalized string), else "".
func asString(v interface{}) string {
        return toStr(v)
}

// extractURLField returns a clean URL string from v which may be:
//   - a plain string (returned as-is)
//   - a JSON object { url: "...", display_url: "..." } (returns the url field)
//   - nil / other (returns "")
func extractURLField(v interface{}) string {
        if v == nil {
                return ""
        }
        if s, ok := v.(string); ok {
                return s
        }
        if m, ok := v.(map[string]interface{}); ok {
                if s, ok := m["url"].(string); ok {
                        return s
                }
                if s, ok := m["expanded_url"].(string); ok {
                        return s
                }
                if s, ok := m["display_url"].(string); ok {
                        return s
                }
        }
        return ""
}

// ptrIfString returns *string when v is a string (including empty), else nil.
func ptrIfString(v interface{}) *string {
        if v == nil {
                return nil
        }
        s, ok := v.(string)
        if !ok {
                // Coerce numbers / bools to a string.
                s = toStr(v)
        }
        return &s
}

// firstNonEmptyStr returns the first non-empty string from a variadic list.
func firstNonEmptyStr(candidates ...string) string {
        for _, c := range candidates {
                if strings.TrimSpace(c) != "" {
                        return c
                }
        }
        return ""
}

// toIntOrZero returns 0 for nil / non-numeric values, else the int value.
func toIntOrZero(v interface{}) int {
        if p := toInt(v); p != nil {
                return *p
        }
        return 0
}
