// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/stretchr/testify/require"
)

func TestBufReadSeeker(t *testing.T) {
	t.Run("Read", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		buf := make([]byte, 5)
		n, err := seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 5, n)
		require.Equal(t, []byte("hello"), buf)

		buf = make([]byte, 6)
		n, err = seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 6, n)
		require.Equal(t, []byte(" world"), buf)

		buf = make([]byte, 1)
		n, err = seeker.Read(buf)
		require.Equal(t, 0, n)
		require.ErrorIs(t, err, io.EOF)
	})

	t.Run("Seek forward from start", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		pos, err := seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		pos, err = seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		pos, err = seeker.Seek(7, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(7), pos)

		// Seeking backwards within the buffer is supported.
		pos, err = seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		buf := make([]byte, 5)
		n, err := io.ReadFull(seeker, buf)
		require.NoError(t, err)
		require.Equal(t, 5, n)
		require.Equal(t, []byte("world"), buf)
	})

	t.Run("Seek forward from current", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		buf := make([]byte, 6)
		n, err := seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 6, n)
		require.Equal(t, []byte("hello "), buf)

		pos, err := seeker.Seek(2, io.SeekCurrent)
		require.NoError(t, err)
		require.Equal(t, int64(8), pos)

		buf = make([]byte, 3)
		n, err = seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 3, n)
		require.Equal(t, []byte("rld"), buf)
	})

	t.Run("Seek invalid cases", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		pos, err := seeker.Seek(-1, io.SeekCurrent)
		require.EqualError(t, err, "seek: negative position -1")
		require.Equal(t, int64(0), pos)

		pos, err = seeker.Seek(0, io.SeekEnd)
		require.EqualError(t, err, "seek: unsupported whence 2")
		require.Equal(t, int64(0), pos)
	})

	t.Run("Seek backward to start and re-read", func(t *testing.T) {
		data := []byte("hello world")
		seeker := &bufReadSeeker{r: bytes.NewReader(data)}

		buf := make([]byte, len(data))
		_, err := io.ReadFull(seeker, buf)
		require.NoError(t, err)
		require.Equal(t, data, buf)

		pos, err := seeker.Seek(0, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(0), pos)

		buf2 := make([]byte, len(data))
		_, err = io.ReadFull(seeker, buf2)
		require.NoError(t, err)
		require.Equal(t, data, buf2)
	})

	t.Run("Seek beyond EOF", func(t *testing.T) {
		data := []byte("hello")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		n, err := seeker.Seek(10, io.SeekStart)
		require.ErrorIs(t, err, io.EOF)
		require.Equal(t, int64(5), n)
	})

	t.Run("Read enforces scan limit", func(t *testing.T) {
		seeker := &bufReadSeeker{
			r:   bytes.NewReader([]byte("x")),
			buf: make([]byte, maxExifScanSize),
			pos: maxExifScanSize,
		}
		_, err := seeker.Read(make([]byte, 1))
		require.EqualError(t, err, fmt.Sprintf("read exceeded %d-byte scan limit", maxExifScanSize))
	})

	t.Run("Read clamps large p to avoid overshooting scan limit", func(t *testing.T) {
		seeker := &bufReadSeeker{
			r:   bytes.NewReader([]byte("AB")),
			buf: make([]byte, maxExifScanSize-1),
			pos: maxExifScanSize - 1,
		}
		p := make([]byte, 4096)
		n, err := seeker.Read(p)
		require.NoError(t, err)
		require.Equal(t, 1, n)
		require.Equal(t, byte('A'), p[0])
		require.Equal(t, int64(maxExifScanSize), int64(len(seeker.buf)))
	})

	t.Run("Seek enforces scan limit", func(t *testing.T) {
		seeker := &bufReadSeeker{r: bytes.NewReader(nil)}
		pos, err := seeker.Seek(maxExifScanSize+1, io.SeekStart)
		require.EqualError(t, err, fmt.Sprintf("seek: target %d exceeds %d-byte scan limit", maxExifScanSize+1, maxExifScanSize))
		require.Equal(t, int64(0), pos)
	})
}

func TestGetImageOrientation(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok, "Failed to find exif samples directory")

	// Define orientations and their corresponding file prefixes
	orientations := map[string]int{
		"up":             Upright,
		"up-mirrored":    UprightMirrored,
		"down":           UpsideDown,
		"down-mirrored":  UpsideDownMirrored,
		"left":           RotatedCCW,
		"left-mirrored":  RotatedCWMirrored,
		"right":          RotatedCW,
		"right-mirrored": RotatedCCWMirrored,
	}

	// Define supported formats
	formats := []string{"jpg", "png", "tiff", "webp"}

	// Generate test cases for all combinations
	var testCases []struct {
		name                string
		fileName            string
		expectedOrientation int
	}

	for prefix, orientation := range orientations {
		for _, format := range formats {
			testCases = append(testCases, struct {
				name                string
				fileName            string
				expectedOrientation int
			}{
				name:                fmt.Sprintf("%s (%s)", prefix, format),
				fileName:            fmt.Sprintf("%s.%s", prefix, format),
				expectedOrientation: orientation,
			})
		}
	}

	dec, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)

	for _, tc := range testCases {
		var orientation int
		imgPath := filepath.Join(imgDir, tc.fileName)
		file, err := os.Open(imgPath)
		require.NoError(t, err)
		defer file.Close()

		_, format, err := dec.DecodeConfig(file)
		require.NoError(t, err)

		t.Run(tc.name+"_file", func(t *testing.T) {
			_, err = file.Seek(0, io.SeekStart)
			require.NoError(t, err)

			orientation, err = GetImageOrientation(file, format)
			require.NoError(t, err)
			require.Equal(t, tc.expectedOrientation, orientation, "Incorrect orientation detected for %s", tc.fileName)
		})

		t.Run(tc.name+"_reader", func(t *testing.T) {
			_, err = file.Seek(0, io.SeekStart)
			require.NoError(t, err)

			orientation, err = GetImageOrientation(&io.LimitedReader{R: file, N: 1024 * 1024}, format)
			require.NoError(t, err)
			require.Equal(t, tc.expectedOrientation, orientation, "Incorrect orientation detected for %s", tc.fileName)
		})
	}
}

func TestGetImageOrientationEdgeCases(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok, "Failed to find exif samples directory")

	t.Run("MIME type format string", func(t *testing.T) {
		file, err := os.Open(filepath.Join(imgDir, "up.jpg"))
		require.NoError(t, err)
		defer file.Close()

		orientation, err := GetImageOrientation(file, "image/jpeg")
		require.NoError(t, err)
		require.Equal(t, Upright, orientation)
	})

	t.Run("unsupported format returns error", func(t *testing.T) {
		_, err := GetImageOrientation(bytes.NewReader([]byte("data")), "gif")
		require.EqualError(t, err, "unsupported image format: gif")
	})
}

// nestedEXIF builds an EXIF payload — itself a TIFF stream — declaring a large
// nested tag structure: several sub-directory pointer tags, each holding a long
// array of offsets, all resolving to one sub-directory that holds many tags.
// The Orientation tag is declared after those pointers, so reading it requires
// walking past them: in the main directory, or in the thumbnail directory that
// follows it when thumbnailDir is set.
func nestedEXIF(tb testing.TB, offsetsPerPointer, subDirTags int, orientation uint16, thumbnailDir bool) []byte {
	tb.Helper()

	const (
		typeShort      = uint16(3) // 2-byte unsigned integer
		typeLong       = uint16(4) // 4-byte unsigned integer
		orientationTag = uint16(0x0112)
		headerLen      = 8  // byte order, magic number, offset of the first directory
		entryLen       = 12 // tag ID, type, value count, value or offset
		nextDirLen     = 4
	)

	// Tag IDs whose value points at a nested EXIF directory.
	pointerTags := []uint16{0x014a, 0x8769, 0x8825, 0xa005}

	mainDirTags := len(pointerTags)
	if !thumbnailDir {
		mainDirTags++
	}

	offsetsOff := uint32(headerLen + 2 + entryLen*mainDirTags + nextDirLen)
	subDirOff := offsetsOff + uint32(4*offsetsPerPointer)
	thumbnailDirOff := subDirOff + uint32(2+entryLen*subDirTags+nextDirLen)

	var exif bytes.Buffer
	write := func(v any) {
		require.NoError(tb, binary.Write(&exif, binary.BigEndian, v))
	}
	writeOrientation := func() {
		write(orientationTag)
		write(typeShort)
		write(uint32(1))   // value count
		write(orientation) // the value fits inline
		write(uint16(0))   // padding to the full four inline bytes
	}

	// TIFF header: big endian, first directory immediately after it.
	exif.Write([]byte{'M', 'M', 0x00, 0x2a})
	write(uint32(headerLen))

	write(uint16(mainDirTags))
	for _, id := range pointerTags {
		write(id)
		write(typeLong)
		write(uint32(offsetsPerPointer)) // value count
		write(offsetsOff)                // values are stored out of line
	}
	if thumbnailDir {
		write(thumbnailDirOff) // the thumbnail directory follows
	} else {
		writeOrientation()
		write(uint32(0)) // no directory follows
	}

	// The offset array shared by every pointer tag above.
	for range offsetsPerPointer {
		write(subDirOff)
	}

	// The sub-directory the offsets resolve to.
	write(uint16(subDirTags))
	for range subDirTags {
		write(uint16(0x9999))
		write(typeLong)
		write(uint32(15000)) // value count
		write(uint32(0))     // values are stored out of line
	}
	write(uint32(0)) // no directory follows

	if thumbnailDir {
		write(uint16(1))
		writeOrientation()
		write(uint32(0)) // no directory follows
	}

	return exif.Bytes()
}

// jpegWithEXIF, pngWithEXIF and webpWithEXIF wrap an EXIF payload in the
// smallest container each format accepts. A TIFF needs no wrapper: its own
// header is the start of the EXIF payload.
func jpegWithEXIF(tb testing.TB, exif []byte) []byte {
	tb.Helper()

	const header = "Exif\x00\x00"
	var buf bytes.Buffer
	buf.Write([]byte{0xff, 0xd8, 0xff, 0xe1}) // start of image, APP1 marker
	require.NoError(tb, binary.Write(&buf, binary.BigEndian, uint16(2+len(header)+len(exif))))
	buf.WriteString(header)
	buf.Write(exif)
	buf.Write([]byte{0xff, 0xd9}) // end of image

	return buf.Bytes()
}

func pngWithEXIF(tb testing.TB, exif []byte) []byte {
	tb.Helper()

	var buf bytes.Buffer
	buf.Write([]byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}) // signature
	require.NoError(tb, binary.Write(&buf, binary.BigEndian, uint32(len(exif))))
	buf.WriteString("eXIf")
	buf.Write(exif)
	buf.Write(make([]byte, 4)) // chunk checksum

	return buf.Bytes()
}

func webpWithEXIF(tb testing.TB, exif []byte) []byte {
	tb.Helper()

	var buf bytes.Buffer
	buf.WriteString("RIFF")
	require.NoError(tb, binary.Write(&buf, binary.LittleEndian, uint32(4+8+len(exif))))
	buf.WriteString("WEBP")
	buf.WriteString("EXIF")
	require.NoError(tb, binary.Write(&buf, binary.LittleEndian, uint32(len(exif))))
	buf.Write(exif)

	return buf.Bytes()
}

func TestGetImageOrientationLargeMetadata(t *testing.T) {
	// Reading the orientation of a small image stays within a bounded amount
	// of work no matter how large a nested tag structure its EXIF metadata
	// declares, and still reports the orientation that structure carries.
	const bound = time.Second

	exif := nestedEXIF(t, 2500, 4600, uint16(UpsideDown), false)
	thumbnailDirEXIF := nestedEXIF(t, 2500, 4600, uint16(UpsideDown), true)

	payloads := []struct {
		name    string
		format  string
		payload []byte
	}{
		{"jpeg", "jpeg", jpegWithEXIF(t, exif)},
		{"png", "png", pngWithEXIF(t, exif)},
		{"tiff", "tiff", exif},
		{"webp", "webp", webpWithEXIF(t, exif)},
		{"jpeg, orientation in thumbnail directory", "jpeg", jpegWithEXIF(t, thumbnailDirEXIF)},
	}

	inputs := []struct {
		name string
		make func([]byte) io.Reader
	}{
		{"seekable input", func(b []byte) io.Reader { return bytes.NewReader(b) }},
		{"reader input", func(b []byte) io.Reader {
			return &io.LimitedReader{R: bytes.NewReader(b), N: 1024 * 1024}
		}},
	}

	for _, p := range payloads {
		require.Less(t, len(p.payload), 128*1024, "payload should stay a small image")

		for _, in := range inputs {
			t.Run(p.name+", "+in.name, func(t *testing.T) {
				type result struct {
					orientation int
					err         error
				}
				done := make(chan result, 1)
				go func() {
					orientation, err := GetImageOrientation(in.make(p.payload), p.format)
					done <- result{orientation: orientation, err: err}
				}()

				select {
				case res := <-done:
					require.NoError(t, res.err)
					require.Equal(t, UpsideDown, res.orientation)
				case <-time.After(bound):
					t.Fatalf("GetImageOrientation did not return within %s for a %d byte image", bound, len(p.payload))
				}
			})
		}
	}
}

func TestMakeImageUpright(t *testing.T) {
	// Each case loads the canonical EXIF fixture for orientation N (the
	// 128x128 quadrants pattern in its stored, uncorrected form), applies
	// MakeImageUpright(., N), and asserts that the result has the same
	// pixels as the upright reference.
	tcs := []struct {
		name        string
		orientation int
		inputName   string
	}{
		{"Upright (no-op)", Upright, "quadrants-orientation-1.png"},
		{"UprightMirrored (FlipH)", UprightMirrored, "quadrants-orientation-2.png"},
		{"UpsideDown (Rotate180)", UpsideDown, "quadrants-orientation-3.png"},
		{"UpsideDownMirrored (FlipV)", UpsideDownMirrored, "quadrants-orientation-4.png"},
		{"RotatedCWMirrored (Transpose)", RotatedCWMirrored, "quadrants-orientation-5.png"},
		{"RotatedCCW (Rotate270)", RotatedCCW, "quadrants-orientation-6.png"},
		{"RotatedCCWMirrored (Transverse)", RotatedCCWMirrored, "quadrants-orientation-7.png"},
		{"RotatedCW (Rotate90)", RotatedCW, "quadrants-orientation-8.png"},
		// Unsupported orientations fall through to the default branch and
		// return the input unchanged. Pass the upright fixture so the
		// no-op result still equals the upright reference.
		{"unsupported orientation", 99, "quadrants-orientation-1.png"},
	}

	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)
	require.NotNil(t, d)

	uprightFile, err := os.Open(filepath.Join(imgDir, "quadrants-orientation-1.png"))
	require.NoError(t, err)
	defer uprightFile.Close()

	uprightImg, format, err := d.Decode(uprightFile)
	require.NoError(t, err)
	require.Equal(t, "png", format)

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			inputFile, err := os.Open(filepath.Join(imgDir, tc.inputName))
			require.NoError(t, err)
			defer inputFile.Close()

			inputImg, format, err := d.Decode(inputFile)
			require.NoError(t, err)
			require.Equal(t, "png", format)

			requireSameImage(t, uprightImg, MakeImageUpright(inputImg, tc.orientation))
		})
	}
}
