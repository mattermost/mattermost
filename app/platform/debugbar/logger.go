package debugbar

import (
	"fmt"
	"reflect"
	"strconv"
	"time"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type DebugBarLogger struct {
	mlog.LoggerIFace
	debugBar *DebugBar
}

func NewLogger(logger mlog.LoggerIFace, debugBar *DebugBar) *DebugBarLogger {
	return &DebugBarLogger{
		LoggerIFace: logger,
		debugBar:    debugBar,
	}
}

func (l DebugBarLogger) Trace(message string, fields ...mlog.Field) {
	l.Log(logr.Trace, message, fields...)
}
func (l DebugBarLogger) Debug(message string, fields ...mlog.Field) {
	l.Log(logr.Debug, message, fields...)
}
func (l DebugBarLogger) Info(message string, fields ...mlog.Field) {
	l.Log(logr.Info, message, fields...)
}
func (l DebugBarLogger) Warn(message string, fields ...mlog.Field) {
	l.Log(logr.Warn, message, fields...)
}
func (l DebugBarLogger) Error(message string, fields ...mlog.Field) {
	l.Log(logr.Error, message, fields...)
}
func (l DebugBarLogger) Critical(message string, fields ...mlog.Field) {
	l.Fatal(message, fields...)
}
func (l DebugBarLogger) Fatal(message string, fields ...mlog.Field) {
	l.Log(logr.Fatal, message, fields...)
}

func (l DebugBarLogger) fieldsToStringsMap(fields ...mlog.Field) map[string]string {
	result := map[string]string{}
	for _, field := range fields {
		result[field.Key] = l.fieldToString(field)
	}
	return result
}

func (l DebugBarLogger) fieldToString(field mlog.Field) string {
	switch field.Type {
	case logr.StringType:
		return field.String

	case logr.StringerType:
		s, ok := field.Interface.(fmt.Stringer)
		if ok {
			return s.String()
		}
		return ""

	case logr.StructType:
		return fmt.Sprintf("%v", field.Interface)

	case logr.ErrorType:
		return fmt.Sprintf("%v", field.Interface)

	case logr.BoolType:
		var b bool
		if field.Integer != 0 {
			b = true
		}
		return strconv.FormatBool(b)

	case logr.TimestampMillisType:
		ts := time.Unix(field.Integer/1000, (field.Integer%1000)*int64(time.Millisecond))
		return ts.UTC().Format(logr.TimestampMillisFormat)

	case logr.TimeType:
		t, ok := field.Interface.(time.Time)
		if !ok {
			return ""
		}
		return t.Format(logr.DefTimestampFormat)

	case logr.DurationType:
		return fmt.Sprintf("%s", time.Duration(field.Integer))

	case logr.Int64Type, logr.Int32Type, logr.IntType:
		return strconv.FormatInt(field.Integer, 10)

	case logr.Uint64Type, logr.Uint32Type, logr.UintType:
		return strconv.FormatUint(uint64(field.Integer), 10)

	case logr.Float64Type, logr.Float32Type:
		size := 64
		if field.Type == logr.Float32Type {
			size = 32
		}
		return strconv.FormatFloat(field.Float, 'f', -1, size)

	case logr.BinaryType:
		b, ok := field.Interface.([]byte)
		if ok {
			return fmt.Sprintf("[%X]", b)
		}
		return fmt.Sprintf("[%v]", field.Interface)

	case logr.ArrayType:
		a := reflect.ValueOf(field.Interface)
		results := []string{}
		for i := 0; i < a.Len(); i++ {
			item := a.Index(i)
			switch v := item.Interface().(type) {
			case fmt.Stringer:
				results = append(results, v.String())
			default:
				s := fmt.Sprintf("%v", v)
				results = append(results, s)
			}
		}
		return fmt.Sprintf("[%v]", results)

	case logr.MapType:
		a := reflect.ValueOf(field.Interface)
		iter := a.MapRange()
		results := map[string]string{}
		for iter.Next() {

			val := iter.Value().Interface()
			switch v := val.(type) {
			case fmt.Stringer:
				results[iter.Key().String()] = v.String()
			default:
				s := fmt.Sprintf("%v", v)
				results[iter.Key().String()] = s
			}
		}
		return fmt.Sprintf("%v", results)

	case logr.UnknownType:
		return fmt.Sprintf("%v", field.Interface)
	}
	return ""
}

func (l DebugBarLogger) Log(level mlog.Level, message string, fields ...mlog.Field) {
	l.debugBar.SendLogEvent(level.Name, message, l.fieldsToStringsMap(fields...))
	l.LoggerIFace.Log(level, message, fields...)
}

func (l DebugBarLogger) LogM(levels []mlog.Level, message string, fields ...mlog.Field) {
	for _, level := range levels {
		l.debugBar.SendLogEvent(level.Name, message, l.fieldsToStringsMap(fields...))
	}
	l.LoggerIFace.LogM(levels, message, fields...)
}
