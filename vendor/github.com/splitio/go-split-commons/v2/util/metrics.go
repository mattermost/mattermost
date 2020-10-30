package util

var latencyBuckets = [23]float64{
	1.00,
	1.50,
	2.25,
	3.38,
	5.06,
	7.59,
	11.39,
	17.09,
	25.63,
	38.44,
	57.67,
	86.50,
	129.75,
	194.62,
	291.93,
	437.89,
	656.84,
	985.26,
	1477.89,
	2216.84,
	3325.26,
	4987.89,
	7481.83,
}

// Bucket returns the bucket where the received latency falls
func Bucket(latency int64) int {
	floatLatency := float64(latency) / 1000 // Convert to millisencods

	index := 0
	for index < len(latencyBuckets) && floatLatency > latencyBuckets[index] {
		index++
	}

	if index == len(latencyBuckets) {
		return index - 1
	}

	return index
}
