// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestRender_TopLevelField(t *testing.T) {
	out, err := Render(context.Background(), "text", `{{.foo}}`, map[string]any{"foo": "bar"})
	require.NoError(t, err)
	require.Equal(t, "bar", out)
}

func TestRender_NestedField(t *testing.T) {
	data := map[string]any{
		"a": map[string]any{"b": map[string]any{"c": "deep"}},
	}
	out, err := Render(context.Background(), "text", `{{.a.b.c}}`, data)
	require.NoError(t, err)
	require.Equal(t, "deep", out)
}

func TestRender_Range(t *testing.T) {
	data := map[string]any{
		"alerts": []any{
			map[string]any{"summary": "one"},
			map[string]any{"summary": "two"},
		},
	}
	out, err := Render(context.Background(), "text", `{{range .alerts}}{{.summary}}|{{end}}`, data)
	require.NoError(t, err)
	require.Equal(t, "one|two|", out)
}

func TestRender_SprigDefault(t *testing.T) {
	out, err := Render(context.Background(), "text", `{{default "fallback" .missing}}`, map[string]any{})
	require.NoError(t, err)
	require.Equal(t, "fallback", out)
}

func TestRender_SprigPipeline(t *testing.T) {
	out, err := Render(context.Background(), "text", `{{.s | upper}}`, map[string]any{"s": "hello"})
	require.NoError(t, err)
	require.Equal(t, "HELLO", out)
}

func TestRender_SprigTrunc(t *testing.T) {
	out, err := Render(context.Background(), "text", `{{.s | trunc 5}}`, map[string]any{"s": "abcdefghij"})
	require.NoError(t, err)
	require.Equal(t, "abcde", out)
}

func TestRender_EmptyTemplate(t *testing.T) {
	out, err := Render(context.Background(), "text", "", nil)
	require.NoError(t, err)
	require.Equal(t, "", out)
}

func TestRender_StaticText(t *testing.T) {
	out, err := Render(context.Background(), "text", "hello world", nil)
	require.NoError(t, err)
	require.Equal(t, "hello world", out)
}

func TestRender_DisallowedDirective(t *testing.T) {
	_, err := Render(context.Background(), "text", `{{call .Fn}}`, nil)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrDisallowedDirective))
}

func TestRender_ParseError(t *testing.T) {
	_, err := Render(context.Background(), "text", `{{`, nil)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrParse))
}

func TestRender_ExecuteError(t *testing.T) {
	// Indexing a string as if it were a map should fail at execute time.
	_, err := Render(context.Background(), "text", `{{.foo.bar}}`, map[string]any{"foo": "string"})
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrExecute))
}

func TestRender_OutputCap(t *testing.T) {
	// Render an output larger than MaxRenderedBytes via Sprig's repeat.
	_, err := Render(context.Background(), "text", `{{repeat 2000000 "x"}}`, nil)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrOutputTooLarge))
}

func TestRender_Timeout(t *testing.T) {
	// Long Sprig until-loop should exceed MaxExecutionTime.
	start := time.Now()
	_, err := Render(context.Background(), "text", `{{range until 100000000}}{{end}}`, nil)
	elapsed := time.Since(start)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrTimeout), "expected ErrTimeout, got %v", err)
	// Sanity: not pathologically longer than the limit.
	require.Less(t, elapsed, 5*time.Second, "render should bail near MaxExecutionTime, took %s", elapsed)
}

func TestRender_FieldNameSurfacedInError(t *testing.T) {
	_, err := Render(context.Background(), "username", `{{`, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "username")
}

func TestRender_RespectsParentContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := Render(ctx, "text", `{{range until 100000000}}{{end}}`, nil)
	require.Error(t, err)
	// Cancelled parent context should surface as ErrTimeout (same class).
	require.True(t, errors.Is(err, ErrTimeout) || errors.Is(err, context.Canceled),
		"expected timeout/cancellation, got %v", err)
}

func TestRender_DisallowedHidesInLongTemplate(t *testing.T) {
	tpl := strings.Repeat("x ", 1000) + `{{template "y" .}}` + strings.Repeat(" y", 1000)
	_, err := Render(context.Background(), "text", tpl, nil)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrDisallowedDirective))
}
