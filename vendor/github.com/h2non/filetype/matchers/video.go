package matchers

import "bytes"

var (
	TypeMp4  = newType("mp4", "video/mp4")
	TypeM4v  = newType("m4v", "video/x-m4v")
	TypeMkv  = newType("mkv", "video/x-matroska")
	TypeWebm = newType("webm", "video/webm")
	TypeMov  = newType("mov", "video/quicktime")
	TypeAvi  = newType("avi", "video/x-msvideo")
	TypeWmv  = newType("wmv", "video/x-ms-wmv")
	TypeMpeg = newType("mpg", "video/mpeg")
	TypeFlv  = newType("flv", "video/x-flv")
	Type3gp  = newType("3gp", "video/3gpp")
)

var Video = Map{
	TypeMp4:  Mp4,
	TypeM4v:  M4v,
	TypeMkv:  Mkv,
	TypeWebm: Webm,
	TypeMov:  Mov,
	TypeAvi:  Avi,
	TypeWmv:  Wmv,
	TypeMpeg: Mpeg,
	TypeFlv:  Flv,
	Type3gp:  Match3gp,
}

func M4v(buf []byte) bool {
	return len(buf) > 10 &&
		buf[4] == 0x66 && buf[5] == 0x74 &&
		buf[6] == 0x79 && buf[7] == 0x70 &&
		buf[8] == 0x4D && buf[9] == 0x34 &&
		buf[10] == 0x56
}

func Mkv(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x1A && buf[1] == 0x45 &&
		buf[2] == 0xDF && buf[3] == 0xA3 &&
		containsMatroskaSignature(buf, []byte{'m', 'a', 't', 'r', 'o', 's', 'k', 'a'})
}

func Webm(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x1A && buf[1] == 0x45 &&
		buf[2] == 0xDF && buf[3] == 0xA3 &&
		containsMatroskaSignature(buf, []byte{'w', 'e', 'b', 'm'})
}

func Mov(buf []byte) bool {
	return len(buf) > 15 && ((buf[0] == 0x0 && buf[1] == 0x0 &&
		buf[2] == 0x0 && buf[3] == 0x14 &&
		buf[4] == 0x66 && buf[5] == 0x74 &&
		buf[6] == 0x79 && buf[7] == 0x70) ||
		(buf[4] == 0x6d && buf[5] == 0x6f && buf[6] == 0x6f && buf[7] == 0x76) ||
		(buf[4] == 0x6d && buf[5] == 0x64 && buf[6] == 0x61 && buf[7] == 0x74) ||
		(buf[12] == 0x6d && buf[13] == 0x64 && buf[14] == 0x61 && buf[15] == 0x74))
}

func Avi(buf []byte) bool {
	return len(buf) > 10 &&
		buf[0] == 0x52 && buf[1] == 0x49 &&
		buf[2] == 0x46 && buf[3] == 0x46 &&
		buf[8] == 0x41 && buf[9] == 0x56 &&
		buf[10] == 0x49
}

func Wmv(buf []byte) bool {
	return len(buf) > 9 &&
		buf[0] == 0x30 && buf[1] == 0x26 &&
		buf[2] == 0xB2 && buf[3] == 0x75 &&
		buf[4] == 0x8E && buf[5] == 0x66 &&
		buf[6] == 0xCF && buf[7] == 0x11 &&
		buf[8] == 0xA6 && buf[9] == 0xD9
}

func Mpeg(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x0 && buf[1] == 0x0 &&
		buf[2] == 0x1 && buf[3] >= 0xb0 &&
		buf[3] <= 0xbf
}

func Flv(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x46 && buf[1] == 0x4C &&
		buf[2] == 0x56 && buf[3] == 0x01
}

func Mp4(buf []byte) bool {
	return len(buf) > 11 &&
		(buf[4] == 'f' && buf[5] == 't' && buf[6] == 'y' && buf[7] == 'p') &&
		((buf[8] == 'a' && buf[9] == 'v' && buf[10] == 'c' && buf[11] == '1') ||
			(buf[8] == 'd' && buf[9] == 'a' && buf[10] == 's' && buf[11] == 'h') ||
			(buf[8] == 'i' && buf[9] == 's' && buf[10] == 'o' && buf[11] == '2') ||
			(buf[8] == 'i' && buf[9] == 's' && buf[10] == 'o' && buf[11] == '3') ||
			(buf[8] == 'i' && buf[9] == 's' && buf[10] == 'o' && buf[11] == '4') ||
			(buf[8] == 'i' && buf[9] == 's' && buf[10] == 'o' && buf[11] == '5') ||
			(buf[8] == 'i' && buf[9] == 's' && buf[10] == 'o' && buf[11] == '6') ||
			(buf[8] == 'i' && buf[9] == 's' && buf[10] == 'o' && buf[11] == 'm') ||
			(buf[8] == 'm' && buf[9] == 'm' && buf[10] == 'p' && buf[11] == '4') ||
			(buf[8] == 'm' && buf[9] == 'p' && buf[10] == '4' && buf[11] == '1') ||
			(buf[8] == 'm' && buf[9] == 'p' && buf[10] == '4' && buf[11] == '2') ||
			(buf[8] == 'm' && buf[9] == 'p' && buf[10] == '4' && buf[11] == 'v') ||
			(buf[8] == 'm' && buf[9] == 'p' && buf[10] == '7' && buf[11] == '1') ||
			(buf[8] == 'M' && buf[9] == 'S' && buf[10] == 'N' && buf[11] == 'V') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'A' && buf[11] == 'S') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'S' && buf[11] == 'C') ||
			(buf[8] == 'N' && buf[9] == 'S' && buf[10] == 'D' && buf[11] == 'C') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'S' && buf[11] == 'H') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'S' && buf[11] == 'M') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'S' && buf[11] == 'P') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'S' && buf[11] == 'S') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'X' && buf[11] == 'C') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'X' && buf[11] == 'H') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'X' && buf[11] == 'M') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'X' && buf[11] == 'P') ||
			(buf[8] == 'N' && buf[9] == 'D' && buf[10] == 'X' && buf[11] == 'S') ||
			(buf[8] == 'F' && buf[9] == '4' && buf[10] == 'V' && buf[11] == ' ') ||
			(buf[8] == 'F' && buf[9] == '4' && buf[10] == 'P' && buf[11] == ' '))
}

func Match3gp(buf []byte) bool {
	return len(buf) > 10 &&
		buf[4] == 0x66 && buf[5] == 0x74 && buf[6] == 0x79 &&
		buf[7] == 0x70 && buf[8] == 0x33 && buf[9] == 0x67 &&
		buf[10] == 0x70
}

func containsMatroskaSignature(buf, subType []byte) bool {
	limit := 4096
	if len(buf) < limit {
		limit = len(buf)
	}

	index := bytes.Index(buf[:limit], subType)
	if index < 3 {
		return false
	}

	return buf[index-3] == 0x42 && buf[index-2] == 0x82
}
