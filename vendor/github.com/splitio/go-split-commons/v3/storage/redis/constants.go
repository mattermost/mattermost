package redis

const (
	redisSplit            = "SPLITIO.split.{split}"                                    // split object
	redisSplitTill        = "SPLITIO.splits.till"                                      // last split fetch
	redisSegment          = "SPLITIO.segment.{segment}"                                // segment object
	redisSegmentTill      = "SPLITIO.segment.{segment}.till"                           // last segment fetch
	redisEvents           = "SPLITIO.events"                                           // events LIST key
	redisImpressionsQueue = "SPLITIO.impressions"                                      // impressions LIST key
	redisImpressionsTTL   = 3600                                                       // impressions default TTL
	redisTrafficType      = "SPLITIO.trafficType.{trafficType}"                        // traffic Type fetch
	redisHash             = "SPLITIO.hash"                                             // hash key
	redisConfig           = "SPLITIO.telemetry.config"                                 // config Key
	redisConfigTTL        = 3600                                                       // config TTL
	redisLatency          = "SPLITIO.telemetry.latencies"                              // latency Key
	redisExceptionField   = "{sdkVersion}/{machineName}/{machineIP}/{method}"          // exception field template
	redisException        = "SPLITIO.telemetry.exceptions"                             // exception Key
	redisLatencyField     = "{sdkVersion}/{machineName}/{machineIP}/{method}/{bucket}" // latency field template
)
