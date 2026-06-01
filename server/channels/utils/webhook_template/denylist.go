// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"errors"
	"regexp"
)

// ErrDisallowedDirective is returned by AssertNoDisallowedDirectives when a
// template contains a directive that could break out of the safe subset.
var ErrDisallowedDirective = errors.New("webhook_template: disallowed directive")

// disallowedDirectives matches Go-template actions that invoke a function
// value, reference a defined template by name, or define a new template.
// These are forbidden because they would let a webhook caller escape the
// safe text/template subset (Sprig + field access) we intend to expose.
//
// The regex matches the opening `{{` (optionally followed by the `-` trim
// marker and any whitespace), then one of the reserved keywords, followed by
// a word boundary so identifiers like `.template`, `calling`, or
// `definedBy` are not flagged.
var disallowedDirectives = regexp.MustCompile(`\{\{-?\s*(call|template|define)\b`)

// AssertNoDisallowedDirectives returns ErrDisallowedDirective if the template
// string contains any forbidden action. Otherwise it returns nil.
func AssertNoDisallowedDirectives(tpl string) error {
	if disallowedDirectives.MatchString(tpl) {
		return ErrDisallowedDirective
	}
	return nil
}
