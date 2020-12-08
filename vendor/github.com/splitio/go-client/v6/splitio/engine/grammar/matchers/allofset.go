package matchers

import (
	"fmt"
	"github.com/splitio/go-toolkit/v3/datastructures/set"
	"reflect"
)

// ContainsAllOfSetMatcher matches if the set supplied to the getTreatment is a superset of the one in the split
type ContainsAllOfSetMatcher struct {
	Matcher
	comparisonSet *set.ThreadUnsafeSet
}

// Match returns true if the set provided is a superset of the one in the split
func (m *ContainsAllOfSetMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingKey, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("AllOfSetMatcher: ", err)
		return false
	}

	conv, ok := matchingKey.([]string)
	if !ok {
		m.logger.Error(
			"AllOfSetMatcher: Attribute passed is not a slice of strings. ",
			fmt.Sprintf("Key is of type %s\n", reflect.TypeOf(matchingKey).String()),
		)
		return false
	}

	matchingSet := set.NewSet()
	for _, x := range conv {
		matchingSet.Add(x)
	}

	res := m.comparisonSet.IsSuperset(matchingSet)
	return res

}

// NewContainsAllOfSetMatcher returns a pointer to a new instance of ContainsAllOfSetMatcher
func NewContainsAllOfSetMatcher(negate bool, setItems []string, attributeName *string) *ContainsAllOfSetMatcher {
	setObj := set.NewSet()
	for _, item := range setItems {
		setObj.Add(item)
	}

	return &ContainsAllOfSetMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		comparisonSet: setObj,
	}
}
