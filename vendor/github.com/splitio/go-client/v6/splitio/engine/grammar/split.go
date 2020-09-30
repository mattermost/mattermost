package grammar

import (
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/injection"
	"github.com/splitio/go-toolkit/v3/logging"
)

// Split struct with added logic that wraps around a DTO
type Split struct {
	splitData  *dtos.SplitDTO
	conditions []*Condition
}

// NewSplit instantiates a new Split object and all it's internal structures mapped to model classes
func NewSplit(splitDTO *dtos.SplitDTO, ctx *injection.Context, logger logging.LoggerInterface) *Split {
	conditions := make([]*Condition, 0)
	for _, cond := range splitDTO.Conditions {
		conditions = append(conditions, NewCondition(&cond, ctx, logger))
	}

	split := Split{
		conditions: conditions,
		splitData:  splitDTO,
	}

	return &split
}

// Name returns the name of the feature
func (s *Split) Name() string {
	return s.splitData.Name
}

// Seed returns the seed use for hashing
func (s *Split) Seed() int64 {
	return s.splitData.Seed
}

// Status returns whether the split is active or arhived
func (s *Split) Status() string {
	status := s.splitData.Status
	if status == "" || (status != SplitStatusActive && status != SplitStatusArchived) {
		return SplitStatusActive
	}
	return status
}

// Killed returns whether the split has been killed or not
func (s *Split) Killed() bool {
	return s.splitData.Killed
}

// DefaultTreatment returns the default treatment for the current split
func (s *Split) DefaultTreatment() string {
	return s.splitData.DefaultTreatment
}

// TrafficAllocation returns the traffic allocation configured for the current split
func (s *Split) TrafficAllocation() int {
	return s.splitData.TrafficAllocation
}

// TrafficAllocationSeed returns the seed for traffic allocation configured for this split
func (s *Split) TrafficAllocationSeed() int64 {
	return s.splitData.TrafficAllocationSeed
}

// Algo returns the hashing algorithm configured for this split
func (s *Split) Algo() int {
	switch s.splitData.Algo {
	case SplitAlgoLegacy:
		return SplitAlgoLegacy
	case SplitAlgoMurmur:
		return SplitAlgoMurmur
	default:
		return SplitAlgoLegacy
	}
}

// Conditions returns a slice of Condition objects
func (s *Split) Conditions() []*Condition {
	return s.conditions
}

// ChangeNumber returns the change number for this split
func (s *Split) ChangeNumber() int64 {
	return s.splitData.ChangeNumber
}

// Configurations returns the configurations for this split
func (s *Split) Configurations() map[string]string {
	return s.splitData.Configurations
}
