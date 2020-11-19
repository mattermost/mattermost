package matchers

import (
	"github.com/splitio/go-toolkit/v3/datastructures/set"
)

// ContainsAnyOfSetMatcher matches if the set supplied to the getTreatment is a superset of the one in the split
type ContainsAnyOfSetMatcher struct {
	Matcher
	comparisonSet *set.ThreadUnsafeSet
}

// Match returns true if the set provided is a superset of the one in the split
func (m *ContainsAnyOfSetMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("AnyOfSetMatcher: ", err)
		return false
	}

	conv, ok := matchingKey.([]string)
	if !ok {
		m.logger.Error("AnyOfSetMatcher: Failed to parse the key as a []string")
		return false
	}

	matchingSet := set.NewSet()
	for _, x := range conv {
		matchingSet.Add(x)
	}

	intersection := set.Intersection(matchingSet, m.comparisonSet)

	return intersection.Size() > 0
}

// NewContainsAnyOfSetMatcher returns a pointer to a new instance of ContainsAnyOfSetMatcher
func NewContainsAnyOfSetMatcher(negate bool, setItems []string, attributeName *string) *ContainsAnyOfSetMatcher {
	setObj := set.NewSet()
	for _, item := range setItems {
		setObj.Add(item)
	}

	return &ContainsAnyOfSetMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		comparisonSet: setObj,
	}
}
