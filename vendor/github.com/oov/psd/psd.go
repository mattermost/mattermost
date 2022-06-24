package psd

import (
	"errors"
	"image"
	"image/color"
	"io"
)

// logger is subset of log.Logger.
type logger interface {
	Printf(format string, v ...interface{})
	Println(v ...interface{})
}

// Debug is useful for debugging.
//
// You can use by performing the following steps.
// 	psd.Debug = log.New(os.Stdout, "psd: ", log.Lshortfile)
var Debug logger

const (
	headerSignature  = "8BPS"
	sectionSignature = "8BIM"
)

// AdditionalInfoKey represents the key of the additional layer information.
type AdditionalInfoKey string

// LenSize returns bytes of the length for this key.
func (a AdditionalInfoKey) LenSize(largeDocument bool) int {
	if largeDocument {
		// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_71546
		// (**PSB**, the following keys have a length count of 8 bytes:
		// LMsk, Lr16, Lr32, Layr, Mt16, Mt32, Mtrn, Alph, FMsk, lnk2, FEid, FXid, PxSD.
		switch a {
		case "LMsk",
			"Lr16",
			"Lr32",
			"Layr",
			"Mt16",
			"Mt32",
			"Mtrn",
			"Alph",
			"FMsk",
			"lnk2",
			"FEid",
			"FXid",
			"PxSD":
			return 8
		}
	}
	return 4
}

// These keys are defined in this document.
//
// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_71546
const (
	AdditionalInfoKeyLayerInfo              = AdditionalInfoKey("Layr")
	AdditionalInfoKeyLayerInfo16            = AdditionalInfoKey("Lr16")
	AdditionalInfoKeyLayerInfo32            = AdditionalInfoKey("Lr32")
	AdditionalInfoKeyUnicodeLayerName       = AdditionalInfoKey("luni")
	AdditionalInfoKeyBlendClippingElements  = AdditionalInfoKey("clbl")
	AdditionalInfoKeySectionDividerSetting  = AdditionalInfoKey("lsct")
	AdditionalInfoKeySectionDividerSetting2 = AdditionalInfoKey("lsdk")
)

// Config represents Photoshop image file configuration.
type Config struct {
	Version       int
	Rect          image.Rectangle
	Channels      int
	Depth         int // 1 or 8 or 16 or 32
	ColorMode     ColorMode
	ColorModeData []byte
	Res           map[int]ImageResource
}

// PSB returns whether image is large document format.
func (cfg *Config) PSB() bool {
	return cfg.Version == 2
}

// Palette returns Palette if any.
func (cfg *Config) Palette() color.Palette {
	if cfg.ColorMode != ColorModeIndexed {
		return nil
	}

	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_38034
	// 0x0417(1046) | (Photoshop 6.0) Transparency Index.
	//                2 bytes for the index of transparent color, if any.
	transparentColorIndex := -1
	if r, ok := cfg.Res[0x0417]; ok {
		transparentColorIndex = int(readUint16(r.Data, 0))
	}
	pal := make(color.Palette, len(cfg.ColorModeData)/3)
	for i := range pal {
		c := color.NRGBA{
			cfg.ColorModeData[i],
			cfg.ColorModeData[i+256],
			cfg.ColorModeData[i+512],
			0xFF,
		}
		if i == transparentColorIndex {
			c.A = 0
		}
		pal[i] = c
	}
	return pal
}

func (cfg *Config) makePicker() (picker, error) {
	var pk picker
	switch cfg.ColorMode {
	case ColorModeIndexed:
		pk = &pickerPalette{Palette: cfg.Palette()}
	case ColorModeBitmap:
		pk = &pickerGray1{}
	default:
		pk = findPicker(cfg.Depth, cfg.ColorMode, cfg.Channels > cfg.ColorMode.Channels() && hasAlphaID0(cfg.Res))
	}
	if pk == nil {
		return nil, errors.New("psd: color mode " + itoa(int(cfg.ColorMode)) + " depth " + itoa(cfg.Depth) + " is not implemeted")
	}
	return pk, nil
}

// PSD represents Photoshop image file.
type PSD struct {
	Config             Config
	Channel            map[int]Channel
	Layer              []Layer
	AdditinalLayerInfo map[AdditionalInfoKey][]byte
	// Data is uncompressed merged image data.
	Data   []byte
	Picker image.Image
}

// DecodeConfig returns the color model and dimensions of a image without decoding the entire image.
func DecodeConfig(r io.Reader) (cfg Config, read int, err error) {
	const (
		fileHeaderLen    = 4 + 2 + 6 + 2 + 4 + 4 + 2 + 2
		colorModeDataLen = 4
	)
	b := make([]byte, fileHeaderLen+colorModeDataLen)
	var l int
	if l, err = io.ReadFull(r, b); err != nil {
		return Config{}, 0, err
	}
	read += l

	if string(b[:4]) != headerSignature { // Signature
		return Config{}, read, errors.New("psd: invalid format")
	}
	cfg.Version = int(readUint16(b, 4))
	if cfg.Version != 1 && cfg.Version != 2 { // Version
		return Config{}, read, errors.New("psd: unexpected file version: " + itoa(cfg.Version))
	}

	// b[6:12] Reserved

	cfg.Channels = int(readUint16(b, 12))
	if cfg.Channels < 1 || cfg.Channels > 56 {
		return Config{}, read, errors.New("psd: unexpected the number of channels")
	}

	width, height := int(readUint32(b, 18)), int(readUint32(b, 14))
	if height < 1 || (cfg.Version == 1 && height > 30000) || (cfg.Version == 2 && height > 300000) {
		return Config{}, read, errors.New("psd: unexpected the height of the image")
	}
	if width < 1 || (cfg.Version == 1 && width > 30000) || (cfg.Version == 2 && width > 300000) {
		return Config{}, read, errors.New("psd: unexpected the width of the image")
	}
	cfg.Rect = image.Rect(0, 0, width, height)

	cfg.Depth = int(readUint16(b, 22))
	if cfg.Depth != 1 && cfg.Depth != 8 && cfg.Depth != 16 && cfg.Depth != 32 {
		return Config{}, read, errors.New("psd: unexpected color depth")
	}

	cfg.ColorMode = ColorMode(readUint16(b, 24))

	if ln := readUint32(b, 26); ln > 0 {
		cfg.ColorModeData = make([]byte, ln)
		if l, err = io.ReadFull(r, cfg.ColorModeData); err != nil {
			return Config{}, read, err
		}
		read += l
	}
	if Debug != nil {
		Debug.Println("start - header")
		Debug.Printf("  width: %d height: %d", width, height)
		Debug.Printf("  channels: %d depth: %d colorMode %d", cfg.Channels, cfg.Depth, cfg.ColorMode)
		Debug.Printf("  colorModeDataLen: %d", len(cfg.ColorModeData))
		Debug.Println("end - header")
	}

	if cfg.Res, l, err = readImageResource(r); err != nil {
		return Config{}, read, err
	}
	read += l
	return cfg, read, nil
}

// DecodeOptions are the decoding options.
type DecodeOptions struct {
	SkipLayerImage   bool
	SkipMergedImage  bool
	ConfigLoaded     func(cfg Config) error
	LayerImageLoaded func(layer *Layer, index int, total int)
}

// Decode reads a image from r and returns it.
// Default parameters are used if a nil *DecodeOptions is passed.
func Decode(r io.Reader, o *DecodeOptions) (psd *PSD, read int, err error) {
	if o == nil {
		o = &DecodeOptions{}
	}
	cfg, l, err := DecodeConfig(r)
	if err != nil {
		return nil, 0, err
	}
	read += l
	if o.ConfigLoaded != nil {
		err = o.ConfigLoaded(cfg)
		if err != nil {
			return nil, 0, err
		}
	}

	psd, l, err = readLayerAndMaskInfo(r, &cfg, o)
	if err != nil {
		return nil, read, err
	}
	read += l

	if !o.SkipMergedImage {
		// allocate image buffer.
		// `+7` and `>>3` is the padding for the 1bit depth color mode.
		plane := (psd.Config.Rect.Dx()*psd.Config.Depth + 7) >> 3 * psd.Config.Rect.Dy()
		psd.Data = make([]byte, plane*psd.Config.Channels)
		chs := make([][]byte, psd.Config.Channels)
		psd.Channel = make(map[int]Channel)
		for i := 0; i < psd.Config.Channels; i++ {
			data := psd.Data[plane*i : plane*(i+1) : plane*(i+1)]
			chs[i] = data
			pk := findGrayPicker(psd.Config.Depth)
			pk.setSource(psd.Config.Rect, data)
			psd.Channel[i] = Channel{
				Data:   data,
				Picker: pk,
			}
		}
		var pk picker
		if pk, err = cfg.makePicker(); err != nil {
			return nil, read, err
		}
		pk.setSource(psd.Config.Rect, chs...)
		psd.Picker = pk

		b := make([]byte, 2)
		if l, err = io.ReadFull(r, b[:2]); err != nil {
			return nil, read, err
		}
		read += l
		cmpMethod := CompressionMethod(readUint16(b, 0))
		l, err = cmpMethod.Decode(
			psd.Data,
			r,
			0,
			psd.Config.Rect,
			psd.Config.Depth,
			psd.Config.Channels,
			psd.Config.PSB(),
		)
		if err != nil {
			return nil, read, err
		}
		read += l
	}
	return psd, read, nil
}

func decode(r io.Reader) (image.Image, error) {
	psd, _, err := Decode(r, &DecodeOptions{SkipLayerImage: true})
	if err != nil {
		return nil, err
	}
	return psd.Picker, nil
}

func decodeConfig(r io.Reader) (image.Config, error) {
	cfg, _, err := DecodeConfig(r)
	if err != nil {
		return image.Config{}, err
	}
	var pk picker
	if pk, err = cfg.makePicker(); err != nil {
		return image.Config{}, err
	}
	return image.Config{
		Width:      cfg.Rect.Dx(),
		Height:     cfg.Rect.Dy(),
		ColorModel: pk.ColorModel(),
	}, nil
}

func init() {
	image.RegisterFormat("psd", headerSignature+"\x00\x01", decode, decodeConfig)
	image.RegisterFormat("psb", headerSignature+"\x00\x02", decode, decodeConfig)
}
