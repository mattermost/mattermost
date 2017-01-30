package fuse

import "time"

type attr struct {
	Ino       uint64
	Size      uint64
	Blocks    uint64
	Atime     uint64
	Mtime     uint64
	Ctime     uint64
	AtimeNsec uint32
	MtimeNsec uint32
	CtimeNsec uint32
	Mode      uint32
	Nlink     uint32
	Uid       uint32
	Gid       uint32
	Rdev      uint32
	//	Blksize   uint32  // Only in protocol 7.9
	//	padding_  uint32  // Only in protocol 7.9
}

func (a *attr) Crtime() time.Time {
	return time.Time{}
}

func (a *attr) SetCrtime(s uint64, ns uint32) {
	// Ignored on Linux.
}

func (a *attr) SetFlags(f uint32) {
	// Ignored on Linux.
}

type setattrIn struct {
	setattrInCommon
}

func (in *setattrIn) BkupTime() time.Time {
	return time.Time{}
}

func (in *setattrIn) Chgtime() time.Time {
	return time.Time{}
}

func (in *setattrIn) Flags() uint32 {
	return 0
}
