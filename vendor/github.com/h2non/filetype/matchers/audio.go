package matchers

var (
	TypeMidi = newType("mid", "audio/midi")
	TypeMp3  = newType("mp3", "audio/mpeg")
	TypeM4a  = newType("m4a", "audio/m4a")
	TypeOgg  = newType("ogg", "audio/ogg")
	TypeFlac = newType("flac", "audio/x-flac")
	TypeWav  = newType("wav", "audio/x-wav")
	TypeAmr  = newType("amr", "audio/amr")
	TypeAac  = newType("aac", "audio/aac")
)

var Audio = Map{
	TypeMidi: Midi,
	TypeMp3:  Mp3,
	TypeM4a:  M4a,
	TypeOgg:  Ogg,
	TypeFlac: Flac,
	TypeWav:  Wav,
	TypeAmr:  Amr,
	TypeAac:  Aac,
}

func Midi(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x4D && buf[1] == 0x54 &&
		buf[2] == 0x68 && buf[3] == 0x64
}

func Mp3(buf []byte) bool {
	return len(buf) > 2 &&
		((buf[0] == 0x49 && buf[1] == 0x44 && buf[2] == 0x33) ||
			(buf[0] == 0xFF && buf[1] == 0xfb))
}

func M4a(buf []byte) bool {
	return len(buf) > 10 &&
		((buf[4] == 0x66 && buf[5] == 0x74 && buf[6] == 0x79 &&
			buf[7] == 0x70 && buf[8] == 0x4D && buf[9] == 0x34 && buf[10] == 0x41) ||
			(buf[0] == 0x4D && buf[1] == 0x34 && buf[2] == 0x41 && buf[3] == 0x20))
}

func Ogg(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x4F && buf[1] == 0x67 &&
		buf[2] == 0x67 && buf[3] == 0x53
}

func Flac(buf []byte) bool {
	return len(buf) > 3 &&
		buf[0] == 0x66 && buf[1] == 0x4C &&
		buf[2] == 0x61 && buf[3] == 0x43
}

func Wav(buf []byte) bool {
	return len(buf) > 11 &&
		buf[0] == 0x52 && buf[1] == 0x49 &&
		buf[2] == 0x46 && buf[3] == 0x46 &&
		buf[8] == 0x57 && buf[9] == 0x41 &&
		buf[10] == 0x56 && buf[11] == 0x45
}

func Amr(buf []byte) bool {
	return len(buf) > 11 &&
		buf[0] == 0x23 && buf[1] == 0x21 &&
		buf[2] == 0x41 && buf[3] == 0x4D &&
		buf[4] == 0x52 && buf[5] == 0x0A
}

func Aac(buf []byte) bool {
	return len(buf) > 1 &&
		((buf[0] == 0xFF && buf[1] == 0xF1) ||
			(buf[0] == 0xFF && buf[1] == 0xF9))
}
