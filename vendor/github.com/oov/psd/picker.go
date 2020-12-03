package psd

import (
	"image"
	"image/color"

	psdColor "github.com/oov/psd/color"
)

type picker interface {
	image.Image
	setSource(rect image.Rectangle, src ...[]byte)
}

func findPicker(depth int, colorMode ColorMode, hasAlpha bool) picker {
	switch colorMode {
	case ColorModeBitmap, ColorModeGrayscale:
		return findNGrayPicker(depth, hasAlpha)
	case ColorModeRGB:
		return findNRGBAPicker(depth, hasAlpha)
	case ColorModeCMYK:
		return findNCMYKAPicker(depth, hasAlpha)
	}
	return nil
}

func findGrayPicker(depth int) picker {
	switch depth {
	case 1:
		return &pickerGray1{}
	case 8:
		return &pickerGray8{}
	case 16:
		return &pickerGray16{}
	case 32:
		return &pickerGray32{}
	}
	return nil
}

func findNGrayPicker(depth int, hasAlpha bool) picker {
	switch depth {
	case 8:
		if hasAlpha {
			return &pickerNGrayA8{}
		}
		return &pickerNGray8{}
	case 16:
		if hasAlpha {
			return &pickerNGrayA16{}
		}
		return &pickerNGray16{}
	case 32:
		if hasAlpha {
			return &pickerNGrayA32{}
		}
		return &pickerNGray32{}
	}
	return nil
}

func findNRGBAPicker(depth int, hasAlpha bool) picker {
	switch depth {
	case 8:
		if hasAlpha {
			return &pickerNRGBA8{}
		}
		return &pickerNRGB8{}
	case 16:
		if hasAlpha {
			return &pickerNRGBA16{}
		}
		return &pickerNRGB16{}
	case 32:
		if hasAlpha {
			return &pickerNRGBA32{}
		}
		return &pickerNRGB32{}
	}
	return nil
}

func findNCMYKAPicker(depth int, hasAlpha bool) picker {
	switch depth {
	case 8:
		if hasAlpha {
			return &pickerNCMYKA8{}
		}
		return &pickerNCMYK8{}
	case 16:
		if hasAlpha {
			return &pickerNCMYKA16{}
		}
		return &pickerNCMYK16{}
	}
	return nil
}

type pickerPalette struct {
	Rect    image.Rectangle
	Src     []byte
	Palette color.Palette
}

func (p *pickerPalette) setSource(rect image.Rectangle, src ...[]byte) { p.Rect, p.Src = rect, src[0] }
func (p *pickerPalette) ColorModel() color.Model                       { return p.Palette }
func (p *pickerPalette) Bounds() image.Rectangle                       { return p.Rect }
func (p *pickerPalette) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return p.Palette[p.Src[pos]]
}

type pickerGray1 struct {
	Rect image.Rectangle
	Y    []byte
}

func (p *pickerGray1) setSource(rect image.Rectangle, src ...[]byte) { p.Rect, p.Y = rect, src[0] }
func (p *pickerGray1) ColorModel() color.Model                       { return psdColor.Gray1Model }
func (p *pickerGray1) Bounds() image.Rectangle                       { return p.Rect }
func (p *pickerGray1) At(x, y int) color.Color {
	xx := x - p.Rect.Min.X
	pos := (p.Rect.Dx()+7)>>3*(y-p.Rect.Min.Y) + xx>>3
	return psdColor.Gray1{Y: p.Y[pos]&(1<<uint(^xx&7)) == 0}
}

type pickerGray8 struct {
	Rect image.Rectangle
	Y    []byte
}

func (p *pickerGray8) setSource(rect image.Rectangle, src ...[]byte) { p.Rect, p.Y = rect, src[0] }
func (p *pickerGray8) ColorModel() color.Model                       { return color.GrayModel }
func (p *pickerGray8) Bounds() image.Rectangle                       { return p.Rect }
func (p *pickerGray8) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return color.Gray{Y: p.Y[pos]}
}

type pickerNGray8 struct {
	Rect image.Rectangle
	Y    []byte
}

func (p *pickerNGray8) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.Y = rect, src[0]
}
func (p *pickerNGray8) ColorModel() color.Model { return psdColor.NGrayAModel }
func (p *pickerNGray8) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNGray8) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return psdColor.NGrayA{Y: p.Y[pos], A: 0xff}
}

type pickerNGrayA8 struct {
	Rect image.Rectangle
	Y, A []byte
}

func (p *pickerNGrayA8) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.Y, p.A = rect, src[0], src[1]
}
func (p *pickerNGrayA8) ColorModel() color.Model { return psdColor.NGrayAModel }
func (p *pickerNGrayA8) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNGrayA8) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return psdColor.NGrayA{Y: p.Y[pos], A: p.A[pos]}
}

type pickerGray16 struct {
	Rect image.Rectangle
	Y    []byte
}

func (p *pickerGray16) setSource(rect image.Rectangle, src ...[]byte) { p.Rect, p.Y = rect, src[0] }
func (p *pickerGray16) ColorModel() color.Model                       { return color.Gray16Model }
func (p *pickerGray16) Bounds() image.Rectangle                       { return p.Rect }
func (p *pickerGray16) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 1
	return color.Gray16{Y: readUint16(p.Y, pos)}
}

type pickerNGray16 struct {
	Rect image.Rectangle
	Y    []byte
}

func (p *pickerNGray16) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.Y = rect, src[0]
}
func (p *pickerNGray16) ColorModel() color.Model { return psdColor.NGrayA32Model }
func (p *pickerNGray16) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNGray16) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 1
	return psdColor.NGrayA32{Y: readUint16(p.Y, pos), A: 0xffff}
}

type pickerNGrayA16 struct {
	Rect image.Rectangle
	Y, A []byte
}

func (p *pickerNGrayA16) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.Y, p.A = rect, src[0], src[1]
}
func (p *pickerNGrayA16) ColorModel() color.Model { return psdColor.NGrayA32Model }
func (p *pickerNGrayA16) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNGrayA16) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 1
	return psdColor.NGrayA32{Y: readUint16(p.Y, pos), A: readUint16(p.A, pos)}
}

type pickerGray32 struct {
	Rect image.Rectangle
	Y    []byte
}

func (p *pickerGray32) setSource(rect image.Rectangle, src ...[]byte) { p.Rect, p.Y = rect, src[0] }
func (p *pickerGray32) ColorModel() color.Model                       { return psdColor.Gray32Model }
func (p *pickerGray32) Bounds() image.Rectangle                       { return p.Rect }
func (p *pickerGray32) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 2
	return psdColor.Gray32{Y: readFloat32(p.Y, pos)}
}

type pickerNGray32 struct {
	Rect image.Rectangle
	Y    []byte
}

func (p *pickerNGray32) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.Y = rect, src[0]
}
func (p *pickerNGray32) ColorModel() color.Model { return psdColor.NGrayA64Model }
func (p *pickerNGray32) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNGray32) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 2
	return psdColor.NGrayA64{Y: readFloat32(p.Y, pos), A: 1}
}

type pickerNGrayA32 struct {
	Rect image.Rectangle
	Y, A []byte
}

func (p *pickerNGrayA32) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.Y, p.A = rect, src[0], src[1]
}
func (p *pickerNGrayA32) ColorModel() color.Model { return psdColor.NGrayA64Model }
func (p *pickerNGrayA32) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNGrayA32) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 2
	return psdColor.NGrayA64{
		Y: readFloat32(p.Y, pos),
		A: readFloat32(p.A, pos),
	}
}

type pickerNRGB8 struct {
	Rect    image.Rectangle
	R, G, B []byte
}

func (p *pickerNRGB8) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.R, p.G, p.B = rect, src[0], src[1], src[2]
}
func (p *pickerNRGB8) ColorModel() color.Model { return color.NRGBAModel }
func (p *pickerNRGB8) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNRGB8) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return color.NRGBA{
		R: p.R[pos],
		G: p.G[pos],
		B: p.B[pos],
		A: 0xff,
	}
}

type pickerNRGBA8 struct {
	Rect       image.Rectangle
	R, G, B, A []byte
}

func (p *pickerNRGBA8) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.R, p.G, p.B, p.A = rect, src[0], src[1], src[2], src[3]
}
func (p *pickerNRGBA8) ColorModel() color.Model { return color.NRGBAModel }
func (p *pickerNRGBA8) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNRGBA8) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return color.NRGBA{p.R[pos], p.G[pos], p.B[pos], p.A[pos]}
}

type pickerNRGB16 struct {
	Rect    image.Rectangle
	R, G, B []byte
}

func (p *pickerNRGB16) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.R, p.G, p.B = rect, src[0], src[1], src[2]
}
func (p *pickerNRGB16) ColorModel() color.Model { return color.NRGBA64Model }
func (p *pickerNRGB16) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNRGB16) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 1
	return color.NRGBA64{
		R: readUint16(p.R, pos),
		G: readUint16(p.G, pos),
		B: readUint16(p.B, pos),
		A: 0xffff,
	}
}

type pickerNRGBA16 struct {
	Rect       image.Rectangle
	R, G, B, A []byte
}

func (p *pickerNRGBA16) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.R, p.G, p.B, p.A = rect, src[0], src[1], src[2], src[3]
}
func (p *pickerNRGBA16) ColorModel() color.Model { return color.NRGBA64Model }
func (p *pickerNRGBA16) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNRGBA16) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 1
	return color.NRGBA64{
		R: readUint16(p.R, pos),
		G: readUint16(p.G, pos),
		B: readUint16(p.B, pos),
		A: readUint16(p.A, pos),
	}
}

type pickerNRGB32 struct {
	Rect    image.Rectangle
	R, G, B []byte
}

func (p *pickerNRGB32) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.R, p.G, p.B = rect, src[0], src[1], src[2]
}
func (p *pickerNRGB32) ColorModel() color.Model { return psdColor.NRGBA128Model }
func (p *pickerNRGB32) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNRGB32) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 2
	return psdColor.NRGBA128{
		R: readFloat32(p.R, pos),
		G: readFloat32(p.G, pos),
		B: readFloat32(p.B, pos),
		A: 1.0,
	}
}

type pickerNRGBA32 struct {
	Rect       image.Rectangle
	R, G, B, A []byte
}

func (p *pickerNRGBA32) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.R, p.G, p.B, p.A = rect, src[0], src[1], src[2], src[3]
}
func (p *pickerNRGBA32) ColorModel() color.Model { return psdColor.NRGBA128Model }
func (p *pickerNRGBA32) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNRGBA32) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 2
	return psdColor.NRGBA128{
		R: readFloat32(p.R, pos),
		G: readFloat32(p.G, pos),
		B: readFloat32(p.B, pos),
		A: readFloat32(p.A, pos),
	}
}

type pickerNCMYK8 struct {
	Rect       image.Rectangle
	C, M, Y, K []byte
}

func (p *pickerNCMYK8) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.C, p.M, p.Y, p.K = rect, src[0], src[1], src[2], src[3]
}
func (p *pickerNCMYK8) ColorModel() color.Model { return psdColor.NCMYKAModel }
func (p *pickerNCMYK8) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNCMYK8) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return psdColor.NCMYKA{
		C: p.C[pos],
		M: p.M[pos],
		Y: p.Y[pos],
		K: p.K[pos],
		A: 0xff,
	}
}

type pickerNCMYKA8 struct {
	Rect          image.Rectangle
	C, M, Y, K, A []byte
}

func (p *pickerNCMYKA8) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.C, p.M, p.Y, p.K, p.A = rect, src[0], src[1], src[2], src[3], src[4]
}
func (p *pickerNCMYKA8) ColorModel() color.Model { return psdColor.NCMYKAModel }
func (p *pickerNCMYKA8) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNCMYKA8) At(x, y int) color.Color {
	pos := (y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X
	return psdColor.NCMYKA{
		C: p.C[pos],
		M: p.M[pos],
		Y: p.Y[pos],
		K: p.K[pos],
		A: p.A[pos],
	}
}

type pickerNCMYK16 struct {
	Rect       image.Rectangle
	C, M, Y, K []byte
}

func (p *pickerNCMYK16) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.C, p.M, p.Y, p.K = rect, src[0], src[1], src[2], src[3]
}
func (p *pickerNCMYK16) ColorModel() color.Model { return psdColor.NCMYKA80Model }
func (p *pickerNCMYK16) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNCMYK16) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 1
	return psdColor.NCMYKA80{
		C: readUint16(p.C, pos),
		M: readUint16(p.M, pos),
		Y: readUint16(p.Y, pos),
		K: readUint16(p.K, pos),
		A: 0xffff,
	}
}

type pickerNCMYKA16 struct {
	Rect          image.Rectangle
	C, M, Y, K, A []byte
}

func (p *pickerNCMYKA16) setSource(rect image.Rectangle, src ...[]byte) {
	p.Rect, p.C, p.M, p.Y, p.K, p.A = rect, src[0], src[1], src[2], src[3], src[4]
}
func (p *pickerNCMYKA16) ColorModel() color.Model { return psdColor.NCMYKA80Model }
func (p *pickerNCMYKA16) Bounds() image.Rectangle { return p.Rect }
func (p *pickerNCMYKA16) At(x, y int) color.Color {
	pos := ((y-p.Rect.Min.Y)*p.Rect.Dx() + x - p.Rect.Min.X) << 1
	return psdColor.NCMYKA80{
		C: readUint16(p.C, pos),
		M: readUint16(p.M, pos),
		Y: readUint16(p.Y, pos),
		K: readUint16(p.K, pos),
		A: readUint16(p.A, pos),
	}
}
