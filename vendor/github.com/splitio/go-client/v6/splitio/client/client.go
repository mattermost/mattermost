package client

import (
	"errors"
	"runtime/debug"
	"time"

	"github.com/splitio/go-client/v6/splitio/conf"
	"github.com/splitio/go-client/v6/splitio/engine/evaluator"
	"github.com/splitio/go-client/v6/splitio/engine/evaluator/impressionlabels"
	impressionlistener "github.com/splitio/go-client/v6/splitio/impressionListener"
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/provisional"
	"github.com/splitio/go-split-commons/v2/storage"
	"github.com/splitio/go-split-commons/v2/util"
	"github.com/splitio/go-toolkit/v3/logging"
)

// SplitClient is the entry-point of the split SDK.
type SplitClient struct {
	logger             logging.LoggerInterface
	evaluator          evaluator.Interface
	impressions        storage.ImpressionStorageProducer
	metrics            storage.MetricsStorageProducer
	events             storage.EventStorageProducer
	validator          inputValidation
	factory            *SplitFactory
	impressionListener *impressionlistener.WrapperImpressionListener
	impressionManager  provisional.ImpressionManager
}

// TreatmentResult struct that includes the Treatment evaluation with the corresponding Config
type TreatmentResult struct {
	Treatment string  `json:"treatment"`
	Config    *string `json:"config"`
}

// getEvaluationResult calls evaluation for one particular split
func (c *SplitClient) getEvaluationResult(
	matchingKey string,
	bucketingKey *string,
	feature string,
	attributes map[string]interface{},
	operation string,
) *evaluator.Result {
	if c.isReady() {
		return c.evaluator.EvaluateFeature(matchingKey, bucketingKey, feature, attributes)
	}
	c.logger.Warning(operation + ": the SDK is not ready, results may be incorrect. Make sure to wait for SDK readiness before using this method")
	return &evaluator.Result{
		Treatment: evaluator.Control,
		Label:     impressionlabels.ClientNotReady,
		Config:    nil,
	}
}

// getEvaluationsResult calls evaluation for multiple treatments at once
func (c *SplitClient) getEvaluationsResult(
	matchingKey string,
	bucketingKey *string,
	features []string,
	attributes map[string]interface{},
	operation string,
) evaluator.Results {
	if c.isReady() {
		return c.evaluator.EvaluateFeatures(matchingKey, bucketingKey, features, attributes)
	}
	c.logger.Warning(operation + ": the SDK is not ready, results may be incorrect. Make sure to wait for SDK readiness before using this method")
	result := evaluator.Results{
		EvaluationTimeNs: 0,
		Evaluations:      make(map[string]evaluator.Result),
	}
	for _, feature := range features {
		result.Evaluations[feature] = evaluator.Result{
			Treatment: evaluator.Control,
			Label:     impressionlabels.ClientNotReady,
			Config:    nil,
		}
	}
	return result
}

// createImpression creates impression to be stored and used by listener
func (c *SplitClient) createImpression(
	feature string,
	bucketingKey *string,
	evaluationLabel string,
	matchingKey string,
	treatment string,
	changeNumber int64,
) dtos.Impression {
	var label string
	if c.factory.cfg.LabelsEnabled {
		label = evaluationLabel
	}

	impressionBucketingKey := ""
	if bucketingKey != nil {
		impressionBucketingKey = *bucketingKey
	}

	return dtos.Impression{
		FeatureName:  feature,
		BucketingKey: impressionBucketingKey,
		ChangeNumber: changeNumber,
		KeyName:      matchingKey,
		Label:        label,
		Treatment:    treatment,
		Time:         time.Now().UTC().UnixNano() / int64(time.Millisecond), // Convert standard timestamp to java's ms timestamps
	}
}

// storeData stores impression, runs listener and stores metrics
func (c *SplitClient) storeData(impressions []dtos.Impression, attributes map[string]interface{}, metricsLabel string, evaluationTimeNs int64) {
	// Store impression
	if c.impressions != nil {
		forLog, forListener := c.impressionManager.ProcessImpressions(impressions)
		c.impressions.LogImpressions(forLog)

		// Custom Impression Listener
		if c.impressionListener != nil {
			c.impressionListener.SendDataToClient(forListener, attributes)
		}
	} else {
		c.logger.Warning("No impression storage set in client. Not sending impressions!")
	}

	// Store latency
	if c.metrics != nil {
		bucket := util.Bucket(evaluationTimeNs)
		c.metrics.IncLatency(metricsLabel, bucket)
	} else {
		c.logger.Warning("No metrics storage set in client. Not sending latencies!")
	}
}

// doTreatmentCall retrieves treatments of an specific feature with configurations object if it is present
// for a certain key and set of attributes
func (c *SplitClient) doTreatmentCall(
	key interface{},
	feature string,
	attributes map[string]interface{},
	operation string,
	metricsLabel string,
) (t TreatmentResult) {
	controlTreatment := TreatmentResult{
		Treatment: evaluator.Control,
		Config:    nil,
	}

	// Set up a guard deferred function to recover if the SDK starts panicking
	defer func() {
		if r := recover(); r != nil {
			// At this point we'll only trust that the logger isn't panicking trust
			// that the logger isn't panicking
			c.logger.Error(
				"SDK is panicking with the following error", r, "\n",
				string(debug.Stack()), "\n",
				"Returning CONTROL", "\n")
			t = controlTreatment
		}
	}()

	if c.isDestroyed() {
		c.logger.Error("Client has already been destroyed - no calls possible")
		return controlTreatment
	}

	matchingKey, bucketingKey, err := c.validator.ValidateTreatmentKey(key, operation)
	if err != nil {
		c.logger.Error(err.Error())
		return controlTreatment
	}

	feature, err = c.validator.ValidateFeatureName(feature, operation)
	if err != nil {
		c.logger.Error(err.Error())
		return controlTreatment
	}

	evaluationResult := c.getEvaluationResult(matchingKey, bucketingKey, feature, attributes, operation)

	if !c.validator.IsSplitFound(evaluationResult.Label, feature, operation) {
		return controlTreatment
	}

	c.storeData(
		[]dtos.Impression{c.createImpression(feature, bucketingKey, evaluationResult.Label, matchingKey, evaluationResult.Treatment, evaluationResult.SplitChangeNumber)},
		attributes,
		metricsLabel,
		evaluationResult.EvaluationTimeNs,
	)

	return TreatmentResult{
		Treatment: evaluationResult.Treatment,
		Config:    evaluationResult.Config,
	}
}

// Treatment implements the main functionality of split. Retrieve treatments of a specific feature
// for a certain key and set of attributes
func (c *SplitClient) Treatment(key interface{}, feature string, attributes map[string]interface{}) string {
	return c.doTreatmentCall(key, feature, attributes, "Treatment", "sdk.getTreatment").Treatment
}

// TreatmentWithConfig implements the main functionality of split. Retrieves the treatment of a specific feature with
// the corresponding configuration if it is present
func (c *SplitClient) TreatmentWithConfig(key interface{}, feature string, attributes map[string]interface{}) TreatmentResult {
	return c.doTreatmentCall(key, feature, attributes, "TreatmentWithConfig", "sdk.getTreatmentWithConfig")
}

// Generates control treatments
func (c *SplitClient) generateControlTreatments(features []string, operation string) map[string]TreatmentResult {
	treatments := make(map[string]TreatmentResult)
	filtered, err := c.validator.ValidateFeatureNames(features, operation)
	if err != nil {
		return treatments
	}
	for _, feature := range filtered {
		treatments[feature] = TreatmentResult{
			Treatment: evaluator.Control,
			Config:    nil,
		}
	}
	return treatments
}

// doTreatmentsCall retrieves treatments of an specific array of features with configurations object if it is present
// for a certain key and set of attributes
func (c *SplitClient) doTreatmentsCall(
	key interface{},
	features []string,
	attributes map[string]interface{},
	operation string,
	metricsLabel string,
) (t map[string]TreatmentResult) {
	treatments := make(map[string]TreatmentResult)

	// Set up a guard deferred function to recover if the SDK starts panicking
	defer func() {
		if r := recover(); r != nil {
			// At this point we'll only trust that the logger isn't panicking trust
			// that the logger isn't panicking
			c.logger.Error(
				"SDK is panicking with the following error", r, "\n",
				string(debug.Stack()), "\n")
			t = treatments
		}
	}()

	if c.isDestroyed() {
		c.logger.Error("Client has already been destroyed - no calls possible")
		return c.generateControlTreatments(features, operation)
	}

	matchingKey, bucketingKey, err := c.validator.ValidateTreatmentKey(key, operation)
	if err != nil {
		c.logger.Error(err.Error())
		return c.generateControlTreatments(features, operation)
	}

	filteredFeatures, err := c.validator.ValidateFeatureNames(features, operation)
	if err != nil {
		c.logger.Error(err.Error())
		return map[string]TreatmentResult{}
	}

	var bulkImpressions []dtos.Impression
	evaluationsResult := c.getEvaluationsResult(matchingKey, bucketingKey, filteredFeatures, attributes, operation)
	for feature, evaluation := range evaluationsResult.Evaluations {
		if !c.validator.IsSplitFound(evaluation.Label, feature, operation) {
			treatments[feature] = TreatmentResult{
				Treatment: evaluator.Control,
				Config:    nil,
			}
		} else {
			bulkImpressions = append(bulkImpressions, c.createImpression(feature, bucketingKey, evaluation.Label, matchingKey, evaluation.Treatment, evaluation.SplitChangeNumber))

			treatments[feature] = TreatmentResult{
				Treatment: evaluation.Treatment,
				Config:    evaluation.Config,
			}
		}
	}

	c.storeData(bulkImpressions, attributes, metricsLabel, evaluationsResult.EvaluationTimeNs)

	return treatments
}

// Treatments evaluates multiple featers for a single user and set of attributes at once
func (c *SplitClient) Treatments(key interface{}, features []string, attributes map[string]interface{}) map[string]string {
	treatments := map[string]string{}
	result := c.doTreatmentsCall(key, features, attributes, "Treatments", "sdk.getTreatments")
	for feature, treatmentResult := range result {
		treatments[feature] = treatmentResult.Treatment
	}
	return treatments
}

// TreatmentsWithConfig evaluates multiple featers for a single user and set of attributes at once and returns configurations
func (c *SplitClient) TreatmentsWithConfig(key interface{}, features []string, attributes map[string]interface{}) map[string]TreatmentResult {
	return c.doTreatmentsCall(key, features, attributes, "TreatmentsWithConfig", "sdk.getTreatmentsWithConfig")
}

// isDestroyed returns true if the client has been destroyed
func (c *SplitClient) isDestroyed() bool {
	return c.factory.IsDestroyed()
}

// isReady returns true if the client is ready
func (c *SplitClient) isReady() bool {
	return c.factory.IsReady()
}

// Destroy the client and the underlying factory.
func (c *SplitClient) Destroy() {
	if !c.isDestroyed() {
		c.factory.Destroy()
	}
}

// Track an event and its custom value
func (c *SplitClient) Track(
	key string,
	trafficType string,
	eventType string,
	value interface{},
	properties map[string]interface{},
) (ret error) {

	defer func() {
		if r := recover(); r != nil {
			// At this point we'll only trust that the logger isn't panicking
			c.logger.Error(
				"SDK is panicking with the following error", r, "\n",
				string(debug.Stack()), "\n",
			)
			ret = errors.New("Track is panicking. Please check logs")
		}
		return
	}()

	if c.isDestroyed() {
		c.logger.Error("Client has already been destroyed - no calls possible")
		return errors.New("Client has already been destroyed - no calls possible")
	}

	if !c.isReady() {
		c.logger.Warning("Track: the SDK is not ready, results may be incorrect. Make sure to wait for SDK readiness before using this method")
	}

	key, trafficType, eventType, value, err := c.validator.ValidateTrackInputs(
		key,
		trafficType,
		eventType,
		value,
		c.isReady() && c.factory.apikey != conf.Localhost,
	)
	if err != nil {
		c.logger.Error(err.Error())
		return err
	}

	properties, size, err := c.validator.validateTrackProperties(properties)
	if err != nil {
		return err
	}

	err = c.events.Push(dtos.EventDTO{
		Key:             key,
		TrafficTypeName: trafficType,
		EventTypeID:     eventType,
		Value:           value,
		Timestamp:       time.Now().UTC().UnixNano() / int64(time.Millisecond), // Convert standard timestamp to java's ms timestamps
		Properties:      properties,
	}, size)

	if err != nil {
		c.logger.Error("Error tracking event", err.Error())
		return err
	}

	return nil
}

// BlockUntilReady Calls BlockUntilReady on factory to block client on readiness
func (c *SplitClient) BlockUntilReady(timer int) error {
	return c.factory.BlockUntilReady(timer)
}
