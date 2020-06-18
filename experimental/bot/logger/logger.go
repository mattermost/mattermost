package logger

import "time"

const timed = "__since"
const Elapsed = "Elapsed"

type LogContext map[string]interface{}

type Logger interface {
	With(LogContext) Logger
	Timed() Logger
	Debugf(format string, args ...interface{})
	Errorf(format string, args ...interface{})
	Infof(format string, args ...interface{})
	Warnf(format string, args ...interface{})
}

func measure(lc LogContext) {
	if lc[timed] == nil {
		return
	}
	started := lc[timed].(time.Time)
	lc[Elapsed] = time.Since(started).String()
	delete(lc, timed)
}

func level(l string) int {
	switch l {
	case "debug":
		return 4
	case "info":
		return 3
	case "warn":
		return 2
	case "error":
		return 1
	}
	return 0
}

func toKeyValuePairs(in map[string]interface{}) (out []interface{}) {
	for k, v := range in {
		out = append(out, k)
		out = append(out, v)
	}
	return out
}
