// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
)

// Caps applied to attachment templating to bound work per request.
const (
	// MaxAttachments is the maximum value of N accepted in
	// `attachments[N].…` (exclusive of N itself, i.e. 0..MaxAttachments-1).
	MaxAttachments = 10

	// MaxAttachmentFields is the maximum value of M accepted in
	// `attachments[N].fields[M].…` (exclusive).
	MaxAttachmentFields = 20
)

// Sentinel errors specific to attachment templating.
var (
	// ErrIndexOutOfRange is returned when an `attachments[N]` or
	// `fields[M]` index exceeds the configured caps.
	ErrIndexOutOfRange = errors.New("webhook_template: attachment/field index out of range")

	// ErrShortInvalid is returned when an `attachments[N].fields[M].short`
	// template renders to a value that does not parse as a bool.
	ErrShortInvalid = errors.New("webhook_template: short value is not a valid bool")
)

// Known top-level attachment sub-keys, mapped onto their setter.
var attachmentSubKeys = map[string]func(*model.MessageAttachment, string) error{
	"fallback":    func(a *model.MessageAttachment, v string) error { a.Fallback = v; return nil },
	"color":       func(a *model.MessageAttachment, v string) error { a.Color = v; return nil },
	"pretext":     func(a *model.MessageAttachment, v string) error { a.Pretext = v; return nil },
	"author_name": func(a *model.MessageAttachment, v string) error { a.AuthorName = v; return nil },
	"author_link": func(a *model.MessageAttachment, v string) error { a.AuthorLink = v; return nil },
	"author_icon": func(a *model.MessageAttachment, v string) error { a.AuthorIcon = v; return nil },
	"title":       func(a *model.MessageAttachment, v string) error { a.Title = v; return nil },
	"title_link":  func(a *model.MessageAttachment, v string) error { a.TitleLink = v; return nil },
	"text":        func(a *model.MessageAttachment, v string) error { a.Text = v; return nil },
	"image_url":   func(a *model.MessageAttachment, v string) error { a.ImageURL = v; return nil },
	"thumb_url":   func(a *model.MessageAttachment, v string) error { a.ThumbURL = v; return nil },
	"footer":      func(a *model.MessageAttachment, v string) error { a.Footer = v; return nil },
	"footer_icon": func(a *model.MessageAttachment, v string) error { a.FooterIcon = v; return nil },
	"timestamp":   func(a *model.MessageAttachment, v string) error { a.Timestamp = v; return nil },
}

// Known field sub-keys, mapped onto their setter.
var attachmentFieldSubKeys = map[string]func(*model.MessageAttachmentField, string) error{
	"title": func(f *model.MessageAttachmentField, v string) error { f.Title = v; return nil },
	"value": func(f *model.MessageAttachmentField, v string) error { f.Value = v; return nil },
	"short": func(f *model.MessageAttachmentField, v string) error {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("%w: %q", ErrShortInvalid, v)
		}
		f.Short = model.SlackCompatibleBool(b)
		return nil
	},
}

// AttachmentTemplate is one extracted query-param entry that targets either
// an attachment sub-field (e.g. `attachments[0].title`) or a field sub-field
// (e.g. `attachments[0].fields[2].short`).
type AttachmentTemplate struct {
	AttachmentIdx int
	IsField       bool
	FieldIdx      int
	// Field is the attachment sub-key when IsField is false (e.g. "title"),
	// or the field sub-key when IsField is true (e.g. "short").
	Field    string
	Template string
}

var (
	// `attachments[0].title` etc.
	attachmentRegex = regexp.MustCompile(`^attachments\[(\d+)\]\.([a-z_]+)$`)
	// `attachments[0].fields[1].title` etc.
	attachmentFieldRegex = regexp.MustCompile(`^attachments\[(\d+)\]\.fields\[(\d+)\]\.([a-z_]+)$`)
)

// ExtractAttachmentTemplates scans the query parameters for attachment-shaped
// keys and returns them as structured AttachmentTemplate entries. Unknown
// sub-keys are silently ignored (they look like attachment params but
// target no real attachment field). Index caps are enforced and surfaced
// as ErrIndexOutOfRange.
func ExtractAttachmentTemplates(q url.Values) ([]AttachmentTemplate, error) {
	var out []AttachmentTemplate

	for key, vals := range q {
		if len(vals) == 0 {
			continue
		}

		// Try fields first (more specific).
		if m := attachmentFieldRegex.FindStringSubmatch(key); m != nil {
			ai, _ := strconv.Atoi(m[1])
			fi, _ := strconv.Atoi(m[2])
			sub := m[3]
			if ai >= MaxAttachments {
				return nil, fmt.Errorf("%w: attachments[%d] (max %d)", ErrIndexOutOfRange, ai, MaxAttachments-1)
			}
			if fi >= MaxAttachmentFields {
				return nil, fmt.Errorf("%w: attachments[%d].fields[%d] (max %d)", ErrIndexOutOfRange, ai, fi, MaxAttachmentFields-1)
			}
			if _, known := attachmentFieldSubKeys[sub]; !known {
				continue
			}
			out = append(out, AttachmentTemplate{
				AttachmentIdx: ai,
				IsField:       true,
				FieldIdx:      fi,
				Field:         sub,
				Template:      vals[0],
			})
			continue
		}

		if m := attachmentRegex.FindStringSubmatch(key); m != nil {
			ai, _ := strconv.Atoi(m[1])
			sub := m[2]
			if ai >= MaxAttachments {
				return nil, fmt.Errorf("%w: attachments[%d] (max %d)", ErrIndexOutOfRange, ai, MaxAttachments-1)
			}
			if _, known := attachmentSubKeys[sub]; !known {
				continue
			}
			out = append(out, AttachmentTemplate{
				AttachmentIdx: ai,
				Field:         sub,
				Template:      vals[0],
			})
		}
	}

	return out, nil
}

// applyAttachmentTemplates renders each AttachmentTemplate and writes the
// result onto the payload, growing slices as needed. Fields not covered by
// a template retain whatever the typed parse populated them with.
func applyAttachmentTemplates(ctx context.Context, data any, atts []AttachmentTemplate, payload *model.IncomingWebhookRequest) error {
	for _, at := range atts {
		ensureAttachment(payload, at.AttachmentIdx)
		a := payload.Attachments[at.AttachmentIdx]

		fieldName := paramName(at)
		rendered, err := Render(ctx, fieldName, at.Template, data)
		if err != nil {
			return err
		}

		if at.IsField {
			ensureField(a, at.FieldIdx)
			if setter, ok := attachmentFieldSubKeys[at.Field]; ok {
				if err := setter(a.Fields[at.FieldIdx], rendered); err != nil {
					return err
				}
			}
			continue
		}

		if setter, ok := attachmentSubKeys[at.Field]; ok {
			if err := setter(a, rendered); err != nil {
				return err
			}
		}
	}
	return nil
}

func paramName(at AttachmentTemplate) string {
	if at.IsField {
		return fmt.Sprintf("attachments[%d].fields[%d].%s", at.AttachmentIdx, at.FieldIdx, at.Field)
	}
	return fmt.Sprintf("attachments[%d].%s", at.AttachmentIdx, at.Field)
}

// ensureAttachment grows the Attachments slice so that index `i` is valid,
// filling intermediate slots with empty *MessageAttachment values.
func ensureAttachment(payload *model.IncomingWebhookRequest, i int) {
	for len(payload.Attachments) <= i {
		payload.Attachments = append(payload.Attachments, &model.MessageAttachment{})
	}
}

// ensureField grows the Fields slice on the attachment so that index `i` is
// valid, filling intermediate slots with empty *MessageAttachmentField
// values.
func ensureField(a *model.MessageAttachment, i int) {
	for len(a.Fields) <= i {
		a.Fields = append(a.Fields, &model.MessageAttachmentField{})
	}
}
