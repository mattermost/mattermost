// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"
	"io"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// logSeekProbeSize is how much of the log file each probe of logScanEnd reads at first.
const logSeekProbeSize = 4 * 1024

// logScanEnd returns where a backwards scan for entries no newer than dateTo can stop reading the
// first size bytes of r instead of at size. It binary-searches the file for the first entry newer
// than dateTo, then ends one block later, on a line break, so that entries slightly out of order
// around it are still read. The caller still filters each entry by date.
//
// It returns size, so the whole file is scanned as before, whenever a probe finds no line with a
// timestamp it can parse within a block, or the file can't be read.
func logScanEnd(r io.ReaderAt, size int64, dateTo time.Time) int64 {
	buf := make([]byte, logReadBlockSize)

	// Every entry that starts after hi is newer than dateTo, or hi is size.
	lo, hi := int64(0), size
	for hi-lo > logReadBlockSize {
		mid := lo + (hi-lo)/2
		timestamp, ok := probeLogTimestamp(r, size, mid, buf)
		if !ok {
			return size
		}
		if timestamp.After(dateTo) {
			hi = mid
		} else {
			lo = mid + 1
		}
	}

	end := hi + logReadBlockSize
	if end >= size {
		return size
	}

	// End on a line break, so that the scan starts with a whole line
	for offset := end; offset < size; offset += logSeekProbeSize {
		n := int(min(logSeekProbeSize, size-offset))
		if read, _ := r.ReadAt(buf[:n], offset); read < n {
			return size
		}
		if i := bytes.IndexByte(buf[:n], '\n'); i >= 0 {
			return offset + int64(i)
		}
	}

	return size
}

// probeLogTimestamp returns the timestamp of the first entry that starts after offset (or at it, when
// offset is 0), in the first size bytes of r, and parses within the bytes read into buf. A line that
// starts exactly at a non-zero offset is skipped, as it can't be told apart from one that started
// before it.
//
// It reads logSeekProbeSize bytes first, and twice as many each time none of the lines read parse,
// up to len(buf), so that a long line or a few unparseable ones don't end the search.
func probeLogTimestamp(r io.ReaderAt, size, offset int64, buf []byte) (time.Time, bool) {
	maxRead := int(min(int64(len(buf)), size-offset))
	read := 0
	for n := min(logSeekProbeSize, maxRead); ; n = min(2*n, maxRead) {
		if got, _ := r.ReadAt(buf[read:n], offset+int64(read)); got < n-read {
			return time.Time{}, false
		}
		read = n

		if timestamp, ok := firstLogTimestamp(buf[:n], offset == 0, offset+int64(n) == size); ok {
			return timestamp, true
		}
		if n == maxRead {
			return time.Time{}, false
		}
	}
}

// firstLogTimestamp returns the timestamp of the first whole line in data that parses as an entry.
// Unless fromLineStart, data starts partway through a line, which is skipped. Unless atEnd, the
// last line in data may go on past it, so it isn't parsed.
func firstLogTimestamp(data []byte, fromLineStart, atEnd bool) (time.Time, bool) {
	if !fromLineStart {
		i := bytes.IndexByte(data, '\n')
		if i < 0 {
			return time.Time{}, false
		}
		data = data[i+1:]
	}

	for len(data) > 0 {
		line := data
		if i := bytes.IndexByte(data, '\n'); i >= 0 {
			line, data = data[:i], data[i+1:]
		} else if atEnd {
			data = nil
		} else {
			// the line goes on past what was read
			break
		}

		// decoded as GetLogsSkipSend decodes it, so that both agree on an entry's timestamp
		var entry *model.LogEntry
		if json.Unmarshal(line, &entry) != nil || entry == nil {
			continue
		}
		if timestamp, ok := logEntryTimestamp(entry); ok {
			return timestamp, true
		}
	}

	return time.Time{}, false
}
