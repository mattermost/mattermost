package matchers

import "github.com/h2non/filetype/matchers/isobmff"

var (
	TypeJpeg     = newType("jpg", "image/jpeg")
	TypeJpeg2000 = newType("jp2", "image/jp2")
	TypePng      = newType("png", "image/png")
	TypeGif      = newType("gif", "image/gif")
	TypeWebp     = newType("webp", "image/webp")
	TypeCR2      = newType("cr2", "image/x-canon-cr2")
	TypeTiff     = newType("tif", "image/tiff")
	TypeBmp      = newType("bmp", "image/bmp")
	TypeJxr      = newType("jxr", "image/vnd.ms-photo")
	TypePsd      = newType("psd", "image/vnd.adobe.photoshop")
	TypeIco      = newType("ico", "image/x-icon")
	TypeHeif     = newType("heif", "image/heif")
	TypeDwg      = newType("dwg", "image/vnd.dwg")
)

var Image = Map{
	TypeJpeg:     Jpeg,
	TypeJpeg2000: Jpeg2000,
	TypePng:      Png,
	TypeGif:      Gif,
	TypeWebp:     Webp,
	TypeCR2:      CR2,
	TypeTiff:     Tiff,
	TypeBmp:      Bmp,
	TypeJxr:      Jxr,
	TypePsd:      Psd,
	TypeIco:      Ico,
	TypeHeif:     Heif,
	TypeDwg:      Dwg,
}

func Jpeg(buf []byte) bool {
	return len(buf) > 2 &&
		buf[0] == 0xFF &&
		buf[1] == 0xD8 &&
		buf[2] == 0xFF
}

func Jpeg2000(buf []byte) bool {
	return len(buf) > 12 &&
		buf[0] == 0x0 &&
		buf[1] == 0x0 &&
		buf[2] == 0x0 &&
		buf[3] == 0xC &&
		buf[4] == 0x6A &&
		buf[5] == 0x50 &&
		buf[6] == 0x20 &&
		buf[7] == 0x20 &&
		buf[8] == 0xD &&
		buf[9] == 0xA &&
		buf[10] == 0x87 &&
		buf[11] == 0xA &&
		buf[12] == 0x0
}

func Png(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x89 && buf[1] == 0x50 &&
		buf[2] == 0x4E && buf[3] == 0x47
}

func Gif(buf []byte) bool {
	return len(buf) > 2 &&
		buf[0] == 0x47 && buf[1] == 0x49 && buf[2] == 0x46
}

func Webp(buf []byte) bool {
	return len(buf) > 11 &&
		buf[8] == 0x57 && buf[9] == 0x45 &&
		buf[10] == 0x42 && buf[11] == 0x50
}

func CR2(buf []byte) bool {
	return len(buf) > 9 &&
		((buf[0] == 0x49 && buf[1] == 0x49 && buf[2] == 0x2A && buf[3] == 0x0) ||
			(buf[0] == 0x4D && buf[1] == 0x4D && buf[2] == 0x0 && buf[3] == 0x2A)) &&
		buf[8] == 0x43 && buf[9] == 0x52
}

func Tiff(buf []byte) bool {
	return len(buf) > 3 &&
		((buf[0] == 0x49 && buf[1] == 0x49 && buf[2] == 0x2A && buf[3] == 0x0) ||
			(buf[0] == 0x4D && buf[1] == 0x4D && buf[2] == 0x0 && buf[3] == 0x2A))
}

func Bmp(buf []byte) bool {
	return len(buf) > 1 &&
		buf[0] == 0x42 &&
		buf[1] == 0x4D
}

func Jxr(buf []byte) bool {
	return len(buf) > 2 &&
		buf[0] == 0x49 &&
		buf[1] == 0x49 &&
		buf[2] == 0xBC
}

func Psd(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x38 && buf[1] == 0x42 &&
		buf[2] == 0x50 && buf[3] == 0x53
}

func Ico(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x00 && buf[1] == 0x00 &&
		buf[2] == 0x01 && buf[3] == 0x00
}

func Heif(buf []byte) bool {
	if !isobmff.IsISOBMFF(buf) {
		return false
	}

	majorBrand, _, compatibleBrands := isobmff.GetFtyp(buf)
	if majorBrand == "heic" {
		return true
	}

	if majorBrand == "mif1" || majorBrand == "msf1" {
		for _, compatibleBrand := range compatibleBrands {
			if compatibleBrand == "heic" {
				return true
			}
		}
	}

	return false
}

func Dwg(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x41 && buf[1] == 0x43 &&
		buf[2] == 0x31 && buf[3] == 0x30
}
