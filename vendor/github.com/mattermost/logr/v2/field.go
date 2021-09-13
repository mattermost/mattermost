package logr

import (
	"errors"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"time"
)

var (
	Comma   = []byte{','}
	Equals  = []byte{'='}
	Space   = []byte{' '}
	Newline = []byte{'\n'}
	Quote   = []byte{'"'}
	Colon   = []byte{':'}
)

// LogCloner is implemented by `Any` types that require a clone to be provided
// to the logger because the original may mutate.
type LogCloner interface {
	LogClone() interface{}
}

// LogWriter is implemented by `Any` types that provide custom formatting for
// log output. A string representation of the type should be written directly to
// the `io.Writer`.
type LogWriter interface {
	LogWrite(w io.Writer) error
}

type FieldType uint8

const (
	UnknownType FieldType = iota
	StringType
	StringerType
	StructType
	ErrorType
	BoolType
	TimestampMillisType
	TimeType
	DurationType
	Int64Type
	Int32Type
	IntType
	Uint64Type
	Uint32Type
	UintType
	Float64Type
	Float32Type
	BinaryType
	ArrayType
	MapType
)

type Field struct {
	Key       string
	Type      FieldType
	Integer   int64
	Float     float64
	String    string
	Interface interface{}
}

func quoteString(w io.Writer, s string, shouldQuote func(s string) bool) error {
	b := shouldQuote(s)
	if b {
		if _, err := w.Write(Quote); err != nil {
			return err
		}
	}

	if _, err := w.Write([]byte(s)); err != nil {
		return err
	}

	if b {
		if _, err := w.Write(Quote); err != nil {
			return err
		}
	}
	return nil
}

// ValueString converts a known type to a string using default formatting.
// This is called lazily by a formatter.
// Formatters can provide custom formatting or types passed via `Any` can implement
// the `LogString` interface to generate output for logging.
// If the optional shouldQuote callback is provided, then it will be called for any
// string output that could potentially need to be quoted.
func (f Field) ValueString(w io.Writer, shouldQuote func(s string) bool) error {
	if shouldQuote == nil {
		shouldQuote = func(s string) bool { return false }
	}
	var err error
	switch f.Type {
	case StringType:
		err = quoteString(w, f.String, shouldQuote)

	case StringerType:
		s, ok := f.Interface.(fmt.Stringer)
		if ok {
			err = quoteString(w, s.String(), shouldQuote)
		} else if f.Interface == nil {
			err = quoteString(w, "", shouldQuote)
		} else {
			err = fmt.Errorf("invalid fmt.Stringer for key %s", f.Key)
		}

	case StructType:
		s, ok := f.Interface.(LogWriter)
		if ok {
			err = s.LogWrite(w)
			break
		}
		// structs that do not implement LogWriter fall back to reflection via Printf.
		// TODO: create custom reflection-based encoder.
		_, err = fmt.Fprintf(w, "%v", f.Interface)

	case ErrorType:
		// TODO: create custom error encoder.
		err = quoteString(w, fmt.Sprintf("%v", f.Interface), shouldQuote)

	case BoolType:
		var b bool
		if f.Integer != 0 {
			b = true
		}
		_, err = io.WriteString(w, strconv.FormatBool(b))

	case TimestampMillisType:
		ts := time.Unix(f.Integer/1000, (f.Integer%1000)*int64(time.Millisecond))
		err = quoteString(w, ts.UTC().Format(TimestampMillisFormat), shouldQuote)

	case TimeType:
		t, ok := f.Interface.(time.Time)
		if !ok {
			err = errors.New("invalid time")
			break
		}
		err = quoteString(w, t.Format(DefTimestampFormat), shouldQuote)

	case DurationType:
		_, err = fmt.Fprintf(w, "%s", time.Duration(f.Integer))

	case Int64Type, Int32Type, IntType:
		_, err = io.WriteString(w, strconv.FormatInt(f.Integer, 10))

	case Uint64Type, Uint32Type, UintType:
		_, err = io.WriteString(w, strconv.FormatUint(uint64(f.Integer), 10))

	case Float64Type, Float32Type:
		size := 64
		if f.Type == Float32Type {
			size = 32
		}
		err = quoteString(w, strconv.FormatFloat(f.Float, 'f', -1, size), shouldQuote)

	case BinaryType:
		b, ok := f.Interface.([]byte)
		if ok {
			_, err = fmt.Fprintf(w, "[%X]", b)
			break
		}
		_, err = fmt.Fprintf(w, "[%v]", f.Interface)

	case ArrayType:
		a := reflect.ValueOf(f.Interface)
	arr:
		for i := 0; i < a.Len(); i++ {
			item := a.Index(i)
			switch v := item.Interface().(type) {
			case LogWriter:
				if err = v.LogWrite(w); err != nil {
					break arr
				}
			case fmt.Stringer:
				if err = quoteString(w, v.String(), shouldQuote); err != nil {
					break arr
				}
			default:
				s := fmt.Sprintf("%v", v)
				if err = quoteString(w, s, shouldQuote); err != nil {
					break arr
				}
			}
			if _, err = w.Write(Comma); err != nil {
				break arr
			}
		}

	case MapType:
		a := reflect.ValueOf(f.Interface)
		iter := a.MapRange()
	it:
		for iter.Next() {
			if _, err = io.WriteString(w, iter.Key().String()); err != nil {
				break it
			}
			if _, err = w.Write(Equals); err != nil {
				break it
			}
			val := iter.Value().Interface()
			switch v := val.(type) {
			case LogWriter:
				if err = v.LogWrite(w); err != nil {
					break it
				}
			case fmt.Stringer:
				if err = quoteString(w, v.String(), shouldQuote); err != nil {
					break it
				}
			default:
				s := fmt.Sprintf("%v", v)
				if err = quoteString(w, s, shouldQuote); err != nil {
					break it
				}
			}
			if _, err = w.Write(Comma); err != nil {
				break it
			}
		}

	case UnknownType:
		_, err = fmt.Fprintf(w, "%v", f.Interface)

	default:
		err = fmt.Errorf("invalid type %d", f.Type)
	}
	return err
}

func nilField(key string) Field {
	return String(key, "")
}

func fieldForAny(key string, val interface{}) Field {
	switch v := val.(type) {
	case LogCloner:
		if v == nil {
			return nilField(key)
		}
		c := v.LogClone()
		return Field{Key: key, Type: StructType, Interface: c}
	case *LogCloner:
		if v == nil {
			return nilField(key)
		}
		c := (*v).LogClone()
		return Field{Key: key, Type: StructType, Interface: c}
	case LogWriter:
		if v == nil {
			return nilField(key)
		}
		return Field{Key: key, Type: StructType, Interface: v}
	case *LogWriter:
		if v == nil {
			return nilField(key)
		}
		return Field{Key: key, Type: StructType, Interface: *v}
	case bool:
		return Bool(key, v)
	case *bool:
		if v == nil {
			return nilField(key)
		}
		return Bool(key, *v)
	case float64:
		return Float64(key, v)
	case *float64:
		if v == nil {
			return nilField(key)
		}
		return Float64(key, *v)
	case float32:
		return Float32(key, v)
	case *float32:
		if v == nil {
			return nilField(key)
		}
		return Float32(key, *v)
	case int:
		return Int(key, v)
	case *int:
		if v == nil {
			return nilField(key)
		}
		return Int(key, *v)
	case int64:
		return Int64(key, v)
	case *int64:
		if v == nil {
			return nilField(key)
		}
		return Int64(key, *v)
	case int32:
		return Int32(key, v)
	case *int32:
		if v == nil {
			return nilField(key)
		}
		return Int32(key, *v)
	case int16:
		return Int32(key, int32(v))
	case *int16:
		if v == nil {
			return nilField(key)
		}
		return Int32(key, int32(*v))
	case int8:
		return Int32(key, int32(v))
	case *int8:
		if v == nil {
			return nilField(key)
		}
		return Int32(key, int32(*v))
	case string:
		return String(key, v)
	case *string:
		if v == nil {
			return nilField(key)
		}
		return String(key, *v)
	case uint:
		return Uint(key, v)
	case *uint:
		if v == nil {
			return nilField(key)
		}
		return Uint(key, *v)
	case uint64:
		return Uint64(key, v)
	case *uint64:
		if v == nil {
			return nilField(key)
		}
		return Uint64(key, *v)
	case uint32:
		return Uint32(key, v)
	case *uint32:
		if v == nil {
			return nilField(key)
		}
		return Uint32(key, *v)
	case uint16:
		return Uint32(key, uint32(v))
	case *uint16:
		if v == nil {
			return nilField(key)
		}
		return Uint32(key, uint32(*v))
	case uint8:
		return Uint32(key, uint32(v))
	case *uint8:
		if v == nil {
			return nilField(key)
		}
		return Uint32(key, uint32(*v))
	case []byte:
		if v == nil {
			return nilField(key)
		}
		return Field{Key: key, Type: BinaryType, Interface: v}
	case time.Time:
		return Time(key, v)
	case *time.Time:
		if v == nil {
			return nilField(key)
		}
		return Time(key, *v)
	case time.Duration:
		return Duration(key, v)
	case *time.Duration:
		if v == nil {
			return nilField(key)
		}
		return Duration(key, *v)
	case error:
		return NamedErr(key, v)
	case fmt.Stringer:
		if v == nil {
			return nilField(key)
		}
		return Field{Key: key, Type: StringerType, Interface: v}
	case *fmt.Stringer:
		if v == nil {
			return nilField(key)
		}
		return Field{Key: key, Type: StringerType, Interface: *v}
	default:
		return Field{Key: key, Type: UnknownType, Interface: val}
	}
}

// FieldSorter provides sorting of an array of fields by key.
type FieldSorter []Field

func (fs FieldSorter) Len() int           { return len(fs) }
func (fs FieldSorter) Less(i, j int) bool { return fs[i].Key < fs[j].Key }
func (fs FieldSorter) Swap(i, j int)      { fs[i], fs[j] = fs[j], fs[i] }
