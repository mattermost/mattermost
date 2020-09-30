package engine

import (
	"fmt"
	"math"

	"github.com/splitio/go-client/v6/splitio/engine/evaluator/impressionlabels"
	"github.com/splitio/go-client/v6/splitio/engine/grammar"
	"github.com/splitio/go-client/v6/splitio/engine/hash"
	"github.com/splitio/go-toolkit/v3/logging"
)

// Engine struct is responsible for cheking if any of the conditions of the split matches,
// performing traffic allocation, calculating the bucket and returning the appropriate treatment
type Engine struct {
	logger logging.LoggerInterface
}

// DoEvaluation performs the main evaluation against each condition
func (e *Engine) DoEvaluation(
	split *grammar.Split,
	key string,
	bucketingKey string,
	attributes map[string]interface{},
) (*string, string) {
	inRollOut := false
	for _, condition := range split.Conditions() {
		if !inRollOut && condition.ConditionType() == grammar.ConditionTypeRollout {
			if split.TrafficAllocation() < 100 {
				bucket := e.calculateBucket(split.Algo(), bucketingKey, split.TrafficAllocationSeed())
				if bucket > split.TrafficAllocation() {
					e.logger.Debug(fmt.Sprintf(
						"Traffic allocation exceeded for feature %s and key %s."+
							" Returning default treatment", split.Name(), key,
					))
					defaultTreatment := split.DefaultTreatment()
					return &defaultTreatment, impressionlabels.NotInSplit
				}
				inRollOut = true
			}
		}

		if condition.Matches(key, &bucketingKey, attributes) {
			bucket := e.calculateBucket(split.Algo(), bucketingKey, split.Seed())
			treatment := condition.CalculateTreatment(bucket)
			return treatment, condition.Label()
		}
	}
	return nil, impressionlabels.NoConditionMatched
}

func (e *Engine) calculateBucket(algo int, bucketingKey string, seed int64) int {
	var hashedKey uint32
	switch algo {
	case grammar.SplitAlgoMurmur:
		hashedKey = hash.Murmur3_32([]byte(bucketingKey), uint32(seed))
	case grammar.SplitAlgoLegacy:
		fallthrough
	default:
		hashedKey = hash.Legacy([]byte(bucketingKey), uint32(seed))
	}

	return int(math.Abs(float64(hashedKey%100)) + 1)

}

// NewEngine instantiates and returns a new engine
func NewEngine(logger logging.LoggerInterface) *Engine {
	return &Engine{logger: logger}
}
