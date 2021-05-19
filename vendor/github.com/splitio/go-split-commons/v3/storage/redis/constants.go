package redis

const (
	redisSplit            = "SPLITIO.split.{split}"                                              // split object
	redisSplitTill        = "SPLITIO.splits.till"                                                // last split fetch
	redisSegment          = "SPLITIO.segment.{segment}"                                          // segment object
	redisSegmentTill      = "SPLITIO.segment.{segment}.till"                                     // last segment fetch
	redisImpressions      = "SPLITIO/{sdkVersion}/{instanceId}/impressions.{feature}"            // impressions for a feature
	redisLatency          = "SPLITIO/{sdkVersion}/{instanceId}/latency.{metric}.bucket.{bucket}" // latency bucket
	redisCounter          = "SPLITIO/{sdkVersion}/{instanceId}/count.{metric}"                   // counter
	redisGauge            = "SPLITIO/{sdkVersion}/{instanceId}/gauge.{metric}"                   // gauge
	redisEvents           = "SPLITIO.events"                                                     // events LIST key
	redisImpressionsQueue = "SPLITIO.impressions"                                                // impressions LIST key
	redisImpressionsTTL   = 60                                                                   // impressions default TTL
	redisTrafficType      = "SPLITIO.trafficType.{trafficType}"                                  // traffic Type fetch
	redisHash             = "SPLITIO.hash"
)
