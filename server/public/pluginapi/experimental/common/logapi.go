package common

type LogAPI interface {
	LogError(message string, keyValuePairs ...any)
	LogWarn(message string, keyValuePairs ...any)
	LogInfo(message string, keyValuePairs ...any)
	LogDebug(message string, keyValuePairs ...any)
}
