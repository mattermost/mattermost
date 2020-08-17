package chalk

import "fmt"

// Color represents one of the ANSI color escape codes.
// http://en.wikipedia.org/wiki/ANSI_escape_code#Colors
type Color struct {
	value int
}

// Value returns the individual value for this color
// (Actually it's really just its index in the list
// of color escape codes with the list being
// [black, red, green, yellow, blue, magenta, cyan, white].
func (c Color) Value() int {
	return c.value
}

// Color colors the foreground of the given string
// (whatever the previous background color was, it is
// left alone).
func (c Color) Color(val string) string {
	return fmt.Sprintf("%s%s%s", c, val, ResetColor)
}

func (c Color) String() string {
	return fmt.Sprintf("\u001b[%dm", 30+c.value)
}

// NewStyle creates a style with a foreground of the
// color we're creating the style from.
func (c Color) NewStyle() Style {
	return &style{foreground: c}
}

type textStyleDemarcation int

func (t textStyleDemarcation) String() string {
	return fmt.Sprintf("\u001b[%dm", t)
}

// A TextStyle represents the ways we can style the text:
// bold, dim, italic, underline, inverse, hidden or strikethrough.
type TextStyle struct {
	start, stop textStyleDemarcation
}

// TextStyle styles the given string using the desired text style.
func (t TextStyle) TextStyle(val string) string {
	if t == emptyTextStyle {
		return val
	}
	return fmt.Sprintf("%s%s%s", t.start, val, t.stop)
}

// NOTE: this function specifically does not work as desired because
// text styles must be wrapped around the text they are meant to style.
// As such, use TextStyle() or Style.Style() instead.
func (t TextStyle) String() string {
	return fmt.Sprintf("%s%s", t.start, t.stop)
}

// NewStyle creates a style starting with the current TextStyle
// as its text style.
func (t TextStyle) NewStyle() Style {
	return &style{textStyle: t}
}

// A Style is how we want our text to look in the console.
// Consequently, we can set the foreground and background
// to specific colors, we can style specific strings and
// can also use this style in a builder pattern should we
// wish (these will be more useful once styles such as
// italics are supported).
type Style interface {
	// Foreground sets the foreground of the style to the specific color.
	Foreground(Color)
	// Background sets the background of the style to the specific color.
	Background(Color)
	// Style styles the given string with the current style.
	Style(string) string
	// WithBackground allows us to set the background in a builder
	// pattern style.
	WithBackground(Color) Style
	// WithForeground allows us to set the foreground in a builder
	// pattern style.
	WithForeground(Color) Style
	// WithStyle allows us to set the text style in a builder pattern
	// style.
	WithTextStyle(TextStyle) Style
	String() string
}

type style struct {
	foreground Color
	background Color
	textStyle  TextStyle
}

func (s *style) WithBackground(col Color) Style {
	s.Background(col)
	return s
}

func (s *style) WithForeground(col Color) Style {
	s.Foreground(col)
	return s
}

func (s *style) String() string {
	var toReturn string
	toReturn = fmt.Sprintf("\u001b[%dm", 40+s.background.Value())
	return toReturn + fmt.Sprintf("\u001b[%dm", 30+s.foreground.Value())
}

func (s *style) Style(val string) string {
	return fmt.Sprintf("%s%s%s", s, s.textStyle.TextStyle(val), Reset)
}

func (s *style) Foreground(col Color) {
	s.foreground = col
}

func (s *style) Background(col Color) {
	s.background = col
}

func (s *style) WithTextStyle(textStyle TextStyle) Style {
	s.textStyle = textStyle
	return s
}

var (
	// Colors

	Black      = Color{0}
	Red        = Color{1}
	Green      = Color{2}
	Yellow     = Color{3}
	Blue       = Color{4}
	Magenta    = Color{5}
	Cyan       = Color{6}
	White      = Color{7}
	ResetColor = Color{9}

	// Text Styles

	Bold          = TextStyle{1, 22}
	Dim           = TextStyle{2, 22}
	Italic        = TextStyle{3, 23}
	Underline     = TextStyle{4, 24}
	Inverse       = TextStyle{7, 27}
	Hidden        = TextStyle{8, 28}
	Strikethrough = TextStyle{9, 29}

	Reset = &style{
		foreground: ResetColor,
		background: ResetColor,
	}

	emptyTextStyle = TextStyle{}
)
