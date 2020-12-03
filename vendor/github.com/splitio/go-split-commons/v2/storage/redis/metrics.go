package redis

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/redis"
)

// MetricsStorage is a redis-based implementation of split storage
type MetricsStorage struct {
	client                  redis.PrefixedRedisClient
	logger                  logging.LoggerInterface
	gaugeSingleTemplate     string
	countersSingleTemplate  string
	latenciesSingleTemplate string
	gaugeMultiTemplate      string
	countersMultiTemplate   string
	latenciesMultiTemplate  string
	mutex                   *sync.RWMutex
}

// NewMetricsStorage creates a new RedisSplitStorage and returns a reference to it
func NewMetricsStorage(redisClient *redis.PrefixedRedisClient, metadata dtos.Metadata, logger logging.LoggerInterface) *MetricsStorage {
	// @Todo Split Storages between Go-Client and Redis
	gaugeSingleTemplate := strings.Replace(redisGauge, "{sdkVersion}", metadata.SDKVersion, 1)
	gaugeSingleTemplate = strings.Replace(gaugeSingleTemplate, "{instanceId}", metadata.MachineName, 1)
	countersSingleTemplate := strings.Replace(redisCounter, "{sdkVersion}", metadata.SDKVersion, 1)
	countersSingleTemplate = strings.Replace(countersSingleTemplate, "{instanceId}", metadata.MachineName, 1)
	latenciesSingleTemplate := strings.Replace(redisLatency, "{sdkVersion}", metadata.SDKVersion, 1)
	latenciesSingleTemplate = strings.Replace(latenciesSingleTemplate, "{instanceId}", metadata.MachineName, 1)

	gaugeMultiTemplate := strings.Replace(redisGauge, "{sdkVersion}", "*", 1)
	gaugeMultiTemplate = strings.Replace(gaugeMultiTemplate, "{instanceId}", "*", 1)
	gaugeMultiTemplate = strings.Replace(gaugeMultiTemplate, "{metric}", "*", 1)
	countersMultiTemplate := strings.Replace(redisCounter, "{sdkVersion}", "*", 1)
	countersMultiTemplate = strings.Replace(countersMultiTemplate, "{instanceId}", "*", 1)
	countersMultiTemplate = strings.Replace(countersMultiTemplate, "{metric}", "*", 1)
	latenciesMultiTemplate := strings.Replace(redisLatency, "{sdkVersion}", "*", 1)
	latenciesMultiTemplate = strings.Replace(latenciesMultiTemplate, "{instanceId}", "*", 1)
	latenciesMultiTemplate = strings.Replace(latenciesMultiTemplate, "{metric}", "*", 1)
	latenciesMultiTemplate = strings.Replace(latenciesMultiTemplate, "{bucket}", "*", 1)

	return &MetricsStorage{
		client:                  *redisClient,
		logger:                  logger,
		gaugeSingleTemplate:     gaugeSingleTemplate,
		countersSingleTemplate:  countersSingleTemplate,
		latenciesSingleTemplate: latenciesSingleTemplate,
		gaugeMultiTemplate:      gaugeMultiTemplate,
		countersMultiTemplate:   countersMultiTemplate,
		latenciesMultiTemplate:  latenciesMultiTemplate,
		mutex:                   &sync.RWMutex{},
	}
}

// IncCounter incraeses the count for a specific metric
func (r *MetricsStorage) IncCounter(metric string) {
	keyToIncr := strings.Replace(r.countersSingleTemplate, "{metric}", metric, 1)
	_, err := r.client.Incr(keyToIncr)
	if err != nil {
		r.logger.Error(fmt.Sprintf("Error incrementing counterfor metric \"%s\" in redis: %s", metric, err.Error()))
	}
}

// IncLatency incraeses the latency of a bucket for a specific metric
func (r *MetricsStorage) IncLatency(metric string, index int) {
	keyToIncr := strings.Replace(r.latenciesSingleTemplate, "{metric}", metric, 1)
	keyToIncr = strings.Replace(keyToIncr, "{bucket}", strconv.FormatInt(int64(index), 10), 1)
	_, err := r.client.Incr(keyToIncr)
	if err != nil {
		r.logger.Error(fmt.Sprintf(
			"Error incrementing latency bucket %d for metric \"%s\" in redis: %s", index, metric, err.Error(),
		))
	}
}

// PutGauge stores a gauge in redis
func (r *MetricsStorage) PutGauge(key string, gauge float64) {
	keyToStore := strings.Replace(r.gaugeSingleTemplate, "{metric}", key, 1)
	err := r.client.Set(keyToStore, gauge, 0)
	if err != nil {
		r.logger.Error(fmt.Sprintf("Error storing gauge \"%s\" in redis: %s\n", key, err))
	}
}

// PopCounters some
func (r *MetricsStorage) PopCounters() []dtos.CounterDTO {
	panic("Not implemented for redis")
}

// PopGauges some
func (r *MetricsStorage) PopGauges() []dtos.GaugeDTO {
	panic("Not implemented for redis")
}

// PopLatencies some
func (r *MetricsStorage) PopLatencies() []dtos.LatenciesDTO {
	panic("Not implemented for redis")
}

func (r *MetricsStorage) popByPattern(pattern string, useTransaction bool) (map[string]interface{}, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	keys, err := r.client.Keys(pattern)
	if err != nil {
		r.logger.Error(err.Error())
		return nil, err
	}

	if len(keys) == 0 {
		return map[string]interface{}{}, nil
	}

	values, err := r.client.MGet(keys)
	if err != nil {
		r.logger.Error(err.Error())
		return nil, err
	}
	_, err = r.client.Del(keys...)
	if err != nil {
		// if we failed to delete the keys, log an error and continue working.
		r.logger.Error(err.Error())
	}

	toReturn := make(map[string]interface{})
	for index := range keys {
		if index >= len(keys) || index >= len(values) {
			break
		}
		toReturn[keys[index]] = values[index]
	}
	return toReturn, nil

}

func parseIntRedisValue(s interface{}) (int64, error) {
	asStr, ok := s.(string)
	if !ok {
		return 0, fmt.Errorf("%+v is not a string", s)
	}

	asInt64, err := strconv.ParseInt(asStr, 10, 64)
	if err != nil {
		return 0, err
	}

	return asInt64, nil
}

func parseFloatRedisValue(s interface{}) (float64, error) {
	asStr, ok := s.(string)
	if !ok {
		return 0, fmt.Errorf("%+v is not a string", s)
	}

	asFloat64, err := strconv.ParseFloat(asStr, 64)
	if err != nil {
		return 0, err
	}

	return asFloat64, nil
}

func (r *MetricsStorage) parseLatencyKey(key string) (string, string, string, int, error) {
	re := regexp.MustCompile(`(\w+.)?SPLITIO\/([^\/]+)\/([^\/]+)\/latency.([^\/]+).bucket.([0-9]*)`)
	match := re.FindStringSubmatch(key)

	if len(match) < 6 {
		return "", "", "", 0, fmt.Errorf("Error parsing key %s", key)
	}

	sdkNameAndVersion := match[2]
	if sdkNameAndVersion == "" {
		return "", "", "", 0, fmt.Errorf("Invalid sdk name/version")
	}

	machineIP := match[3]
	if machineIP == "" {
		return "", "", "", 0, fmt.Errorf("Invalid machine IP")
	}

	metricName := match[4]
	if metricName == "" {
		return "", "", "", 0, fmt.Errorf("Invalid feature name")
	}

	bucketNumber, err := strconv.Atoi(match[5])
	if err != nil {
		return "", "", "", 0, fmt.Errorf("Error parsing bucket number: %s", err.Error())
	}
	r.logger.Verbose("Impression parsed key", match)

	return sdkNameAndVersion, machineIP, metricName, bucketNumber, nil
}

func (r *MetricsStorage) parseMetricKey(metricType string, key string) (string, string, string, error) {
	var re = regexp.MustCompile(strings.Replace(
		`(\w+.)?SPLITIO\/([^\/]+)\/([^\/]+)\/{metricType}.([\s\S]*)`,
		"{metricType}",
		metricType,
		1,
	))
	match := re.FindStringSubmatch(key)

	if len(match) < 5 {
		return "", "", "", fmt.Errorf("Error parsing key %s", key)
	}

	sdkNameAndVersion := match[2]
	if sdkNameAndVersion == "" {
		return "", "", "", fmt.Errorf("Invalid sdk name/version")
	}

	machineIP := match[3]
	if machineIP == "" {
		return "", "", "", fmt.Errorf("Invalid machine IP")
	}

	metricName := match[4]
	if metricName == "" {
		return "", "", "", fmt.Errorf("Invalid feature name")
	}

	r.logger.Verbose("Impression parsed key", match)

	return sdkNameAndVersion, machineIP, metricName, nil
}

// PopGaugesWithMetadata returns gauges values saved in Redis by SDKs
func (r *MetricsStorage) PopGaugesWithMetadata() (*dtos.GaugeDataBulk, error) {
	data, err := r.popByPattern(r.gaugeMultiTemplate, false)
	if err != nil {
		r.logger.Error(err.Error())
		return nil, err
	}

	gaugesToReturn := dtos.NewGaugeDataBulk()
	for key, value := range data {
		sdkNameAndVersion, machineIP, metricName, err := r.parseMetricKey("gauge", key)
		if err != nil {
			r.logger.Error(fmt.Sprintf("Unable to parse key %s. Skipping", key))
			continue
		}
		asFloat, err := parseFloatRedisValue(value)
		if err != nil {
			r.logger.Error(fmt.Sprintf("Unable to parse value %+v. Skipping", value))
			continue
		}
		gaugesToReturn.PutGauge(sdkNameAndVersion, machineIP, metricName, asFloat)
	}

	return gaugesToReturn, nil
}

// PopCountersWithMetadata returns counter values saved in Redis by SDKs
func (r *MetricsStorage) PopCountersWithMetadata() (*dtos.CounterDataBulk, error) {
	data, err := r.popByPattern(r.countersMultiTemplate, false)
	if err != nil {
		r.logger.Error(err.Error())
		return nil, err
	}

	countersToReturn := dtos.NewCounterDataBulk()
	for key, value := range data {
		sdkNameAndVersion, machineIP, metricName, err := r.parseMetricKey("count", key)
		if err != nil {
			r.logger.Error("Unable to parse key %s. Skipping", key)
			continue
		}
		asInt, err := parseIntRedisValue(value)
		if err != nil {
			r.logger.Error(err.Error())
			continue
		}

		countersToReturn.PutCounter(sdkNameAndVersion, machineIP, metricName, asInt)
	}

	return countersToReturn, nil
}

// PopLatenciesWithMetadata returns latency values saved in Redis by SDKs
func (r *MetricsStorage) PopLatenciesWithMetadata() (*dtos.LatencyDataBulk, error) {
	data, err := r.popByPattern(r.latenciesMultiTemplate, false)
	if err != nil {
		r.logger.Error(err.Error())
		return nil, err
	}

	latenciesToReturn := dtos.NewLatencyDataBulk()
	for key, value := range data {
		value, err := parseIntRedisValue(value)
		if err != nil {
			r.logger.Warning(fmt.Sprintf("Unable to parse value of key %s. Skipping", key))
			continue
		}
		sdkNameAndVersion, machineIP, metricName, bucketNumber, err := r.parseLatencyKey(key)
		if err != nil {
			r.logger.Warning(fmt.Sprintf("Unable to parse key %s. Skipping", key))
			continue
		}
		latenciesToReturn.PutLatency(sdkNameAndVersion, machineIP, metricName, bucketNumber, value)
	}
	r.logger.Verbose(latenciesToReturn)
	return latenciesToReturn, nil
}

// PeekCounters returns Counters
func (r *MetricsStorage) PeekCounters() map[string]int64 {
	return make(map[string]int64, 0)
}

// PeekLatencies returns Latencies
func (r *MetricsStorage) PeekLatencies() map[string][]int64 {
	return make(map[string][]int64, 0)
}
