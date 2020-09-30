package matchers

// AllKeysMatcher matches any given key and set of attributes
type AllKeysMatcher struct {
	Matcher
}

// Match implementation for AllKeysMatcher
func (m AllKeysMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	return true
}

// NewAllKeysMatcher returns a pointer to a new instance of AllKeysMatcher
func NewAllKeysMatcher(negate bool) *AllKeysMatcher {
	return &AllKeysMatcher{Matcher: Matcher{negate: negate}}
}
