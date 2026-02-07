package process

import (
	"strings"
	"sync"
	"time"
)

type LogLevel int

const (
	LogLevelAll LogLevel = iota
	LogLevelDebug
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

type LogLine struct {
	Number    int
	Timestamp time.Time
	Text      string
	Level     LogLevel
}

type LogBuffer struct {
	mu       sync.RWMutex
	lines    []LogLine
	capacity int
	count    int
}

func NewLogBuffer(capacity int) *LogBuffer {
	if capacity <= 0 {
		capacity = 10000
	}
	return &LogBuffer{
		lines:    make([]LogLine, 0, capacity),
		capacity: capacity,
	}
}

func (b *LogBuffer) Append(text string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.count++
	line := LogLine{
		Number:    b.count,
		Timestamp: time.Now(),
		Text:      text,
		Level:     detectLogLevel(text),
	}

	if len(b.lines) < b.capacity {
		b.lines = append(b.lines, line)
	} else {
		// Ring buffer: overwrite oldest
		b.lines[b.count%b.capacity] = line
	}
}

func (b *LogBuffer) Lines() []LogLine {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if len(b.lines) < b.capacity {
		result := make([]LogLine, len(b.lines))
		copy(result, b.lines)
		return result
	}

	// Reconstruct in order from ring buffer
	result := make([]LogLine, b.capacity)
	start := (b.count + 1) % b.capacity
	for i := 0; i < b.capacity; i++ {
		result[i] = b.lines[(start+i)%b.capacity]
	}
	return result
}

func (b *LogBuffer) Filter(minLevel LogLevel, query string) []LogLine {
	all := b.Lines()
	if minLevel == LogLevelAll && query == "" {
		return all
	}

	query = strings.ToLower(query)
	var filtered []LogLine
	for _, l := range all {
		if minLevel != LogLevelAll && l.Level < minLevel {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(l.Text), query) {
			continue
		}
		filtered = append(filtered, l)
	}
	return filtered
}

func (b *LogBuffer) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.lines)
}

func detectLogLevel(text string) LogLevel {
	lower := strings.ToLower(text)
	switch {
	case strings.Contains(lower, "[error]") || strings.Contains(lower, "level=error") || strings.Contains(lower, "\"level\":\"error\""):
		return LogLevelError
	case strings.Contains(lower, "[warn]") || strings.Contains(lower, "level=warn") || strings.Contains(lower, "\"level\":\"warn\""):
		return LogLevelWarn
	case strings.Contains(lower, "[info]") || strings.Contains(lower, "level=info") || strings.Contains(lower, "\"level\":\"info\""):
		return LogLevelInfo
	case strings.Contains(lower, "[debug]") || strings.Contains(lower, "level=debug") || strings.Contains(lower, "\"level\":\"debug\""):
		return LogLevelDebug
	default:
		return LogLevelAll
	}
}
