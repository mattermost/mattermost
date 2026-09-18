// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "github.com/mattermost/mattermost/server/public/shared/i18n"

// HealthFinding is one persisted health-rule outcome.
type HealthFinding struct {
	Fingerprint string `json:"fingerprint"`
	Code        string `json:"code"`
	Subject     string `json:"subject"`
	Scope       string `json:"scope"`

	Severity string     `json:"severity"`
	State    string     `json:"state"`
	Area     HealthArea `json:"area"`
	Surface  string     `json:"surface"`

	MessageID string `json:"message_id"`

	Details map[string]string `json:"details,omitempty"`

	Summary     string `json:"summary,omitempty"`
	Remediation string `json:"remediation,omitempty"`
	Message     string `json:"message,omitempty"`

	FirstSeenAt int64 `json:"first_seen_at"`
	LastSeenAt  int64 `json:"last_seen_at"`
	StateSince  int64 `json:"state_since"`

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
