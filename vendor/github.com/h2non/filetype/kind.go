package filetype

import (
	"github.com/h2non/filetype/matchers"
	"github.com/h2non/filetype/types"
)

// Image tries to match a file as image type
func Image(buf []byte) (types.Type, error) {
	return doMatchMap(buf, matchers.Image)
}

// IsImage checks if the given buffer is an image type
func IsImage(buf []byte) bool {
	kind, _ := Image(buf)
	return kind != types.Unknown
}

// Audio tries to match a file as audio type
func Audio(buf []byte) (types.Type, error) {
	return doMatchMap(buf, matchers.Audio)
}

// IsAudio checks if the given buffer is an audio type
func IsAudio(buf []byte) bool {
	kind, _ := Audio(buf)
	return kind != types.Unknown
}

// Video tries to match a file as video type
func Video(buf []byte) (types.Type, error) {
	return doMatchMap(buf, matchers.Video)
}

// IsVideo checks if the given buffer is a video type
func IsVideo(buf []byte) bool {
	kind, _ := Video(buf)
	return kind != types.Unknown
}

// Font tries to match a file as text font type
func Font(buf []byte) (types.Type, error) {
	return doMatchMap(buf, matchers.Font)
}

// IsFont checks if the given buffer is a font type
func IsFont(buf []byte) bool {
	kind, _ := Font(buf)
	return kind != types.Unknown
}

// Archive tries to match a file as generic archive type
func Archive(buf []byte) (types.Type, error) {
	return doMatchMap(buf, matchers.Archive)
}

// IsArchive checks if the given buffer is an archive type
func IsArchive(buf []byte) bool {
	kind, _ := Archive(buf)
	return kind != types.Unknown
}

// Document tries to match a file as document type
func Document(buf []byte) (types.Type, error) {
	return doMatchMap(buf, matchers.Document)
}

// IsDocument checks if the given buffer is an document type
func IsDocument(buf []byte) bool {
	kind, _ := Document(buf)
	return kind != types.Unknown
}

func doMatchMap(buf []byte, machers matchers.Map) (types.Type, error) {
	kind := MatchMap(buf, machers)
	if kind != types.Unknown {
		return kind, nil
	}
	return kind, ErrUnknownBuffer
}
