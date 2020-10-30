package matchers

import (
	"github.com/splitio/go-toolkit/v3/datastructures/set"
)

// WhitelistMatcher matches if the key received is present in the matcher's whitelist
type WhitelistMatcher struct {
	Matcher
	whitelist *set.ThreadUnsafeSet
}

// Match returns true if the key is present in the whitelist.
func (m *WhitelistMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("WhitelistMatcher: ", err)
		return false
	}

	stringMatchingKey, ok := matchingKey.(string)
	if !ok {
		m.logger.Error("WhitelistMatcher: Cannot type-assert key to string")
		return false
	}

	return m.whitelist.Has(stringMatchingKey)
}

// NewWhitelistMatcher returns a new WhitelistMatcher
func NewWhitelistMatcher(negate bool, whitelist []string, attributeName *string) *WhitelistMatcher {
	wlSet := set.NewSet()
	for _, elem := range whitelist {
		wlSet.Add(elem)
	}
	return &WhitelistMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		whitelist: wlSet,
	}
}
