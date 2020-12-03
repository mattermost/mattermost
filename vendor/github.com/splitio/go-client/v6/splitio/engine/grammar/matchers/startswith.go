package matchers

import (
	"strings"
)

// StartsWithMatcher matches strings which start with one of the prefixes in the split
type StartsWithMatcher struct {
	Matcher
	prefixes []string
}

// Match returns true if the key provided starts with one of the prefixes in the split.
func (m *StartsWithMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("StartsWithMatcher: ", err)
		return false
	}

	asString, ok := matchingKey.(string)
	if !ok {
		m.logger.Error("StartsWithMatcher: Failed to type-assert key to string")
		return false
	}

	for _, prefix := range m.prefixes {
		if strings.HasPrefix(asString, prefix) {
			return true
		}
	}

	return false
}

// NewStartsWithMatcher returns a new instance of StartsWithMatcher
func NewStartsWithMatcher(negate bool, prefixes []string, attributeName *string) *StartsWithMatcher {
	return &StartsWithMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		prefixes: prefixes,
	}
}
