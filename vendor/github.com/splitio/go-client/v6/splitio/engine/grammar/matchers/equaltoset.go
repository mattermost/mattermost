package matchers

import (
	"github.com/splitio/go-toolkit/v3/datastructures/set"
)

// EqualToSetMatcher matches if the set supplied to the getTreatment is equal to the one in the split
type EqualToSetMatcher struct {
	Matcher
	comparisonSet *set.ThreadUnsafeSet
}

// Match returns true if the match provided and the one in the split are equal
func (m *EqualToSetMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("EqualToSetMatcher: ", err)
		return false
	}

	conv, ok := matchingKey.([]string)
	if !ok {
		m.logger.Error("EqualToSetMatcher: Cannot type assert to []string")
		return false
	}

	matchingSet := set.NewSet()
	for _, x := range conv {
		matchingSet.Add(x)
	}

	return matchingSet.IsEqual(m.comparisonSet)

}

// NewEqualToSetMatcher returns a pointer to a new instance of EqualToSetMatcher
func NewEqualToSetMatcher(negate bool, setItems []string, attributeName *string) *EqualToSetMatcher {
	setObj := set.NewSet()
	for _, item := range setItems {
		setObj.Add(item)
	}

	return &EqualToSetMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		comparisonSet: setObj,
	}
}
