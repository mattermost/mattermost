package process

import "testing"

func TestSanitizePTY(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"plain text", "hello world", "hello world"},
		{"SGR color preserved", "\x1b[31mred\x1b[0m", "\x1b[31mred\x1b[0m"},
		{"cursor up stripped", "\x1b[1Ahello", "hello"},
		{"cursor down stripped", "\x1b[2Bhello", "hello"},
		{"clear line stripped", "\x1b[2Khello", "hello"},
		{"erase to end stripped", "\x1b[Khello", "hello"},
		{"cursor position stripped", "\x1b[10;20Hhello", "hello"},
		{"OSC title stripped", "\x1b]0;title\x07hello", "hello"},
		{"mixed SGR and cursor", "\x1b[31m\x1b[1Ared\x1b[0m", "\x1b[31mred\x1b[0m"},
		{"complex SGR preserved", "\x1b[1;38;5;214mbold orange\x1b[0m", "\x1b[1;38;5;214mbold orange\x1b[0m"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizePTY(tt.input)
			if got != tt.want {
				t.Errorf("sanitizePTY(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestHandleCR(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"no CR", "hello", "hello"},
		{"simple CR", "old text\rnew", "new text"},
		{"full overwrite", "abc\rXYZ", "XYZ"},
		{"progress bar", "Progress: 50%\rProgress: 75%\rProgress: 100%", "Progress: 100%"},
		{"CR at start", "\rhello", "hello"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := handleCR(tt.input)
			if got != tt.want {
				t.Errorf("handleCR(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
