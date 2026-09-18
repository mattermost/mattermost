// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "github.com/mattermost/mattermost/server/public/shared/i18n"

// HealthFinding is one persisted health-rule outcome.
type HealthFinding struct {
	// Fingerprint is the finding's stable identity; Code/Subject/Scope are stored
	// alongside it so the hash never has to be reversed to query or debug.
	Fingerprint string `json:"fingerprint"`
	Code        string `json:"code"`
	// Subject is what the finding is about — the config key or target, never its value.
	Subject string `json:"subject"`
	// Scope is the hostname a node-scoped finding belongs to, "" for a cluster-global one.
	Scope string `json:"scope"`

	Severity string     `json:"severity"`
	State    string     `json:"state"`
	Area     HealthArea `json:"area"`
	// Surface is the §4.9 leak boundary deciding which consumers may see this finding
	// (product page vs. CLI/support packet), not a display field.
	Surface string `json:"surface"`

	// MessageID is a translation id resolved at read time, never stored prose — evaluation
	// has no locale and one row is read by admins in several.
	MessageID string `json:"message_id"`

	// Details is render context and doubles as the interpolation params for MessageID.
	Details map[string]string `json:"details,omitempty"`

	// Summary, Remediation and Message are filled only at the API/mmctl boundary from the
	// request locale; they are always empty in a store result.
	Summary     string `json:"summary,omitempty"`
	Remediation string `json:"remediation,omitempty"`
	Message     string `json:"message,omitempty"`

	FirstSeenAt int64 `json:"first_seen_at"`
	LastSeenAt  int64 `json:"last_seen_at"`
	// StateSince is when the finding entered its current State; it backs the "stuck since"
	// trend and must not move on a same-state cycle.
	StateSince int64 `json:"state_since"`

	// ConsecutiveHits is an internal debounce counter (PR09b); never serialized or shown.
	ConsecutiveHits int `json:"-"`

	MutedAt int64  `json:"muted_at,omitempty"`
	MutedBy string `json:"muted_by,omitempty"`
}

func (f *HealthFinding) IsMuted() bool {
	return f != nil && f.MutedAt > 0
}

func (f *HealthFinding) Render(t i18n.TranslateFunc, text RuleText) *HealthFinding {
	if f == nil {
		return nil
	}

	args := make(map[string]any, len(f.Details))
	for key, value := range f.Details {
		args[key] = value
	}

	rendered := *f
	rendered.Summary = translateFindingText(t, text.SummaryID, args)
	rendered.Remediation = translateFindingText(t, text.RemediationID, args)
	rendered.Message = translateFindingText(t, f.MessageID, args)

	return &rendered
}

func translateFindingText(t i18n.TranslateFunc, id string, args map[string]any) string {
	if id == "" {
		return ""
	}

	if t == nil {
		return id
	}

	if len(args) == 0 {
		return t(id)
	}

	return t(id, args)
}

type HealthFindingFilter struct {
	Surfaces []string `json:"surfaces,omitempty"`

	IncludeMuted bool `json:"include_muted,omitempty"`
	MutedOnly    bool `json:"muted_only,omitempty"`
}
