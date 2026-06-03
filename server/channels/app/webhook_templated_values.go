// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// coerceTemplatedValue translates a rendered template string into the
// canonical JSON shape stored on a PropertyValue, dispatching on the
// PropertyField type:
//
//   - text       → bare JSON string
//   - select     → bare JSON string of the resolved option ID
//   - multiselect→ JSON array of resolved option IDs (comma-split tokens)
//   - date       → ISO-8601 string (RFC3339 normalised)
//   - user       → bare JSON string of the resolved user ID
//   - multiuser  → JSON array of resolved user IDs (comma-split tokens)
//
// The coercer never returns a *model.AppError — every type-coercion or
// resolution failure (unknown option, missing user, unparseable date,
// unsupported field type) is logged at warn level and reported via
// ok=false, prompting the caller to skip this field. This mirrors the
// "drop the value, keep the post" policy used for unknown property field
// names: producer-side mistakes do not fail the surrounding webhook.
func (a *App) coerceTemplatedValue(rctx request.CTX, field *model.PropertyField, rendered, channelID, postID string) (json.RawMessage, bool) {
	logSkip := func(reason string, extra ...mlog.Field) {
		base := []mlog.Field{
			mlog.String("field_name", field.Name),
			mlog.String("field_type", string(field.Type)),
			mlog.String("channel_id", channelID),
			mlog.String("post_id", postID),
			mlog.String("reason", reason),
		}
		rctx.Logger().Warn("Discarding templated property value", append(base, extra...)...)
	}

	switch field.Type {
	case model.PropertyFieldTypeText:
		return mustJSON(rendered), true

	case model.PropertyFieldTypeSelect:
		if rendered == "" {
			logSkip("empty rendered value")
			return nil, false
		}
		optionID, found := resolveOption(field, rendered)
		if !found {
			logSkip("unknown option", mlog.String("option_token", rendered))
			return nil, false
		}
		return mustJSON(optionID), true

	case model.PropertyFieldTypeMultiselect:
		tokens := splitTrim(rendered)
		if len(tokens) == 0 {
			// Templated empty list is a legitimate "clear all" instruction.
			return mustJSON([]string{}), true
		}
		ids := make([]string, 0, len(tokens))
		for _, tok := range tokens {
			if optionID, found := resolveOption(field, tok); found {
				ids = append(ids, optionID)
			} else {
				logSkip("unknown option in multiselect", mlog.String("option_token", tok))
			}
		}
		if len(ids) == 0 {
			logSkip("no recognised options in multiselect")
			return nil, false
		}
		return mustJSON(ids), true

	case model.PropertyFieldTypeDate:
		if rendered == "" {
			logSkip("empty rendered date")
			return nil, false
		}
		parsed, err := parseFlexibleDate(rendered)
		if err != nil {
			logSkip("date parse failed", mlog.String("rendered", rendered), mlog.Err(err))
			return nil, false
		}
		return mustJSON(parsed.Format(time.RFC3339)), true

	case model.PropertyFieldTypeUser:
		if rendered == "" {
			logSkip("empty rendered user")
			return nil, false
		}
		userID, ok := a.resolveUser(rctx, rendered)
		if !ok {
			logSkip("unknown user", mlog.String("user_token", rendered))
			return nil, false
		}
		return mustJSON(userID), true

	case model.PropertyFieldTypeMultiuser:
		tokens := splitTrim(rendered)
		if len(tokens) == 0 {
			return mustJSON([]string{}), true
		}
		ids := make([]string, 0, len(tokens))
		for _, tok := range tokens {
			if id, ok := a.resolveUser(rctx, tok); ok {
				ids = append(ids, id)
			} else {
				logSkip("unknown user in multiuser", mlog.String("user_token", tok))
			}
		}
		if len(ids) == 0 {
			logSkip("no recognised users in multiuser")
			return nil, false
		}
		return mustJSON(ids), true

	default:
		logSkip("unsupported field type")
		return nil, false
	}
}

// resolveOption returns the canonical option ID for a token against a
// select/multiselect field's option list. The token matches either an
// existing option ID (exact, case-sensitive) or an existing option name
// (case-insensitive). Returns ("", false) when no option matches.
func resolveOption(field *model.PropertyField, token string) (string, bool) {
	type rawOption struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	opts, err := model.NewPropertyOptionsFromFieldAttrs[*model.PluginPropertyOption](field.Attrs[model.PropertyFieldAttributeOptions])
	if err != nil {
		// Field declared options that don't decode into the generic form;
		// fall back to a manual decode so we can still match by id/name.
		raw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
		if !ok {
			return "", false
		}
		b, mErr := json.Marshal(raw)
		if mErr != nil {
			return "", false
		}
		var arr []rawOption
		if jErr := json.Unmarshal(b, &arr); jErr != nil {
			return "", false
		}
		token = strings.TrimSpace(token)
		for _, o := range arr {
			if o.ID == token || strings.EqualFold(o.Name, token) {
				return o.ID, true
			}
		}
		return "", false
	}
	token = strings.TrimSpace(token)
	for _, o := range opts {
		if o.GetID() == token || strings.EqualFold(o.GetName(), token) {
			return o.GetID(), true
		}
	}
	return "", false
}

// splitTrim splits s on commas, trims whitespace around each token, and
// drops empties. Used for multiselect/multiuser inputs.
func splitTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t == "" {
			continue
		}
		out = append(out, t)
	}
	return out
}

// parseFlexibleDate accepts the two most common templated-date shapes —
// full RFC3339 timestamps like "2026-01-15T09:30:00Z" and bare ISO dates
// like "2026-01-15" — and normalises the result to RFC3339 (UTC) so the
// stored PropertyValue has a single shape regardless of caller input.
func parseFlexibleDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UTC(), nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t.UTC(), nil
	}
	return time.Time{}, fmt.Errorf("date %q is neither RFC3339 nor YYYY-MM-DD", s)
}

// resolveUser maps a rendered token to a Mattermost user ID. A token that
// already looks like a 26-char Mattermost ID is passed through unchanged;
// any other token is looked up as a username. Missing users return
// ("", false) without surfacing the underlying lookup error, so callers
// can apply the same warn-and-discard policy used for other unresolved
// targets.
func (a *App) resolveUser(rctx request.CTX, token string) (string, bool) {
	token = strings.TrimSpace(token)
	if token == "" {
		return "", false
	}
	if model.IsValidId(token) {
		// Treat a 26-char Mattermost ID as authoritative; do not verify
		// the user actually exists here. Downstream visibility checks
		// (e.g. on read) will continue to apply.
		return token, true
	}
	user, appErr := a.GetUserByUsername(token)
	if appErr != nil || user == nil {
		// Anything that isn't a clean lookup is a "missing user" from
		// the templating layer's perspective. We deliberately do not
		// distinguish "not found" from other errors so a transient DB
		// blip can't accidentally write a stale ID; both are dropped
		// and logged.
		return "", false
	}
	return user.Id, true
}

// mustJSON marshals v to a json.RawMessage. The inputs we feed it are
// strings or []string, neither of which can fail json.Marshal in practice;
// any failure here would indicate a programming error, not bad data, so
// we surface it via an empty RawMessage rather than propagate an error
// through every call site. UpsertPropertyValues would reject an empty
// value, so a bug surfaces immediately rather than silently.
func mustJSON(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage{}
	}
	return b
}
