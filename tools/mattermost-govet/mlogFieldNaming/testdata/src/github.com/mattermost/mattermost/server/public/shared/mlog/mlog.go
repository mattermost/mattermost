package mlog

type Field struct {
	Key string
}

func Any(key string, val any) Field      { return Field{Key: key} }
func Array(key string, val any) Field    { return Field{Key: key} }
func Bool(key string, val bool) Field    { return Field{Key: key} }
func Duration(key string, val any) Field { return Field{Key: key} }
func Float(key string, val float64) Field {
	return Field{Key: key}
}
func Int(key string, val int) Field        { return Field{Key: key} }
func Map(key string, val any) Field        { return Field{Key: key} }
func Millis(key string, val int64) Field   { return Field{Key: key} }
func NamedErr(key string, err error) Field { return Field{Key: key} }
func String(key string, val string) Field  { return Field{Key: key} }
func Stringer(key string, val any) Field   { return Field{Key: key} }
func Time(key string, val any) Field       { return Field{Key: key} }
func Uint(key string, val uint) Field      { return Field{Key: key} }

func Err(err error) Field { return Field{Key: "error"} }

func Debug(msg string, fields ...Field) {}
func Info(msg string, fields ...Field)  {}
func Error(msg string, fields ...Field) {}
