// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"slices"

	"github.com/pkg/errors"
	"golang.org/x/mod/semver"
)

const (
	AccessControlPolicyTypeParent  = "parent"
	AccessControlPolicyTypeChannel = "channel"

	MaxPolicyNameLength = 128

	AccessControlPolicyVersionV0_1 = "v0.1"
)

// AccessControlAttribute represents a user attribute with its name and possible values
type AccessControlAttribute struct {
	Attribute PropertyField `json:"attribute"`
	Values    []string      `json:"values"`
}

type AccessControlPolicyTestResponse struct {
	Users []*User `json:"users"`
	Total int64   `json:"total"`
}

type GetAccessControlPolicyOptions struct {
	Type     string                    `json:"type"`
	ParentID string                    `json:"parent_id"`
	Cursor   AccessControlPolicyCursor `json:"cursor"`
	Limit    int                       `json:"limit"`
}

type AccessControlPolicySearch struct {
	Term            string                    `json:"term"`
	Type            string                    `json:"type"`
	ParentID        string                    `json:"parent_id"`
	Cursor          AccessControlPolicyCursor `json:"cursor"`
	Limit           int                       `json:"limit"`
	IncludeChildren bool                      `json:"include_children"`
	Active          bool                      `json:"active"`
}

type AccessControlPolicyCursor struct {
	ID string `json:"id"`
}

type AccessControlPoliciesWithCount struct {
	Policies []*AccessControlPolicy `json:"policies"`
	Total    int64                  `json:"total"`
}

type AccessControlPolicy struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Active   bool   `json:"active"`
	CreateAt int64  `json:"create_at"`

	Revision int    `json:"revision"`
	Version  string `json:"version"`

	Imports []string                  `json:"imports"`
	Rules   []AccessControlPolicyRule `json:"rules"`

	Props map[string]any `json:"props"` // add auto-sync property here, also maybe the attributes being used in the expression
}

type AccessControlPolicyRule struct {
	Actions    []string `json:"actions"`
	Expression string   `json:"expression"`
}

type CELExpressionError struct {
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Message string `json:"message"`
}

type AccessControlQueryResult struct {
	MatchedSubjectIDs []string `json:"matched_subject_ids"`
}

func (p *AccessControlPolicy) IsValid() *AppError {
	switch p.Version {
	case AccessControlPolicyVersionV0_1:
		return p.accessPolicyVersionV0_1()
	default:
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.version.app_error", nil, "", 400)
	}
}

func (p *AccessControlPolicy) accessPolicyVersionV0_1() *AppError {
	if !slices.Contains([]string{AccessControlPolicyTypeParent, AccessControlPolicyTypeChannel}, p.Type) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.type.app_error", nil, "", 400)
	}

	if !IsValidId(p.ID) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.id.app_error", nil, "", 400)
	}

	if p.Type == AccessControlPolicyTypeParent && (p.Name == "" || len(p.Name) > MaxPolicyNameLength) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.name.app_error", nil, "", 400)
	}

	if p.Revision < 0 {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.revision.app_error", nil, "", 400)
	}

	if !semver.IsValid(p.Version) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.version.app_error", nil, "", 400)
	}

	switch p.Type {
	case AccessControlPolicyTypeParent:
		if len(p.Rules) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules.app_error", nil, "", 400)
		}

		if len(p.Imports) > 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypeChannel:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}

		if len(p.Rules) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules.app_error", nil, "", 400)
		}

		if len(p.Imports) > 1 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	}

	return nil
}

func (p *AccessControlPolicy) Inherit(resourceID, resourceType string) (*AccessControlPolicy, *AppError) {
	rules := make([]AccessControlPolicyRule, len(p.Rules))

	switch p.Version {
	case AccessControlPolicyVersionV0_1:
		for i, rule := range p.Rules {
			actions := make([]string, len(rule.Actions))
			copy(actions, rule.Actions)
			rules[i] = AccessControlPolicyRule{
				Actions:    actions,
				Expression: fmt.Sprintf("policies.id_%s", p.ID),
			}
		}
	default:
		return nil, NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.version.app_error", nil, "", 400)
	}

	child := &AccessControlPolicy{
		ID:       resourceID,
		Type:     resourceType,
		Active:   p.Active,
		CreateAt: GetMillis(),
		Version:  p.Version,
		Imports:  []string{p.ID},
		Rules:    rules,

		Props: map[string]any{},
	}

	if appErr := child.IsValid(); appErr != nil {
		return nil, appErr
	}

	return child, nil
}

func (c *AccessControlPolicyCursor) IsEmpty() bool {
	return c.ID == ""
}

func (c *AccessControlPolicyCursor) IsValid() error {
	if c.IsEmpty() {
		return nil
	}

	if !IsValidId(c.ID) {
		return errors.New("cursor id is invalid")
	}

	return nil
}

func (p *AccessControlPolicy) Auditable() map[string]any {
	return map[string]any{
		"id":       p.ID,
		"type":     p.Type,
		"revision": p.Revision,
	}
}
