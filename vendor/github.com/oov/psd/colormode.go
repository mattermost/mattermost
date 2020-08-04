package psd

// ColorMode represents color mode that is used in psd file.
type ColorMode int16

// These color modes are defined in this document.
//
// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_19840
const (
	ColorModeBitmap       = ColorMode(0)
	ColorModeGrayscale    = ColorMode(1)
	ColorModeIndexed      = ColorMode(2)
	ColorModeRGB          = ColorMode(3)
	ColorModeCMYK         = ColorMode(4)
	ColorModeMultichannel = ColorMode(7)
	ColorModeDuotone      = ColorMode(8)
	ColorModeLab          = ColorMode(9)
)

// Channels returns the number of channels for the color mode.
// The return value is not including alpha channel.
func (c ColorMode) Channels() int {
	switch c {
	case ColorModeBitmap,
		ColorModeGrayscale,
		ColorModeIndexed:
		return 1
	case ColorModeRGB:
		return 3
	case ColorModeCMYK:
		return 4
	}
	return -1
}
