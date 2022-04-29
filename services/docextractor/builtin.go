package docextractor

import "io"

type BuiltinExtractorService struct{}

func (BuiltinExtractorService) Extract(filename string, r io.ReadSeeker, settings ExtractSettings) (string, error) {
	return Extract(filename, r, settings)
}
