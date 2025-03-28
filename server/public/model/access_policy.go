// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"slices"

	"golang.org/x/mod/semver"
)

const (
	AccessControlPolicyTypeParent  = "parent"
	AccessControlPolicyTypeChannel = "channel"

	MaxPolicyNameLength = 128

	AccessControlPolicyVersionV0_1 = "v0.1"
)

// ParentPolicy is a augmented version of AccessPolicy to be used in
// system console and API responses.
type ParentPolicy struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Attributes map[string]string      `json:"attributes"`
	Children   []*AccessControlPolicy `json:"children"`
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
