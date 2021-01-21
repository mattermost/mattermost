package evaluator

import (
	"fmt"
	"time"

	"github.com/splitio/go-client/v6/splitio/engine"
	"github.com/splitio/go-client/v6/splitio/engine/evaluator/impressionlabels"
	"github.com/splitio/go-client/v6/splitio/engine/grammar"
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/storage"

	"github.com/splitio/go-toolkit/v3/injection"
	"github.com/splitio/go-toolkit/v3/logging"
)

const (
	// Control is the treatment returned when something goes wrong
	Control = "control"
)

// Result represents the result of an evaluation, including the resulting treatment, the label for the impression,
// the latency and error if any
type Result struct {
	Treatment         string
	Label             string
	EvaluationTimeNs  int64
	SplitChangeNumber int64
	Config            *string
}

// Results represents the result of multiple evaluations at once
type Results struct {
	Evaluations      map[string]Result
	EvaluationTimeNs int64
}

// Evaluator struct is the main evaluator
type Evaluator struct {
	splitStorage   storage.SplitStorageConsumer
	segmentStorage storage.SegmentStorageConsumer
	eng            *engine.Engine
	logger         logging.LoggerInterface
}

// NewEvaluator instantiates an Evaluator struct and returns a reference to it
func NewEvaluator(
	splitStorage storage.SplitStorageConsumer,
	segmentStorage storage.SegmentStorageConsumer,
	eng *engine.Engine,
	logger logging.LoggerInterface,
) *Evaluator {
	return &Evaluator{
		splitStorage:   splitStorage,
		segmentStorage: segmentStorage,
		eng:            eng,
		logger:         logger,
	}
}

func (e *Evaluator) evaluateTreatment(key string, bucketingKey string, feature string, splitDto *dtos.SplitDTO, attributes map[string]interface{}) *Result {
	var config *string
	if splitDto == nil {
		e.logger.Warning(fmt.Sprintf("Feature %s not found, returning control.", feature))
		return &Result{Treatment: Control, Label: impressionlabels.SplitNotFound, Config: config}
	}

	ctx := injection.NewContext()
	ctx.AddDependency("segmentStorage", e.segmentStorage)
	ctx.AddDependency("evaluator", e)

	split := grammar.NewSplit(splitDto, ctx, e.logger)

	if split.Killed() {
		e.logger.Warning(fmt.Sprintf(
			"Feature %s has been killed, returning default treatment: %s",
			feature,
			split.DefaultTreatment(),
		))

		if _, ok := split.Configurations()[split.DefaultTreatment()]; ok {
			treatmentConfig := split.Configurations()[split.DefaultTreatment()]
			config = &treatmentConfig
		}

		return &Result{
			Treatment:         split.DefaultTreatment(),
			Label:             impressionlabels.Killed,
			SplitChangeNumber: split.ChangeNumber(),
			Config:            config,
		}
	}

	treatment, label := e.eng.DoEvaluation(split, key, bucketingKey, attributes)

	if treatment == nil {
		e.logger.Warning(fmt.Sprintf(
			"No condition matched, returning default treatment: %s",
			split.DefaultTreatment(),
		))
		defaultTreatment := split.DefaultTreatment()
		treatment = &defaultTreatment
		label = impressionlabels.NoConditionMatched
	}

	if _, ok := split.Configurations()[*treatment]; ok {
		treatmentConfig := split.Configurations()[*treatment]
		config = &treatmentConfig
	}

	return &Result{
		Treatment:         *treatment,
		Label:             label,
		SplitChangeNumber: split.ChangeNumber(),
		Config:            config,
	}
}

// EvaluateFeature returns a struct with the resulting treatment and extra information for the impression
func (e *Evaluator) EvaluateFeature(key string, bucketingKey *string, feature string, attributes map[string]interface{}) *Result {
	before := time.Now()
	splitDto := e.splitStorage.Split(feature)

	if bucketingKey == nil {
		bucketingKey = &key
	}
	result := e.evaluateTreatment(key, *bucketingKey, feature, splitDto, attributes)
	after := time.Now()

	result.EvaluationTimeNs = after.Sub(before).Nanoseconds()
	return result
}

// EvaluateFeatures returns a struct with the resulting treatment and extra information for the impression
func (e *Evaluator) EvaluateFeatures(key string, bucketingKey *string, features []string, attributes map[string]interface{}) Results {
	var results = Results{
		Evaluations:      make(map[string]Result),
		EvaluationTimeNs: 0,
	}
	before := time.Now()
	splits := e.splitStorage.FetchMany(features)

	if bucketingKey == nil {
		bucketingKey = &key
	}
	for _, feature := range features {
		results.Evaluations[feature] = *e.evaluateTreatment(key, *bucketingKey, feature, splits[feature], attributes)
	}

	after := time.Now()
	results.EvaluationTimeNs = after.Sub(before).Nanoseconds()
	return results
}

// EvaluateDependency SHOULD ONLY BE USED by DependencyMatcher.
// It's used to break the dependency cycle between matchers and evaluators.
func (e *Evaluator) EvaluateDependency(key string, bucketingKey *string, feature string, attributes map[string]interface{}) string {
	res := e.EvaluateFeature(key, bucketingKey, feature, attributes)
	return res.Treatment
}
