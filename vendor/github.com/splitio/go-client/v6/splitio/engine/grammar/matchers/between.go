package matchers

import (
	"fmt"
	"github.com/splitio/go-client/v6/splitio/engine/grammar/matchers/datatypes"
	"reflect"
)

// BetweenMatcher will match if two numbers or two datetimes are equal
type BetweenMatcher struct {
	Matcher
	ComparisonDataType   string
	LowerComparisonValue int64
	UpperComparisonValue int64
}

// Match will match if the matchingValue is between lowerComparisonValue and upperComparisonValue
func (m *BetweenMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	matchingRaw, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("BetweenMatcher: Could not retrieve matching key. ", err)
		return false
	}

	var matchingValue int64
	matchingValue, okMatching := matchingRaw.(int64)
	if !okMatching {
		var asInt int
		asInt, okMatching = matchingRaw.(int)
		if okMatching {
			matchingValue = int64(asInt)
		}
	}
	if !okMatching {
		m.logger.Error(
			"BetweenMatcher: Could not parse attribute to an int. ",
			fmt.Sprintf("Attribute is of type %s\n", reflect.TypeOf(matchingRaw).String()),
		)
		return false
	}

	var comparisonLower int64
	var comparisonUpper int64
	switch m.ComparisonDataType {
	case datatypes.Number:
		comparisonLower = m.LowerComparisonValue
		comparisonUpper = m.UpperComparisonValue
	case datatypes.Datetime:
		matchingValue = datatypes.ZeroSecondsTS(matchingValue)
		comparisonLower = datatypes.ZeroSecondsTS(datatypes.TsFromJava(m.LowerComparisonValue))
		comparisonUpper = datatypes.ZeroSecondsTS(datatypes.TsFromJava(m.UpperComparisonValue))
	default:
		m.base().logger.Error(fmt.Sprintf("BetweenMatcher: Incorrect type %s", m.ComparisonDataType))
		return false
	}
	return matchingValue >= comparisonLower && matchingValue <= comparisonUpper
}

// NewBetweenMatcher returns a pointer to a new instance of BetweenMatcher
func NewBetweenMatcher(negate bool, lower int64, upper int64, cmpType string, attributeName *string) *BetweenMatcher {
	return &BetweenMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		LowerComparisonValue: lower,
		UpperComparisonValue: upper,
		ComparisonDataType:   cmpType,
	}
}
