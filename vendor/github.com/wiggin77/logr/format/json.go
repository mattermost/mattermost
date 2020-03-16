package format

import (
	"bytes"
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/francoispqt/gojay"
	"github.com/wiggin77/logr"
)

// JSON formats log records as JSON.
type JSON struct {
	// DisableTimestamp disables output of timestamp field.
	DisableTimestamp bool
	// DisableLevel disables output of level field.
	DisableLevel bool
	// DisableMsg disables output of msg field.
	DisableMsg bool
	// DisableContext disables output of all context fields.
	DisableContext bool
	// DisableStacktrace disables output of stack trace.
	DisableStacktrace bool

	// TimestampFormat is an optional format for timestamps. If empty
	// then DefTimestampFormat is used.
	TimestampFormat string

	// Indent sets the character used to indent or pretty print the JSON.
	// Empty string means no pretty print.
	Indent string

	// EscapeHTML determines if certain characters (e.g. `<`, `>`, `&`)
	// are escaped.
	EscapeHTML bool

	// KeyTimestamp overrides the timestamp field key name.
	KeyTimestamp string

	// KeyLevel overrides the level field key name.
	KeyLevel string

	// KeyMsg overrides the msg field key name.
	KeyMsg string

	// KeyContextFields when not empty will group all context fields
	// under this key.
	KeyContextFields string

	// KeyStacktrace overrides the stacktrace field key name.
	KeyStacktrace string

	once sync.Once
}

// Format converts a log record to bytes in JSON format.
func (j *JSON) Format(rec *logr.LogRec, stacktrace bool, buf *bytes.Buffer) (*bytes.Buffer, error) {
	j.once.Do(j.applyDefaultKeyNames)

	if buf == nil {
		buf = &bytes.Buffer{}
	}
	enc := gojay.BorrowEncoder(buf)
	defer func() {
		enc.Release()
	}()

	jlr := JSONLogRec{
		LogRec:     rec,
		JSON:       j,
		stacktrace: stacktrace,
	}

	err := enc.EncodeObject(jlr)
	if err != nil {
		return nil, err
	}
	return buf, nil
}

func (j *JSON) applyDefaultKeyNames() {
	if j.KeyTimestamp == "" {
		j.KeyTimestamp = "timestamp"
	}
	if j.KeyLevel == "" {
		j.KeyLevel = "level"
	}
	if j.KeyMsg == "" {
		j.KeyMsg = "msg"
	}
	if j.KeyStacktrace == "" {
		j.KeyStacktrace = "stacktrace"
	}
}

// JSONLogRec decorates a LogRec adding JSON encoding.
type JSONLogRec struct {
	*logr.LogRec
	*JSON
	stacktrace bool
}

// MarshalJSONObject encodes the LogRec as JSON.
func (rec JSONLogRec) MarshalJSONObject(enc *gojay.Encoder) {
	if !rec.DisableTimestamp {
		timestampFmt := rec.TimestampFormat
		if timestampFmt == "" {
			timestampFmt = logr.DefTimestampFormat
		}
		time := rec.Time()
		enc.AddTimeKey(rec.KeyTimestamp, &time, timestampFmt)
	}
	if !rec.DisableLevel {
		enc.AddStringKey(rec.KeyLevel, rec.Level().Name)
	}
	if !rec.DisableMsg {
		enc.AddStringKey(rec.KeyMsg, rec.Msg())
	}
	if !rec.DisableContext {
		if rec.KeyContextFields != "" {
			enc.AddObjectKey(rec.KeyContextFields, jsonFields(rec.Fields()))
		} else {
			m := rec.Fields()
			if len(m) > 0 {
				for k, v := range m {
					key := rec.prefixCollision(k)
					encodeField(enc, key, v)
				}
			}
		}
	}
	if rec.stacktrace && !rec.DisableStacktrace {
		frames := rec.StackFrames()
		if len(frames) > 0 {
			enc.AddArrayKey(rec.KeyStacktrace, stackFrames(frames))
		}
	}

}

// IsNil returns true if the LogRec pointer is nil.
func (rec JSONLogRec) IsNil() bool {
	return rec.LogRec == nil
}

func (rec JSONLogRec) prefixCollision(key string) string {
	switch key {
	case rec.KeyTimestamp, rec.KeyLevel, rec.KeyMsg, rec.KeyStacktrace:
		return rec.prefixCollision("_" + key)
	}
	return key
}

type stackFrames []runtime.Frame

// MarshalJSONArray encodes stackFrames slice as JSON.
func (s stackFrames) MarshalJSONArray(enc *gojay.Encoder) {
	for _, frame := range s {
		enc.AddObject(stackFrame(frame))
	}
}

// IsNil returns true if stackFrames is empty slice.
func (s stackFrames) IsNil() bool {
	return len(s) == 0
}

type stackFrame runtime.Frame

// MarshalJSONArray encodes stackFrame as JSON.
func (f stackFrame) MarshalJSONObject(enc *gojay.Encoder) {
	enc.AddStringKey("Function", f.Function)
	enc.AddStringKey("File", f.File)
	enc.AddIntKey("Line", f.Line)
}

func (f stackFrame) IsNil() bool {
	return false
}

type jsonFields logr.Fields

// MarshalJSONObject encodes Fields map to JSON.
func (f jsonFields) MarshalJSONObject(enc *gojay.Encoder) {
	for k, v := range f {
		encodeField(enc, k, v)
	}
}

// IsNil returns true if map is nil.
func (f jsonFields) IsNil() bool {
	return f == nil
}

func encodeField(enc *gojay.Encoder, key string, val interface{}) {
	switch vt := val.(type) {
	case gojay.MarshalerJSONObject:
		enc.AddObjectKey(key, vt)
	case gojay.MarshalerJSONArray:
		enc.AddArrayKey(key, vt)
	case string:
		enc.AddStringKey(key, vt)
	case error:
		enc.AddStringKey(key, vt.Error())
	case bool:
		enc.AddBoolKey(key, vt)
	case int:
		enc.AddIntKey(key, vt)
	case int64:
		enc.AddInt64Key(key, vt)
	case int32:
		enc.AddIntKey(key, int(vt))
	case int16:
		enc.AddIntKey(key, int(vt))
	case int8:
		enc.AddIntKey(key, int(vt))
	case uint64:
		enc.AddIntKey(key, int(vt))
	case uint32:
		enc.AddIntKey(key, int(vt))
	case uint16:
		enc.AddIntKey(key, int(vt))
	case uint8:
		enc.AddIntKey(key, int(vt))
	case float64:
		enc.AddFloatKey(key, vt)
	case float32:
		enc.AddFloat32Key(key, vt)
	case *gojay.EmbeddedJSON:
		enc.AddEmbeddedJSONKey(key, vt)
	case time.Time:
		enc.AddTimeKey(key, &vt, logr.DefTimestampFormat)
	case *time.Time:
		enc.AddTimeKey(key, vt, logr.DefTimestampFormat)
	default:
		s := fmt.Sprintf("%v", vt)
		enc.AddStringKey(key, s)
	}
}
