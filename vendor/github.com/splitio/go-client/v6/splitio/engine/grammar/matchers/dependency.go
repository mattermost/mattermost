package matchers

type dependencyEvaluator interface {
	EvaluateDependency(key string, bucketingKey *string, feature string, attributes map[string]interface{}) string
}

// DependencyMatcher will match if the evaluation of another split results in one of the treatments defined
// in the split
type DependencyMatcher struct {
	Matcher
	feature    string
	treatments []string
}

// Match will return true if the evaluation of another split results in one of the treatments defined in the
// split
func (m *DependencyMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	evaluator, ok := m.Context.Dependency("evaluator").(dependencyEvaluator)
	if !ok {
		m.logger.Error("DependencyMatcher: Error retrieving matching key")
		return false
	}

	result := evaluator.EvaluateDependency(key, bucketingKey, m.feature, attributes)
	for _, treatment := range m.treatments {
		if treatment == result {
			return true
		}
	}

	return false
}

// NewDependencyMatcher will return a new instance of DependencyMatcher
func NewDependencyMatcher(negate bool, feature string, treatments []string) *DependencyMatcher {
	return &DependencyMatcher{
		Matcher: Matcher{
			negate: negate,
		},
		feature:    feature,
		treatments: treatments,
	}
}
