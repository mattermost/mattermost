// +build arm mips mipsle 386
// +build linux

package socket

type cmsghdr struct {
	Len   uint32
	Level int32
	Type  int32
}

const (
	sizeofCmsghdr = 0xc
)

func (h *cmsghdr) set(l, lvl, typ int) {
	h.Len = uint32(l)
	h.Level = int32(lvl)
	h.Type = int32(typ)
}
