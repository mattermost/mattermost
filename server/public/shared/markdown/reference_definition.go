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

	// normalizedLabel is the form the label is matched in. It is computed once when the
	// definition is read rather than every time a reference is resolved against it.
	normalizedLabel string

	// index is the label index covering the definitions this one was collected with, giving a
	// lookup a way to reach the index from any definition it holds.
	index *referenceIndex
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

// referenceIndex maps normalized labels to the definition that claims them. It is built once for
// a set of definitions so that resolving a label costs a map lookup rather than a walk over every
// definition, which would pair each reference in a document with each definition in it.
type referenceIndex struct {
	definitions []*ReferenceDefinition
	byLabel     map[string]*ReferenceDefinition
}

func newReferenceIndex(definitions []*ReferenceDefinition) *referenceIndex {
	byLabel := make(map[string]*ReferenceDefinition, len(definitions))
	for _, definition := range definitions {
		// A label several definitions share belongs to the first of them.
		if _, ok := byLabel[definition.normalizedLabel]; !ok {
			byLabel[definition.normalizedLabel] = definition
		}
	}
	return &referenceIndex{
		definitions: definitions,
		byLabel:     byLabel,
	}
}

// covers reports whether definitions holds exactly what the index was built from. Only a slice of
// the same length over the same backing array does, so anything a caller assembled itself needs
// an index of its own.
func (i *referenceIndex) covers(definitions []*ReferenceDefinition) bool {
	if len(i.definitions) != len(definitions) {
		return false
	}
	return len(definitions) == 0 || &i.definitions[0] == &definitions[0]
}

func (i *referenceIndex) lookup(label string) *ReferenceDefinition {
	return i.byLabel[normalizeReferenceLabel(label)]
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
	rawLabel := raw[label.Position:label.End]
	ret := &ReferenceDefinition{
		RawDestination:  Range{absoluteDestination, absoluteDestination + destination.End - destination.Position},
		markdown:        markdown,
		rawLabel:        rawLabel,
		normalizedLabel: normalizeReferenceLabel(rawLabel),
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
			ret.rawTitle = raw[title.Position:title.End]
			return ret, nextLine
		}
	}

	if nextLine, skippedNonWhitespace := nextLine(raw, position); !skippedNonWhitespace {
		return ret, nextLine
	}

	return nil, 0
}
