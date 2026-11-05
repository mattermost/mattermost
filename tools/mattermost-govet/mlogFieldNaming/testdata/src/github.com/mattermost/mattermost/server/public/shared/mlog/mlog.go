package mlog

type Field struct {
	Key string
}

func Any(key string, val any) Field        { return Field{Key: key} }
func Duration(key string, val any) Field   { return Field{Key: key} }
func Millis(key string, val int64) Field   { return Field{Key: key} }
func NamedErr(key string, err error) Field { return Field{Key: key} }
func Stringer(key string, val any) Field   { return Field{Key: key} }
func Time(key string, val any) Field       { return Field{Key: key} }

// The remaining constructors are generic, mirroring the real mlog package, so
// that the fixture exercises explicitly instantiated calls.

func Array[S ~[]E, E any](key string, val S) Field { return Field{Key: key} }

func Bool[T ~bool](key string, val T) Field { return Field{Key: key} }

func Float[T ~float32 | ~float64](key string, val T) Field { return Field{Key: key} }

func Int[T ~int | ~int8 | ~int16 | ~int32 | ~int64](key string, val T) Field {
	return Field{Key: key}
}

func Map[M ~map[K]V, K comparable, V any](key string, val M) Field { return Field{Key: key} }

func String[T ~string | ~[]byte](key string, val T) Field { return Field{Key: key} }

func Uint[T ~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 | ~uintptr](key string, val T) Field {
	return Field{Key: key}
}

func Err(err error) Field { return Field{Key: "error"} }

func Debug(msg string, fields ...Field) {}
func Info(msg string, fields ...Field)  {}
func Error(msg string, fields ...Field) {}
