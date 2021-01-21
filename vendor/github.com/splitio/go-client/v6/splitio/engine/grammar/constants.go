package grammar

const (
	// SplitStatusActive represents an active split
	SplitStatusActive = "ACTIVE"
	// SplitStatusArchived represents an archived split
	SplitStatusArchived = "ARCHIVED"

	// SplitAlgoLegacy represents the legacy implementation of hash function for bucketing
	SplitAlgoLegacy = 1

	// SplitAlgoMurmur represents the murmur implementation of the hash funcion for bucketing
	SplitAlgoMurmur = 2

	// ConditionTypeWhitelist represents a normal condition
	ConditionTypeWhitelist = "WHITELIST"
	// ConditionTypeRollout represents a condition that will return default if traffic allocatio is exceeded
	ConditionTypeRollout = "ROLLOUT"

	// MatcherCombinerAnd represents that all matchers in the group are required
	MatcherCombinerAnd = 0
)
