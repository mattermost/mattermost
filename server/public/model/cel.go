// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ValueType indicates whether a value is a literal or another attribute.
type ValueType int

const (
	LiteralValue ValueType = iota
	AttrValue
)

// Condition represents a single logical condition (e.g., user.attributes.Team == "Engineering").
type Condition struct {
	// Left-hand side attribute selector (e.g., "user.attributes.Team").
	Attribute string `json:"attribute"`
	// The comparison operator.
	Operator string `json:"operator"`
	// Right-hand side value(s). Can be a single value or a slice for 'in'.
	Value any `json:"value"`
	// Type of the Value (LiteralValue or AttributeValue). Needed for comparisons like user.attr1 == user.attr2.
	ValueType ValueType `json:"value_type"`
}

// VisualExpression represents a series of conditions combined with logical AND.
type VisualExpression struct {
	// Conditions is a list of individual conditions that will be ANDed together.
	Conditions []Condition `json:"conditions"`
}
