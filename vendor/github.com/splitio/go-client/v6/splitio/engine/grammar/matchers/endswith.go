package matchers

import (
	"strings"
)

// EndsWithMatcher matches strings which end with one of the suffixes in the split
type EndsWithMatcher struct {
	Matcher
	suffixes []string
}

// Match returns true if the key provided ends with one of the suffixes in the split.
func (m *EndsWithMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("EndsWithMatcher: ", err)
		return false
	}

	asString, ok := matchingKey.(string)
	if !ok {
		m.logger.Error("EndsWithMatcher: Error type-asserting string")
		return false
	}

	for _, suffix := range m.suffixes {
		if strings.HasSuffix(asString, suffix) {
			return true
		}
	}

	return false
}

// NewEndsWithMatcher returns a new instance of EndsWithMatcher
func NewEndsWithMatcher(negate bool, suffixes []string, attributeName *string) *EndsWithMatcher {
	return &EndsWithMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		suffixes: suffixes,
	}
}
