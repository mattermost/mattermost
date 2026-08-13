// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

// Valid: idiomatic empty string comparisons
func validEmptyStringChecks() {
	var s string

	// Valid: direct comparison with empty string
	if s == "" {
		// This is idiomatic
	}

	if s != "" {
		// This is idiomatic
	}

	str := "hello"
	if str == "" {
		// This is idiomatic
	}

	if str != "" {
		// This is idiomatic
	}
}

// Invalid: using len for empty string checks
func invalidEmptyStringChecks() {
	var s string

	// Invalid: len(s) == 0
	if len(s) == 0 { // want "calling len\\(s\\) == 0 where s is string, please use s == \\\"\\\" instead"
		// Should use s == "" instead
	}

	// Invalid: len(s) != 0
	if len(s) != 0 { // want "calling len\\(s\\) != 0 where s is string, please use s != \\\"\\\" instead"
		// Should use s != "" instead
	}

	str := "hello"

	// Invalid: len(str) == 0
	if len(str) == 0 { // want "calling len\\(s\\) == 0 where s is string, please use s == \\\"\\\" instead"
		// Should use str == "" instead
	}

	// Invalid: len(str) != 0
	if len(str) != 0 { // want "calling len\\(s\\) != 0 where s is string, please use s != \\\"\\\" instead"
		// Should use str != "" instead
	}

	// Invalid: len(s) > 0
	if len(s) > 0 { // want "calling len\\(s\\) > 0 where s is string, please use s != \\\"\\\" instead"
		// Should use s != "" instead
	}

	// Invalid: len(s) <= 0
	if len(s) <= 0 { // want "calling len\\(s\\) <= 0 where s is string, please use s == \\\"\\\" instead"
		// Should use s == "" instead
	}
}

// Valid: len for non-zero comparisons
func validLenComparisons() {
	s := "hello"

	// Valid: comparing length to non-zero values
	if len(s) == 5 {
		// This is fine
	}

	if len(s) > 5 {
		// This is fine
	}

	if len(s) < 10 {
		// This is fine
	}
}

// Valid: len for slices
func validSliceLenComparisons() {
	slice := []int{1, 2, 3}

	// Valid: len on slices (not strings)
	if len(slice) == 0 {
		// This is acceptable for slices
	}

	if len(slice) != 0 {
		// This is acceptable for slices
	}
}
