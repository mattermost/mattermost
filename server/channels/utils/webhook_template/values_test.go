// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRenderValues_HappyPath(t *testing.T) {
	body := []byte(`{"priority":"high","region":"eu-west-1"}`)
	templates := []ValueTemplate{
		{FieldName: "severity", Template: `{{.priority}}`},
		{FieldName: "region", Template: `{{.region | upper}}`},
	}
	got, err := RenderValues(context.Background(), body, templates, "values.")
	require.NoError(t, err)
	require.Equal(t, map[string]string{
		"severity": "high",
		"region":   "EU-WEST-1",
	}, got)
}

func TestRenderValues_EmptyTemplates(t *testing.T) {
	got, err := RenderValues(context.Background(), []byte(`{}`), nil, "")
	require.NoError(t, err)
	require.Nil(t, got)
}

func TestRenderValues_EmptyBody(t *testing.T) {
	templates := []ValueTemplate{{FieldName: "severity", Template: `{{default "low" .priority}}`}}
	got, err := RenderValues(context.Background(), nil, templates, "")
	require.NoError(t, err)
	require.Equal(t, map[string]string{"severity": "low"}, got)
}

func TestRenderValues_InvalidJSON(t *testing.T) {
	templates := []ValueTemplate{{FieldName: "severity", Template: `{{.priority}}`}}
	_, err := RenderValues(context.Background(), []byte(`not json`), templates, "")
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrInvalidJSONBody))
}

func TestRenderValues_TemplateError(t *testing.T) {
	templates := []ValueTemplate{{FieldName: "severity", Template: `{{`}}
	_, err := RenderValues(context.Background(), []byte(`{}`), templates, "values.")
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrParse))
	require.Contains(t, err.Error(), "values.severity", "error should surface the prefixed field name")
}

func TestRenderValues_FirstErrorShortCircuits(t *testing.T) {
	templates := []ValueTemplate{
		{FieldName: "ok", Template: `{{.x}}`},
		{FieldName: "bad", Template: `{{call .Fn}}`},
		{FieldName: "never", Template: `{{.y}}`},
	}
	_, err := RenderValues(context.Background(), []byte(`{"x":"a","y":"b"}`), templates, "")
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrDisallowedDirective))
}
