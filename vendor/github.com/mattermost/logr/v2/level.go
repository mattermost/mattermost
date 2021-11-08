package logr

var AnsiColorPrefix = []byte("\u001b[")
var AnsiColorSuffix = []byte("m")

// Color for formatters that support color output.
type Color uint8

const (
	NoColor Color = 0
	Red     Color = 31
	Green   Color = 32
	Yellow  Color = 33
	Blue    Color = 34
	Magenta Color = 35
	Cyan    Color = 36
	White   Color = 37
)

// LevelID is the unique id of each level.
type LevelID uint

// Level provides a mechanism to enable/disable specific log lines.
type Level struct {
	ID         LevelID `json:"id"`
	Name       string  `json:"name"`
	Stacktrace bool    `json:"stacktrace,omitempty"`
	Color      Color   `json:"color,omitempty"`
}

// String returns the name of this level.
func (level Level) String() string {
	return level.Name
}
