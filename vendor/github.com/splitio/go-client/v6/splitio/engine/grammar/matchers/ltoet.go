package matchers

import (
	"github.com/splitio/go-client/v6/splitio/engine/grammar/matchers/datatypes"
)

// LessThanOrEqualToMatcher will match if two numbers or two datetimes are equal
type LessThanOrEqualToMatcher struct {
	Matcher
	ComparisonDataType string
	ComparisonValue    int64
}

// Match will match if the comparisonValue is less than or equal to the matchingValue
func (m *LessThanOrEqualToMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {

	matchingRaw, err := m.matchingKey(key, attributes)
	if err != nil {
		m.logger.Error("LessThanOrEqualToMatcher: ", err)
		return false
	}

	matchingValue, ok := matchingRaw.(int64)
	if !ok {
		var asInt int
		asInt, ok = matchingRaw.(int)
		if ok {
			matchingValue = int64(asInt)
		}
	}
	if !ok {
		m.logger.Error("LessThanOrEqualToMatcher: Unable to type-assert key to int")
		return false
	}

	var comparisonValue int64
	switch m.ComparisonDataType {
	case datatypes.Number:
		comparisonValue = m.ComparisonValue
	case datatypes.Datetime:
		matchingValue = datatypes.ZeroSecondsTS(matchingValue)
		comparisonValue = datatypes.ZeroSecondsTS(datatypes.TsFromJava(m.ComparisonValue))
	default:
		m.logger.Error("LessThanOrEqualToMatcher: Incorrect data type")
		return false
	}

	return matchingValue <= comparisonValue
}

// NewLessThanOrEqualToMatcher returns a pointer to a new instance of LessThanOrEqualToMatcher
func NewLessThanOrEqualToMatcher(negate bool, cmpVal int64, cmpType string, attributeName *string) *LessThanOrEqualToMatcher {
	return &LessThanOrEqualToMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		ComparisonValue:    cmpVal,
		ComparisonDataType: cmpType,
	}
}
