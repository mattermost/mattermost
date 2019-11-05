package matchers

var (
	TypeWoff  = newType("woff", "application/font-woff")
	TypeWoff2 = newType("woff2", "application/font-woff")
	TypeTtf   = newType("ttf", "application/font-sfnt")
	TypeOtf   = newType("otf", "application/font-sfnt")
)

var Font = Map{
	TypeWoff:  Woff,
	TypeWoff2: Woff2,
	TypeTtf:   Ttf,
	TypeOtf:   Otf,
}

func Woff(buf []byte) bool {
	return len(buf) > 7 &&
		buf[0] == 0x77 && buf[1] == 0x4F &&
		buf[2] == 0x46 && buf[3] == 0x46 &&
		buf[4] == 0x00 && buf[5] == 0x01 &&
		buf[6] == 0x00 && buf[7] == 0x00
}

func Woff2(buf []byte) bool {
	return len(buf) > 7 &&
		buf[0] == 0x77 && buf[1] == 0x4F &&
		buf[2] == 0x46 && buf[3] == 0x32 &&
		buf[4] == 0x00 && buf[5] == 0x01 &&
		buf[6] == 0x00 && buf[7] == 0x00
}

func Ttf(buf []byte) bool {
	return len(buf) > 4 &&
		buf[0] == 0x00 && buf[1] == 0x01 &&
		buf[2] == 0x00 && buf[3] == 0x00 &&
		buf[4] == 0x00
}

func Otf(buf []byte) bool {
	return len(buf) > 4 &&
		buf[0] == 0x4F && buf[1] == 0x54 &&
		buf[2] == 0x54 && buf[3] == 0x4F &&
		buf[4] == 0x00
}
