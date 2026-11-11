// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
	"unicode"
)

type ReferenceDefinition struct {
	RawDestination Range

	markdown string
	rawLabel string
	rawTitle string
}

func (d *ReferenceDefinition) Destination() string {
	return Unescape(d.markdown[d.RawDestination.Position:d.RawDestination.End])
}

func (d *ReferenceDefinition) Label() string {
	return d.rawLabel
}

func (d *ReferenceDefinition) Title() string {
	return Unescape(d.rawTitle)
}

// ReferenceDefinitions holds the reference definitions of a parsed document, indexed by
// normalized label so that resolving a reference costs a map lookup rather than a walk over every
// definition. A nil *ReferenceDefinitions holds no definitions.
type ReferenceDefinitions struct {
	byLabel map[string]*ReferenceDefinition
}

// add keeps definition unless an earlier definition already claims its label.
func (d *ReferenceDefinitions) add(definition *ReferenceDefinition) {
	label := normalizeReferenceLabel(definition.rawLabel)
	if _, ok := d.byLabel[label]; ok {
		return
	}
	if d.byLabel == nil {
		d.byLabel = make(map[string]*ReferenceDefinition)
	}
	d.byLabel[label] = definition
}

func (d *ReferenceDefinitions) lookup(label string) *ReferenceDefinition {
	if d == nil {
		return nil
	}
	return d.byLabel[normalizeReferenceLabel(label)]
}

// normalizeReferenceLabel returns the form labels are matched in: runs of whitespace collapsed to
// a single space, and every rune replaced by the smallest rune it is case equivalent to. Two
// labels have equal normalized forms exactly when strings.EqualFold reports them equal once their
// whitespace is collapsed, which is what lets the form serve as a map key.
func normalizeReferenceLabel(label string) string {
	var sb strings.Builder
	sb.Grow(len(label))

	pendingSpace := false
	for _, r := range label {
		if unicode.IsSpace(r) {
			pendingSpace = sb.Len() > 0
			continue
		}
		if pendingSpace {
			sb.WriteByte(' ')
			pendingSpace = false
		}
		sb.WriteRune(caseFoldRune(r))
	}

	return sb.String()
}

// caseFoldRune returns the smallest rune r is case equivalent to under Unicode simple case
// folding. Every rune of an equivalence class maps to the same one, so folding two runes tells
// them apart exactly when they belong to different classes.
func caseFoldRune(r rune) rune {
	smallest := r
	for folded := unicode.SimpleFold(r); folded != r; folded = unicode.SimpleFold(folded) {
		if folded < smallest {
			smallest = folded
		}
	}
	return smallest
}

// parseReferenceDefinition reads one reference definition from the start of raw, which holds the
// text ranges covers. It reports how many bytes of raw the definition takes up, so that a caller
// reading a run of definitions can move an offset along raw instead of joining what is left of
// the ranges again for each one.
func parseReferenceDefinition(markdown, raw string, ranges []Range) (*ReferenceDefinition, int) {
	label, next, ok := parseLinkLabel(raw, 0)
	if !ok {
		return nil, 0
	}
	position := next

	if position >= len(raw) || raw[position] != ':' {
		return nil, 0
	}
	position++

	destination, next, ok := parseLinkDestination(raw, nextNonWhitespace(raw, position))
	if !ok {
		return nil, 0
	}
	position = next

	absoluteDestination := relativeToAbsolutePosition(ranges, destination.Position)
	ret := &ReferenceDefinition{
		RawDestination: Range{absoluteDestination, absoluteDestination + destination.End - destination.Position},
		markdown:       markdown,
		rawLabel:       strings.Clone(raw[label.Position:label.End]),
	}

	if position < len(raw) && isWhitespaceByte(raw[position]) {
		title, next, ok := parseLinkTitle(raw, nextNonWhitespace(raw, position))
		if !ok {
			if nextLine, skippedNonWhitespace := nextLine(raw, position); !skippedNonWhitespace {
				return ret, nextLine
			}
			return nil, 0
		}
		if nextLine, skippedNonWhitespace := nextLine(raw, next); !skippedNonWhitespace {
			ret.rawTitle = strings.Clone(raw[title.Position:title.End])
			return ret, nextLine
		}
	}

	if nextLine, skippedNonWhitespace := nextLine(raw, position); !skippedNonWhitespace {
		return ret, nextLine
	}

	return nil, 0
}
