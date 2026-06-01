// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsGateTruthy(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  bool
	}{
		{"template=1", "template=1", true},
		{"template=yes", "template=yes", true},
		{"template=true", "template=true", true},
		{"template=YES", "template=YES", true},
		{"template=True", "template=True", true},
		{"template=TRUE", "template=TRUE", true},
		{"tmpl=1", "tmpl=1", true},
		{"tmpl=yes", "tmpl=yes", true},
		{"tmpl=true", "tmpl=true", true},
		{"absent", "", false},
		{"template=0", "template=0", false},
		{"template=false", "template=false", false},
		{"template=no", "template=no", false},
		{"template=", "template=", false},
		{"template=junk", "template=junk", false},
		{"both, one truthy", "template=0&tmpl=1", true},
		{"both, neither truthy", "template=0&tmpl=no", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q, err := url.ParseQuery(tt.query)
			require.NoError(t, err)
			require.Equal(t, tt.want, IsGateTruthy(q))
		})
	}
}

func TestExtractTextTemplate(t *testing.T) {
	t.Run("present", func(t *testing.T) {
		q := url.Values{"text": []string{`{{.summary}}`}}
		tpl, ok := ExtractTextTemplate(q)
		require.True(t, ok)
		require.Equal(t, `{{.summary}}`, tpl)
	})
	t.Run("absent", func(t *testing.T) {
		q := url.Values{}
		_, ok := ExtractTextTemplate(q)
		require.False(t, ok)
	})
	t.Run("empty value is still present", func(t *testing.T) {
		q := url.Values{"text": []string{""}}
		tpl, ok := ExtractTextTemplate(q)
		require.True(t, ok)
		require.Equal(t, "", tpl)
	})
}

func TestExtractScalars(t *testing.T) {
	t.Run("none", func(t *testing.T) {
		s := ExtractScalars(url.Values{})
		require.False(t, s.Any())
	})

	t.Run("each scalar field", func(t *testing.T) {
		q := url.Values{
			"text":       []string{`{{.t}}`},
			"username":   []string{`{{.u}}`},
			"icon_url":   []string{`{{.iu}}`},
			"icon_emoji": []string{`{{.ie}}`},
			"channel":    []string{`{{.c}}`},
			"priority":   []string{`{{.p}}`},
		}
		s := ExtractScalars(q)
		require.True(t, s.Any())
		require.True(t, s.TextPresent)
		require.Equal(t, `{{.t}}`, s.Text)
		require.True(t, s.UsernamePresent)
		require.Equal(t, `{{.u}}`, s.Username)
		require.True(t, s.IconURLPresent)
		require.Equal(t, `{{.iu}}`, s.IconURL)
		require.True(t, s.IconEmojiPresent)
		require.Equal(t, `{{.ie}}`, s.IconEmoji)
		require.True(t, s.ChannelPresent)
		require.Equal(t, `{{.c}}`, s.Channel)
		require.True(t, s.PriorityPresent)
		require.Equal(t, `{{.p}}`, s.Priority)
	})

	t.Run("partial subset", func(t *testing.T) {
		q := url.Values{
			"text":     []string{`hi`},
			"priority": []string{`2`},
		}
		s := ExtractScalars(q)
		require.True(t, s.Any())
		require.True(t, s.TextPresent)
		require.False(t, s.UsernamePresent)
		require.False(t, s.IconURLPresent)
		require.False(t, s.IconEmojiPresent)
		require.False(t, s.ChannelPresent)
		require.True(t, s.PriorityPresent)
	})

	t.Run("empty value still present", func(t *testing.T) {
		q := url.Values{"username": []string{""}}
		s := ExtractScalars(q)
		require.True(t, s.UsernamePresent)
		require.Equal(t, "", s.Username)
	})
}

func TestExtractValueTemplates(t *testing.T) {
	t.Run("simple field", func(t *testing.T) {
		q := url.Values{"values.severity": []string{`{{.p}}`}}
		got := ExtractValueTemplates(q)
		require.Len(t, got, 1)
		require.Equal(t, "severity", got[0].FieldName)
		require.Equal(t, `{{.p}}`, got[0].Template)
	})

	t.Run("dashes and underscores accepted", func(t *testing.T) {
		q := url.Values{
			"values.dash-name":   []string{`a`},
			"values.under_score": []string{`b`},
			"values._leading":    []string{`c`},
			"values.MixedCase":   []string{`d`},
			"values.123":         []string{`e`},
		}
		got := ExtractValueTemplates(q)
		require.Len(t, got, 5)
	})

	t.Run("invalid names ignored", func(t *testing.T) {
		q := url.Values{
			"values.-leading-dash":          []string{`x`},
			"values.has.dot":                []string{`x`},
			"values.has space":              []string{`x`},
			"values.":                       []string{`x`},
			"values.a/b":                    []string{`x`},
			"values." + strings.Repeat("a", 100): []string{`x`}, // > 63 chars
			"notvalues.foo":                 []string{`x`},
		}
		got := ExtractValueTemplates(q)
		require.Empty(t, got)
	})

	t.Run("multiple fields plus unrelated params", func(t *testing.T) {
		q := url.Values{
			"values.severity": []string{`{{.s}}`},
			"values.region":   []string{`{{.r}}`},
			"text":            []string{`{{.summary}}`},
			"template":        []string{`1`},
		}
		got := ExtractValueTemplates(q)
		require.Len(t, got, 2)
	})

	t.Run("no value params", func(t *testing.T) {
		q := url.Values{"template": []string{`1`}, "text": []string{`x`}}
		got := ExtractValueTemplates(q)
		require.Empty(t, got)
	})
}
