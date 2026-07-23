// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
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

// exceedsResolution reports whether width*height exceeds max. It divides instead
// of multiplying so it can't overflow int64 for very large declared dimensions.
func exceedsResolution(width, height, max int64) bool {
	if width <= 0 || height <= 0 {
		return false
	}
	return width > max/height
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
