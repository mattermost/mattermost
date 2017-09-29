// +build arm64 amd64 ppc64 ppc64le mips64 mips64le s390x
// +build linux

package socket

type cmsghdr struct {
	Len   uint64
	Level int32
	Type  int32
}

const (
	sizeofCmsghdr = 0x10
)

func (h *cmsghdr) set(l, lvl, typ int) {
	h.Len = uint64(l)
	h.Level = int32(lvl)
	h.Type = int32(typ)
}
