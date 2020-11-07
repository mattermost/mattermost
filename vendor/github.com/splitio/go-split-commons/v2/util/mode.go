package util

import (
	"strings"

	"github.com/splitio/go-split-commons/v2/conf"
)

// ShouldAddPreviousTime returns if previous time should be set up or not depending on operationMode
func ShouldAddPreviousTime(managerConfig conf.ManagerConfig) bool {
	switch strings.ToLower(managerConfig.OperationMode) {
	case conf.ProducerSync:
		fallthrough
	case conf.Standalone:
		return true
	default:
		return false
	}
}

// ShouldBeOptimized returns if should dedupe impressions or not depending on configs
func ShouldBeOptimized(managerConfig conf.ManagerConfig) bool {
	if !ShouldAddPreviousTime(managerConfig) {
		return false
	}
	if strings.ToLower(managerConfig.ImpressionsMode) == conf.ImpressionsModeOptimized {
		return true
	}
	return false
}
