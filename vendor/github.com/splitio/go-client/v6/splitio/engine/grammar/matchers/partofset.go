package matchers

import (
	"github.com/splitio/go-toolkit/v3/datastructures/set"
)

// PartOfSetMatcher matches if the set supplied to the getTreatment is a subset of the one in the split
type PartOfSetMatcher struct {
	Matcher
	comparisonSet *set.ThreadUnsafeSet
}

// Match returns true if the match provided is a subset of the one in the split
func (m *PartOfSetMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("PartOfSetMatcher: ", err)
		return false
	}

	conv, ok := matchingKey.([]string)
	if !ok {
		m.logger.Error("Unable to type-assert key to []string")
		return false
	}

	matchingSet := set.NewSet()
	for _, x := range conv {
		matchingSet.Add(x)
	}

	if matchingSet.IsEmpty() {
		return false
	}
	return m.comparisonSet.IsSubset(matchingSet)
}

// NewPartOfSetMatcher returns a pointer to a new instance of PartOfSetMatcher
func NewPartOfSetMatcher(negate bool, setItems []string, attributeName *string) *PartOfSetMatcher {
	setObj := set.NewSet()
	for _, item := range setItems {
		setObj.Add(item)
	}

	return &PartOfSetMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		comparisonSet: setObj,
	}
}
