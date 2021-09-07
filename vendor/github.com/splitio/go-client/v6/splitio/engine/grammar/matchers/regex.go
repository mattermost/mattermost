package matchers

import (
	"reflect"
	"regexp"
)

// RegexMatcher matches if the supplied key matches the split's regex
type RegexMatcher struct {
	Matcher
	regex string
}

// Match returns true if the supplied key matches the split's regex
func (m *RegexMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("RegexMatcher: ", err)
		return false
	}

	conv, ok := matchingKey.(string)
	if !ok {
		m.logger.Error(
			"RegexMatcher: Incorrect type. Expected string and received ",
			reflect.TypeOf(matchingKey).String(),
		)
		return false
	}

	re, err := regexp.Compile(m.regex)
	if err != nil {
		m.logger.Error("RegexMatcher: Failed to compile regexp. ", err)
		return false
	}
	return re.MatchString(conv)
}

// NewRegexMatcher returns a new instance to a RegexMatcher
func NewRegexMatcher(negate bool, regex string, attributeName *string) *RegexMatcher {
	return &RegexMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		regex: regex,
	}
}
