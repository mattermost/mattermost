// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"context"
	"fmt"
)

// RenderValues renders each ValueTemplate against the JSON body and returns a
// map keyed by field name. An empty or nil body decodes to an empty data
// context; templates that reference missing keys then render to the
// stdlib/Sprig fallback (empty string or `default` value, as configured by
// the caller).
//
// Each template carries the per-field cost-limits enforced by Render
// (denylist, output cap, execution timeout). The first error short-circuits
// the loop — no partial writes ever reach the property store.
//
// fieldNamePrefix is prepended to the field name passed to Render so that
// errors surface the original query-parameter name (e.g. "values.severity")
// rather than just the field. Pass an empty string to use the bare name.
func RenderValues(ctx context.Context, body []byte, templates []ValueTemplate, fieldNamePrefix string) (map[string]string, error) {
	if len(templates) == 0 {
		return nil, nil
	}

	data, err := decodeBody(body)
	if err != nil {
		return nil, err
	}

	out := make(map[string]string, len(templates))
	for _, t := range templates {
		fieldName := t.FieldName
		if fieldNamePrefix != "" {
			fieldName = fmt.Sprintf("%s%s", fieldNamePrefix, t.FieldName)
		}
		s, err := Render(ctx, fieldName, t.Template, data)
		if err != nil {
			return nil, err
		}
		out[t.FieldName] = s
	}
	return out, nil
}
