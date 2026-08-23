// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"sync"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const (
	riffChunkHeaderSize = 8  // FourCC (4 bytes) + uint32 data size (4 bytes)
	riffContainerSize   = 12 // "RIFF" + uint32 total size + "WEBP" FourCC
	anmfFrameHeaderSize = 16 // Frame X, Y, Width, Height, Duration, Flags
	vp8xPayloadSize     = 10 // Flags (4 bytes) + Canvas W-1 (3 bytes) + Canvas H-1 (3 bytes)
)

// DecoderOptions holds configuration options for an image decoder.
type DecoderOptions struct {
	// The level of concurrency for the decoder. This defines a limit on the
	// number of concurrently running encoding goroutines.
	ConcurrencyLevel int

	// MaxDecodedResolution, when greater than zero, is the maximum number of
	// pixels (width*height) an image may declare before it is decoded. Images
	// exceeding this limit are rejected up front. This is a defense-in-depth
	// guard against decompression bombs that bounds server-side memory
	// allocation regardless of the underlying codec's behavior.
	MaxDecodedResolution int64
}

func (o *DecoderOptions) validate() error {
	if o.ConcurrencyLevel < 0 {
		return errors.New("ConcurrencyLevel must be non-negative")
	}
	return nil
}

// Decoder holds the necessary state to decode images.
// This is safe to be used from multiple goroutines.
type Decoder struct {
	sem  chan struct{}
	opts DecoderOptions
}

// NewDecoder creates and returns a new image decoder with the given options.
func NewDecoder(opts DecoderOptions) (*Decoder, error) {
	var d Decoder
	if err := opts.validate(); err != nil {
		return nil, fmt.Errorf("imaging: error validating decoder options: %w", err)
	}
	if opts.ConcurrencyLevel > 0 {
		d.sem = make(chan struct{}, opts.ConcurrencyLevel)
	}
	d.opts = opts
	return &d, nil
}

// enforceResolutionLimit inspects the image header and rejects images whose
// declared resolution exceeds the configured MaxDecodedResolution before any
// pixel data is decoded. It returns the reader to use for the subsequent full
// decode: seekable readers are rewound to their original position, while
// non-seekable readers are buffered so the cap is enforced for every input.
func (d *Decoder) enforceResolutionLimit(rd io.Reader) (io.Reader, error) {
	if d.opts.MaxDecodedResolution <= 0 {
		return rd, nil
	}

	if seeker, ok := rd.(io.ReadSeeker); ok {
		// Preserve the caller's position so an image decoded from a non-zero
		// offset still lines up for the full decode.
		start, err := seeker.Seek(0, io.SeekCurrent)
		if err != nil {
			return nil, fmt.Errorf("imaging: failed to read image position: %w", err)
		}
		cfg, _, cfgErr := image.DecodeConfig(seeker)
		if _, err := seeker.Seek(start, io.SeekStart); err != nil {
			return nil, fmt.Errorf("imaging: failed to seek after reading image config: %w", err)
		}
		if err := d.checkConfigResolution(cfg, cfgErr); err != nil {
			return nil, err
		}
		return rd, nil
	}

	// Non-seekable reader: buffer the input so the resolution cap can still be
	// enforced and the data can be decoded afterwards.
	data, err := io.ReadAll(rd)
	if err != nil {
		return nil, fmt.Errorf("imaging: failed to read image data: %w", err)
	}
	cfg, _, cfgErr := image.DecodeConfig(bytes.NewReader(data))
	if err := d.checkConfigResolution(cfg, cfgErr); err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// checkConfigResolution rejects a decoded image config whose resolution exceeds
// the configured cap. A config-decode error is ignored so the subsequent full
// decode can surface a meaningful error for malformed input.
func (d *Decoder) checkConfigResolution(cfg image.Config, cfgErr error) error {
	if cfgErr != nil {
		return nil
	}
	if exceedsResolution(int64(cfg.Width), int64(cfg.Height), d.opts.MaxDecodedResolution) {
		return fmt.Errorf("imaging: image resolution %dx%d exceeds the maximum allowed %d pixels", cfg.Width, cfg.Height, d.opts.MaxDecodedResolution)
	}
	return nil
}

// exceedsResolution reports whether width*height exceeds maxRes. It divides
// instead of multiplying so it can't overflow int64 for very large declared
// dimensions.
func exceedsResolution(width, height, maxRes int64) bool {
	if width <= 0 || height <= 0 {
		return false
	}
	return width > maxRes/height
}

// Decode decodes the given encoded data and returns the decoded image.
func (d *Decoder) Decode(rd io.Reader) (img image.Image, format string, err error) {
	rd, err = d.enforceResolutionLimit(rd)
	if err != nil {
		return nil, "", err
	}

	if d.opts.ConcurrencyLevel != 0 {
		d.sem <- struct{}{}
		defer func() { <-d.sem }()
	}

	img, format, err = image.Decode(rd)
	if err != nil {
		return nil, "", fmt.Errorf("imaging: failed to decode image: %w", err)
	}

	return img, format, nil
}

// DecodeMemBounded works similarly to Decode but also returns a release function that
// must be called when access to the raw image is not needed anymore.
// This sets the raw image data pointer to nil in an attempt to help the GC to re-use the underlying data as soon as possible.
func (d *Decoder) DecodeMemBounded(rd io.Reader) (img image.Image, format string, releaseFunc func(), err error) {
	rd, err = d.enforceResolutionLimit(rd)
	if err != nil {
		return nil, "", nil, err
	}

	if d.opts.ConcurrencyLevel != 0 {
		d.sem <- struct{}{}
		defer func() {
			if err != nil {
				<-d.sem
			}
		}()
	}

	img, format, err = image.Decode(rd)
	if err != nil {
		return nil, "", nil, fmt.Errorf("imaging: failed to decode image: %w", err)
	}

	var once sync.Once
	releaseFunc = func() {
		if d.opts.ConcurrencyLevel == 0 {
			return
		}
		once.Do(func() {
			if img != nil {
				releaseImageData(img)
			}
			<-d.sem
		})
	}

	return img, format, releaseFunc, nil
}

// DecodeConfig returns the image config for the given data.
func (d *Decoder) DecodeConfig(rd io.Reader) (image.Config, string, error) {
	img, format, err := image.DecodeConfig(rd)
	if err != nil {
		return image.Config{}, "", fmt.Errorf("imaging: failed to decode image config: %w", err)
	}
	return img, format, nil
}

// GetDimensions returns the dimensions for the given encoded image data.
func GetDimensions(imageData io.Reader) (width int, height int, err error) {
	cfg, _, err := image.DecodeConfig(imageData)
	width, height = cfg.Width, cfg.Height
	if seeker, ok := imageData.(io.Seeker); ok {
		_, err2 := seeker.Seek(0, 0)
		if err == nil && err2 != nil {
			err = fmt.Errorf("failed to seek back to the beginning of the image data: %w", err2)
		}
	}
	return
}

// DecodeWebPFirstFrame decodes the first frame of an animated WebP.
// It streams the RIFF chunk list so only the first ANMF frame payload is read
// into memory — the rest of the file is discarded without buffering.
func (d *Decoder) DecodeWebPFirstFrame(r io.Reader) (image.Image, error) {
	var header [riffContainerSize]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return nil, fmt.Errorf("webp: read failed: %w", err)
	}
	if string(header[:4]) != "RIFF" || string(header[riffChunkHeaderSize:]) != "WEBP" {
		return nil, errors.New("webp: not a WebP file")
	}

	// Animated WebP must start with VP8X and have the animation bit (bit 1) set.
	// Still images start with VP8/VP8L at the top level and are rejected fast.
	var chunkHdr [riffChunkHeaderSize]byte
	if _, err := io.ReadFull(r, chunkHdr[:]); err != nil {
		return nil, errors.New("webp: not animated")
	}
	firstSize := int64(binary.LittleEndian.Uint32(chunkHdr[4:]))
	if string(chunkHdr[:4]) != "VP8X" || firstSize < vp8xPayloadSize {
		return nil, errors.New("webp: not animated")
	}
	var vp8xFlags [vp8xPayloadSize]byte
	if _, err := io.ReadFull(r, vp8xFlags[:]); err != nil {
		return nil, errors.New("webp: not animated")
	}
	if vp8xFlags[0]&0x02 == 0 {
		return nil, errors.New("webp: not animated")
	}
	if remaining := firstSize - vp8xPayloadSize; remaining > 0 {
		if _, err := io.CopyN(io.Discard, r, remaining); err != nil {
			return nil, errors.New("webp: not animated")
		}
	}

	for {
		if _, err := io.ReadFull(r, chunkHdr[:]); err != nil {
			break
		}
		size := int64(binary.LittleEndian.Uint32(chunkHdr[4:]))

		if string(chunkHdr[:4]) == "ANMF" && size >= anmfFrameHeaderSize+riffChunkHeaderSize {
			payload, err := io.ReadAll(io.LimitReader(r, size))
			if err != nil || int64(len(payload)) != size {
				break
			}
			container, err := anmfContainer(payload)
			if err != nil {
				return nil, err
			}
			rd, err := d.enforceResolutionLimit(bytes.NewReader(container))
			if err != nil {
				return nil, err
			}
			if d.opts.ConcurrencyLevel != 0 {
				d.sem <- struct{}{}
				defer func() { <-d.sem }()
			}
			img, _, err := image.Decode(rd)
			if err != nil {
				return nil, fmt.Errorf("webp: first frame decode failed: %w", err)
			}
			return img, nil
		}

		if _, err := io.CopyN(io.Discard, r, size+size%2); err != nil {
			break
		}
	}
	return nil, errors.New("webp: no decodable animation frame found")
}

// anmfContainer builds a standalone RIFF/WEBP container from an ANMF chunk payload.
// The payload begins with the 16-byte ANMF frame header followed by subchunks.
// For lossy VP8 frames that carry an ALPH subchunk, it builds the extended format
// (VP8X + ALPH + VP8) so the golang webp decoder preserves transparency.
func anmfContainer(anmf []byte) ([]byte, error) {
	if len(anmf) < anmfFrameHeaderSize+riffChunkHeaderSize {
		return nil, errors.New("webp: ANMF payload too short")
	}
	// ANMF header bytes 6-8: frame width minus one; bytes 9-11: frame height minus one.
	wMinus1 := binary.LittleEndian.Uint32(anmf[6:]) & 0xFFFFFF
	hMinus1 := binary.LittleEndian.Uint32(anmf[9:]) & 0xFFFFFF

	sub := anmf[anmfFrameHeaderSize:]
	var alph []byte
	for pos := 0; pos+riffChunkHeaderSize <= len(sub); {
		size := int(binary.LittleEndian.Uint32(sub[pos+4 : pos+riffChunkHeaderSize]))
		end := pos + riffChunkHeaderSize + size
		if end > len(sub) {
			break
		}
		switch string(sub[pos : pos+4]) {
		case "ALPH":
			alph = sub[pos:min(end+size%2, len(sub))] // include RIFF pad byte so the next chunk isn't misread
		case "VP8L":
			return webpContainer(sub[pos:end]), nil
		case "VP8 ":
			if alph != nil {
				return webpContainer(vp8xChunk(wMinus1, hMinus1), alph, sub[pos:end]), nil
			}
			return webpContainer(sub[pos:end]), nil
		}
		pos = end + size%2
	}
	return nil, errors.New("webp: no VP8/VP8L subchunk in ANMF frame")
}

// webpContainer wraps one or more chunks in a minimal RIFF/WEBP container.
func webpContainer(chunks ...[]byte) []byte {
	total := 4 // "WEBP"
	for _, c := range chunks {
		total += len(c)
	}
	buf := make([]byte, riffChunkHeaderSize+total)
	copy(buf, "RIFF")
	binary.LittleEndian.PutUint32(buf[4:], uint32(total))
	pos := riffChunkHeaderSize + copy(buf[riffChunkHeaderSize:], "WEBP")
	for _, c := range chunks {
		pos += copy(buf[pos:], c)
	}
	return buf
}

// vp8xChunk builds an 18-byte VP8X chunk for the extended WebP format.
// It sets only the alpha flag; all other feature bits are left zero.
func vp8xChunk(wMinus1, hMinus1 uint32) []byte {
	c := make([]byte, riffChunkHeaderSize+vp8xPayloadSize)
	copy(c, "VP8X")
	binary.LittleEndian.PutUint32(c[4:], vp8xPayloadSize)
	c[8] = 0x10 // alpha flag (bit 4 per the WebP spec)
	c[12] = byte(wMinus1)
	c[13] = byte(wMinus1 >> 8)
	c[14] = byte(wMinus1 >> 16)
	c[15] = byte(hMinus1)
	c[16] = byte(hMinus1 >> 8)
	c[17] = byte(hMinus1 >> 16)
	return c
}

// This is only needed to try and simplify GC work.
func releaseImageData(img image.Image) {
	switch raw := img.(type) {
	case *image.Alpha:
		raw.Pix = nil
	case *image.Alpha16:
		raw.Pix = nil
	case *image.Gray:
		raw.Pix = nil
	case *image.Gray16:
		raw.Pix = nil
	case *image.NRGBA:
		raw.Pix = nil
	case *image.NRGBA64:
		raw.Pix = nil
	case *image.Paletted:
		raw.Pix = nil
	case *image.RGBA:
		raw.Pix = nil
	case *image.RGBA64:
		raw.Pix = nil
	default:
		return
	}
}
