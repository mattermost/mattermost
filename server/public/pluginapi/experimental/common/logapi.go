package common

type LogAPI interface {
	LogError(message string, keyValuePairs ...interface{})
	LogWarn(message string, keyValuePairs ...interface{})
	LogInfo(message string, keyValuePairs ...interface{})
	LogDebug(message string, keyValuePairs ...interface{})
}
