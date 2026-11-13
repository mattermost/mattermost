// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRenderHTMLFencedCodeWhitespaceInfo(t *testing.T) {
	for name, tc := range map[string]struct {
		Markdown     string
		ExpectedHTML string
	}{
		"encoded space":                {"```&#x20;\n```", "<pre><code></code></pre>"},
		"encoded tab":                  {"```&#9;\n```", "<pre><code></code></pre>"},
		"encoded form feed":            {"```&#12;\n```", "<pre><code></code></pre>"},
		"encoded form feed (hex)":      {"```&#xC;\n```", "<pre><code></code></pre>"},
		"encoded space with code":      {"```&#x20;\nfoo\n```", "<pre><code>foo\n</code></pre>"},
		"language after encoded space": {"```&#x20;go\nfoo\n```", "<pre><code class=\"language-go\">foo\n</code></pre>"},
	} {
		t.Run(name, func(t *testing.T) {
			assert.NotPanics(t, func() {
				assert.Equal(t, tc.ExpectedHTML, RenderHTML(tc.Markdown))
			})
		})
	}
}
