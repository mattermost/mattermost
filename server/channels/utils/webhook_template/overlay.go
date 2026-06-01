// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"

	"github.com/mattermost/mattermost/server/public/model"
)

// ErrInvalidJSONBody is returned by Apply when the request body is non-empty
// but cannot be decoded as JSON. The typed parse path may have already
// succeeded (it ignores unknown fields), but the templating overlay needs
// the body as a generic map.
var ErrInvalidJSONBody = errors.New("webhook_template: body is not valid JSON")

// Apply renders the templates carried by the query parameters against the
// request body bytes and overwrites the corresponding fields on payload.
//
// Pre-conditions:
//
//   - The caller has already determined that templating should engage
//     (feature flag on, gate truthy, content-type compatible).
//   - body is the raw request body (may be empty). Apply tolerates an empty
//     body by treating the data context as an empty map.
//
// If no templating query params are present, Apply is a no-op and returns
// nil. Any rendering error is returned wrapped around a sentinel from the
// `Err*` family (ErrInvalidJSONBody, ErrParse, ErrExecute, ErrTimeout,
// ErrOutputTooLarge, ErrDisallowedDirective).
func Apply(ctx context.Context, body []byte, q url.Values, payload *model.IncomingWebhookRequest) error {
	scalars := ExtractScalars(q)
	atts, err := ExtractAttachmentTemplates(q)
	if err != nil {
		return err
	}
	if !scalars.Any() && len(atts) == 0 {
		return nil
	}

	data, err := decodeBody(body)
	if err != nil {
		return err
	}

	if scalars.TextPresent {
		s, err := Render(ctx, paramText, scalars.Text, data)
		if err != nil {
			return err
		}
		payload.Text = s
	}
	if scalars.UsernamePresent {
		s, err := Render(ctx, paramUsername, scalars.Username, data)
		if err != nil {
			return err
		}
		payload.Username = s
	}
	if scalars.IconURLPresent {
		s, err := Render(ctx, paramIconURL, scalars.IconURL, data)
		if err != nil {
			return err
		}
		payload.IconURL = s
	}
	if scalars.IconEmojiPresent {
		s, err := Render(ctx, paramIconEmoji, scalars.IconEmoji, data)
		if err != nil {
			return err
		}
		payload.IconEmoji = s
	}
	if scalars.ChannelPresent {
		s, err := Render(ctx, paramChannel, scalars.Channel, data)
		if err != nil {
			return err
		}
		payload.ChannelName = s
	}
	if scalars.PriorityPresent {
		s, err := Render(ctx, paramPriority, scalars.Priority, data)
		if err != nil {
			return err
		}
		if s == "" {
			// Empty rendered priority clears the field.
			payload.Priority = nil
		} else {
			rendered := s
			payload.Priority = &model.PostPriority{Priority: &rendered}
		}
	}

	if err := applyAttachmentTemplates(ctx, data, atts, payload); err != nil {
		return err
	}

	return nil
}

// decodeBody parses raw body bytes into a generic JSON map suitable as a
// text/template data context. An empty body decodes to an empty map (so
// `{{default "x" .y}}` works without a body). Non-empty bodies that fail to
// parse return ErrInvalidJSONBody wrapping the underlying decode error.
func decodeBody(body []byte) (map[string]any, error) {
	data := map[string]any{}
	if len(body) == 0 {
		return data, nil
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSONBody, err)
	}
	return data, nil
}
