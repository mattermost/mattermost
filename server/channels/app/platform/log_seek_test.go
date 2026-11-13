// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"io"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/logr/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// countingReaderAt counts the bytes read through it.
type countingReaderAt struct {
	r    io.ReaderAt
	read int64
}

func (c *countingReaderAt) ReadAt(p []byte, off int64) (int, error) {
	n, err := c.r.ReadAt(p, off)
	c.read += int64(n)
	return n, err
}

func TestLogScanEnd(t *testing.T) {
	start := time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)
	lines := dateToTestLogFile(start, 20000)
	content := strings.Join(lines, "\n")
	size := int64(len(content))
	require.Greater(t, size, int64(50*logReadBlockSize))

	// offsets[i] is where line i starts
	offsets := make([]int64, len(lines))
	for i := 1; i < len(lines); i++ {
		offsets[i] = offsets[i-1] + int64(len(lines[i-1])) + 1
	}

	t.Run("ends on a line break past every entry in range", func(t *testing.T) {
		for _, i := range []int{0, 1, 2, 100, 999, 5000, 12345, 19000, 19500, 19800} {
			for _, offset := range []time.Duration{0, 500 * time.Millisecond} {
				dateTo := start.Add(time.Duration(i)*time.Second + offset)
				t.Run(dateTo.Format(logr.DefTimestampFormat), func(t *testing.T) {
					reader := &countingReaderAt{r: strings.NewReader(content)}

					end := logScanEnd(reader, size, dateTo)

					// line i is the newest in range, so line i+1 has to be read too
					firstNewer := offsets[i+1]
					assert.Greater(t, end, firstNewer+int64(len(lines[i+1])))
					assert.LessOrEqual(t, end, firstNewer+3*logReadBlockSize)
					if end < size {
						assert.Equal(t, byte('\n'), content[end])
					}
					assert.Less(t, reader.read, int64(20*logSeekProbeSize))
				})
			}
		}
	})

	t.Run("date to after the last entry", func(t *testing.T) {
		assert.Equal(t, size, logScanEnd(strings.NewReader(content), size, start.Add(time.Duration(len(lines))*time.Second)))
	})

	t.Run("date to before the first entry", func(t *testing.T) {
		end := logScanEnd(strings.NewReader(content), size, start.Add(-time.Hour))
		assert.Less(t, end, int64(2*logReadBlockSize))
		assert.Equal(t, byte('\n'), content[end])
	})

	t.Run("file no longer than a block", func(t *testing.T) {
		small := strings.Join(lines[:100], "\n")
		require.Less(t, len(small), logReadBlockSize)
		assert.Equal(t, int64(len(small)), logScanEnd(strings.NewReader(small), int64(len(small)), start))
	})

	t.Run("long or unparseable lines at a probe point", func(t *testing.T) {
		dateTo := start.Add(time.Hour)
		badTimestamp := logLine("bad timestamp", "info", strings.Repeat("x", 100)) + "\n"
		longEntry := func(n int) string {
			// in order, as a large error might log
			return logLine(start.Add(10000*time.Second).Format(logr.DefTimestampFormat), "error", strings.Repeat("x", n)) + "\n"
		}

		for _, tc := range []struct {
			name string
			junk string
			// the junk is repeated to about this many bytes
			junkSize int
			// whether the probe reads nothing but junk, so the whole file is scanned
			fullScan bool
		}{
			{"unparseable lines within a block", "not json\n", logReadBlockSize / 2, false},
			{"bad timestamps within a block", badTimestamp, logReadBlockSize / 2, false},
			{"long line within a block", strings.Repeat("y", logReadBlockSize/2) + "\n", logReadBlockSize / 2, false},
			{"long entry within a block", longEntry(logReadBlockSize / 2), logReadBlockSize / 2, false},
			{"unparseable lines past a block", "not json\n", 3 * logReadBlockSize, true},
			{"bad timestamps past a block", badTimestamp, 3 * logReadBlockSize, true},
			{"long line past a block", strings.Repeat("y", 2*logReadBlockSize) + "\n", 3 * logReadBlockSize, true},
			{"long entry past a block", longEntry(2 * logReadBlockSize), 3 * logReadBlockSize, true},
		} {
			t.Run(tc.name, func(t *testing.T) {
				// Inserting the junk in the middle of the file moves the middle, where the first
				// probe lands, to halfway through the junk.
				var sb strings.Builder
				inserted := false
				for _, line := range lines {
					if !inserted && sb.Len() >= int(size/2) {
						sb.WriteString(strings.Repeat(tc.junk, tc.junkSize/len(tc.junk)+1))
						inserted = true
					}
					sb.WriteString(line)
					sb.WriteByte('\n')
				}
				withJunk := strings.TrimSuffix(sb.String(), "\n")
				reader := &countingReaderAt{r: strings.NewReader(withJunk)}

				end := logScanEnd(reader, int64(len(withJunk)), dateTo)

				if tc.fullScan {
					assert.Equal(t, int64(len(withJunk)), end)
					return
				}
				// line 3601 is the first after the range, and the junk is well after it
				assert.Greater(t, end, offsets[3601]+int64(len(lines[3601])))
				require.Less(t, end, int64(len(withJunk))/2)
				assert.Equal(t, byte('\n'), withJunk[end])
				assert.Less(t, reader.read, int64(4*logReadBlockSize))
			})
		}
	})

	t.Run("unparseable lines between parseable ones are skipped", func(t *testing.T) {
		var sb strings.Builder
		for i, line := range lines {
			if i%3 == 0 {
				sb.WriteString("not json\n")
			}
			sb.WriteString(line)
			sb.WriteByte('\n')
		}
		withJunk := strings.TrimSuffix(sb.String(), "\n")

		assert.Less(t, logScanEnd(strings.NewReader(withJunk), int64(len(withJunk)), start.Add(time.Hour)), int64(len(withJunk)/2))
	})

	t.Run("read error", func(t *testing.T) {
		// size is past the end of the reader
		assert.Equal(t, 2*size, logScanEnd(strings.NewReader(content), 2*size, start))
	})
}
