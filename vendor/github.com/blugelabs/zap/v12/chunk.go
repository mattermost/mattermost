package zap

import (
	"fmt"
)

// LegacyChunkMode was the original chunk mode (always chunk size 1024)
// this mode is still used for chunking doc values.
var LegacyChunkMode uint32 = 1024

// DefaultChunkMode is the most recent improvement to chunking and should
// be used by default.
var DefaultChunkMode uint32 = 1025

func getChunkSize(chunkMode uint32, cardinality uint64, maxDocs uint64) (uint64, error) {
	switch {
	// any chunkMode <= 1024 will always chunk with chunkSize=chunkMode
	case chunkMode <= 1024:
		// legacy chunk size
		return uint64(chunkMode), nil

	case chunkMode == 1025:
		// attempt at simple improvement
		// theory - the point of chunking is to put a bound on the maximum number of
		// calls to Next() needed to find a random document.  ie, you should be able
		// to do one jump to the correct chunk, and then walk through at most
		// chunk-size items
		// previously 1024 was chosen as the chunk size, but this is particularly
		// wasteful for low cardinality terms.  the observation is that if there
		// are less than 1024 items, why not put them all in one chunk,
		// this way you'll still achieve the same goal of visiting at most
		// chunk-size items.
		// no attempt is made to tweak any other case
		if cardinality <= 1024 {
			return maxDocs, nil
		}
		return 1024, nil
	}
	return 0, fmt.Errorf("unknown chunk mode %d", chunkMode)
}
