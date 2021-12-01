package formatters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"runtime"
	"strings"
	"sync"

	"github.com/francoispqt/gojay"
	"github.com/mattermost/logr/v2"
)

// JSON formats log records as JSON.
type JSON struct {
	// DisableTimestamp disables output of timestamp field.
	DisableTimestamp bool `json:"disable_timestamp"`
	// DisableLevel disables output of level field.
	DisableLevel bool `json:"disable_level"`
	// DisableMsg disables output of msg field.
	DisableMsg bool `json:"disable_msg"`
	// DisableFields disables output of all fields.
	DisableFields bool `json:"disable_fields"`
	// DisableStacktrace disables output of stack trace.
	DisableStacktrace bool `json:"disable_stacktrace"`
	// EnableCaller enables output of the file and line number that emitted a log record.
	EnableCaller bool `json:"enable_caller"`

	// TimestampFormat is an optional format for timestamps. If empty
	// then DefTimestampFormat is used.
	TimestampFormat string `json:"timestamp_format"`

	// KeyTimestamp overrides the timestamp field key name.
	KeyTimestamp string `json:"key_timestamp"`

	// KeyLevel overrides the level field key name.
	KeyLevel string `json:"key_level"`

	// KeyMsg overrides the msg field key name.
	KeyMsg string `json:"key_msg"`

	// KeyGroupFields when not empty will group all context fields
	// under this key.
	KeyGroupFields string `json:"key_group_fields"`

	// KeyStacktrace overrides the stacktrace field key name.
	KeyStacktrace string `json:"key_stacktrace"`

	// KeyCaller overrides the caller field key name.
	KeyCaller string `json:"key_caller"`

	// FieldSorter allows custom sorting of the fields. If nil then
	// no sorting is done.
	FieldSorter func(fields []logr.Field) []logr.Field `json:"-"`

	once sync.Once
}

func (j *JSON) CheckValid() error {
	return nil
}

// IsStacktraceNeeded returns true if a stacktrace is needed so we can output the `Caller` field.
func (j *JSON) IsStacktraceNeeded() bool {
	return j.EnableCaller
}

// Format converts a log record to bytes in JSON format.
func (j *JSON) Format(rec *logr.LogRec, level logr.Level, buf *bytes.Buffer) (*bytes.Buffer, error) {
	j.once.Do(j.applyDefaultKeyNames)

	if buf == nil {
		buf = &bytes.Buffer{}
	}
	enc := gojay.BorrowEncoder(buf)
	defer func() {
		enc.Release()
	}()

	jlr := JSONLogRec{
		LogRec: rec,
		JSON:   j,
		level:  level,
		sorter: j.FieldSorter,
	}

	err := enc.EncodeObject(jlr)
	if err != nil {
		return nil, err
	}
	buf.WriteByte('\n')
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
	if j.KeyCaller == "" {
		j.KeyCaller = "caller"
	}
}

// JSONLogRec decorates a LogRec adding JSON encoding.
type JSONLogRec struct {
	*logr.LogRec
	*JSON
	level  logr.Level
	sorter func(fields []logr.Field) []logr.Field
}

// MarshalJSONObject encodes the LogRec as JSON.
func (jlr JSONLogRec) MarshalJSONObject(enc *gojay.Encoder) {
	if !jlr.DisableTimestamp {
		timestampFmt := jlr.TimestampFormat
		if timestampFmt == "" {
			timestampFmt = logr.DefTimestampFormat
		}
		time := jlr.Time()
		enc.AddTimeKey(jlr.KeyTimestamp, &time, timestampFmt)
	}
	if !jlr.DisableLevel {
		enc.AddStringKey(jlr.KeyLevel, jlr.level.Name)
	}
	if !jlr.DisableMsg {
		enc.AddStringKey(jlr.KeyMsg, jlr.Msg())
	}
	if jlr.EnableCaller {
		enc.AddStringKey(jlr.KeyCaller, jlr.Caller())
	}
	if !jlr.DisableFields {
		fields := jlr.Fields()
		if jlr.sorter != nil {
			fields = jlr.sorter(fields)
		}
		if jlr.KeyGroupFields != "" {
			enc.AddObjectKey(jlr.KeyGroupFields, FieldArray(fields))
		} else {
			if len(fields) > 0 {
				for _, field := range fields {
					field = jlr.prefixCollision(field)
					if err := encodeField(enc, field); err != nil {
						enc.AddStringKey(field.Key, "<error encoding field: "+err.Error()+">")
					}
				}
			}
		}
	}
	if jlr.level.Stacktrace && !jlr.DisableStacktrace {
		frames := jlr.StackFrames()
		if len(frames) > 0 {
			enc.AddArrayKey(jlr.KeyStacktrace, stackFrames(frames))
		}
	}
}

// IsNil returns true if the LogRec pointer is nil.
func (rec JSONLogRec) IsNil() bool {
	return rec.LogRec == nil
}

func (rec JSONLogRec) prefixCollision(field logr.Field) logr.Field {
	switch field.Key {
	case rec.KeyTimestamp, rec.KeyLevel, rec.KeyMsg, rec.KeyStacktrace:
		f := field
		f.Key = "_" + field.Key
		return rec.prefixCollision(f)
	}
	return field
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

type FieldArray []logr.Field

// MarshalJSONObject encodes Fields map to JSON.
func (fa FieldArray) MarshalJSONObject(enc *gojay.Encoder) {
	for _, fld := range fa {
		if err := encodeField(enc, fld); err != nil {
			enc.AddStringKey(fld.Key, "<error encoding field: "+err.Error()+">")
		}
	}
}

// IsNil returns true if map is nil.
func (fa FieldArray) IsNil() bool {
	return fa == nil
}

func encodeField(enc *gojay.Encoder, field logr.Field) error {
	// first check if the value has a marshaller already.
	switch vt := field.Interface.(type) {
	case gojay.MarshalerJSONObject:
		enc.AddObjectKey(field.Key, vt)
		return nil
	case gojay.MarshalerJSONArray:
		enc.AddArrayKey(field.Key, vt)
		return nil
	}

	switch field.Type {
	case logr.StringType:
		enc.AddStringKey(field.Key, field.String)

	case logr.BoolType:
		var b bool
		if field.Integer != 0 {
			b = true
		}
		enc.AddBoolKey(field.Key, b)

	case logr.StructType, logr.ArrayType, logr.MapType, logr.UnknownType:
		b, err := json.Marshal(field.Interface)
		if err != nil {
			return err
		}
		embed := gojay.EmbeddedJSON(b)
		enc.AddEmbeddedJSONKey(field.Key, &embed)

	case logr.StringerType, logr.ErrorType, logr.TimestampMillisType, logr.TimeType, logr.DurationType, logr.BinaryType:
		var buf strings.Builder
		_ = field.ValueString(&buf, nil)
		enc.AddStringKey(field.Key, buf.String())

	case logr.Int64Type, logr.Int32Type, logr.IntType:
		enc.AddInt64Key(field.Key, field.Integer)

	case logr.Uint64Type, logr.Uint32Type, logr.UintType:
		enc.AddUint64Key(field.Key, uint64(field.Integer))

	case logr.Float64Type, logr.Float32Type:
		enc.AddFloat64Key(field.Key, field.Float)

	default:
		return fmt.Errorf("invalid field type: %d", field.Type)
	}
	return nil
}
