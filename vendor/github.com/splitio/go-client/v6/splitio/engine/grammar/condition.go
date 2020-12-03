package grammar

import (
	"github.com/splitio/go-client/v6/splitio/engine/grammar/matchers"
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/injection"
	"github.com/splitio/go-toolkit/v3/logging"
)

// Condition struct with added logic that wraps around a DTO
type Condition struct {
	matchers      []matchers.MatcherInterface
	combiner      string
	partitions    []Partition
	label         string
	conditionType string
}

// NewCondition instantiates a new Condition struct with appropriate wrappers around dtos and returns it.
func NewCondition(cond *dtos.ConditionDTO, ctx *injection.Context, logger logging.LoggerInterface) *Condition {
	partitions := make([]Partition, 0)
	for _, part := range cond.Partitions {
		partitions = append(partitions, Partition{partitionData: part})
	}
	matcherObjs := make([]matchers.MatcherInterface, 0)
	for _, matcher := range cond.MatcherGroup.Matchers {
		m, err := matchers.BuildMatcher(&matcher, ctx, logger)
		if err == nil {
			matcherObjs = append(matcherObjs, m)
		}
	}

	return &Condition{
		combiner:      cond.MatcherGroup.Combiner,
		matchers:      matcherObjs,
		partitions:    partitions,
		label:         cond.Label,
		conditionType: cond.ConditionType,
	}
}

// Partition struct with added logic that wraps around a DTO
type Partition struct {
	partitionData dtos.PartitionDTO
}

// ConditionType returns validated condition type. Whitelist by default
func (c *Condition) ConditionType() string {
	switch c.conditionType {
	case ConditionTypeRollout:
		return ConditionTypeRollout
	case ConditionTypeWhitelist:
		return ConditionTypeWhitelist
	default:
		return ConditionTypeWhitelist
	}
}

// Label returns the condition's label
func (c *Condition) Label() string {
	return c.label
}

// Matches returns true if the condition matches for a specific key and/or set of attributes
func (c *Condition) Matches(key string, bucketingKey *string, attributes map[string]interface{}) bool {
	partial := make([]bool, len(c.matchers))
	for i, matcher := range c.matchers {
		partial[i] = matcher.Match(key, attributes, bucketingKey)
		if matcher.Negate() {
			partial[i] = !partial[i]
		}
	}
	return applyCombiner(partial, c.combiner)
}

// CalculateTreatment calulates the treatment for a specific condition based on the bucket
func (c *Condition) CalculateTreatment(bucket int) *string {
	accum := 0
	for _, partition := range c.partitions {
		accum += partition.partitionData.Size
		if bucket <= accum {
			return &partition.partitionData.Treatment
		}
	}
	return nil
}

func applyCombiner(results []bool, combiner string) bool {
	temp := true
	switch combiner {
	case "AND":
		for _, result := range results {
			temp = temp && result
		}
	default:
		return false
	}
	return temp
}
