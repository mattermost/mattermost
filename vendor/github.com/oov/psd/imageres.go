package psd

import (
	"errors"
	"io"
)

// ImageResource represents the image resource that is used in psd file.
type ImageResource struct {
	Name string
	Data []byte
}

func readImageResource(r io.Reader) (resMap map[int]ImageResource, read int, err error) {
	if Debug != nil {
		Debug.Println("start - image resources section")
	}
	// Image Resources Section
	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_69883
	var l int
	b := make([]byte, 6)
	if l, err = io.ReadFull(r, b[:4]); err != nil {
		return nil, 0, err
	}
	read += l
	imageResourceLen := int(readUint32(b, 0))
	if imageResourceLen == 0 {
		return map[int]ImageResource{}, read, nil
	}

	resMap = map[int]ImageResource{}

	// Image Resource Blocks
	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_46269
	var id int
	for read < imageResourceLen {
		var res ImageResource

		// Signature: '8BIM'
		if l, err = io.ReadFull(r, b[:6]); err != nil {
			return nil, read, err
		}
		read += l

		// http://fileformats.archiveteam.org/wiki/Photoshop_Image_Resources
		// This document says:
		// Each block usually begins with the ASCII characters "8BIM",
		// a signature that appears in several Photoshop formats.
		// Other block signatures that have been observed are
		// "MeSa" (apparently associated with ImageReady),
		// "PHUT" (apparently associated with PhotoDeluxe), "AgHg", and "DCSR".
		sig := string(b[:4])
		if sig != "8BIM" && sig != "MeSa" && sig != "PHUT" && sig != "AgHg" && sig != "DCSR" {
			return nil, read, errors.New("psd: invalid image resource signature")
		}

		// Unique identifier for the resource.
		// Image resource IDs contains a list of resource IDs used by Photoshop.
		// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_38034
		id = int(readUint16(b, 4))

		// Name: Pascal string, padded to make the size even
		// (a null name consists of two bytes of 0)
		if res.Name, l, err = readPascalString(r); err != nil {
			return nil, read, err
		}
		read += l
		if l, err = adjustAlign2(r, l); err != nil {
			return nil, read, err
		}
		read += l

		// The resource data, described in the sections on the individual resource types.
		// It is padded to make the size even.
		if l, err = io.ReadFull(r, b[:4]); err != nil {
			return nil, read, err
		}
		read += l
		res.Data = make([]byte, readUint32(b, 0))
		if l, err = io.ReadFull(r, res.Data); err != nil {
			return nil, read, err
		}
		read += l
		if l, err = adjustAlign2(r, l); err != nil {
			return nil, read, err
		}
		read += l
		if Debug != nil {
			Debug.Printf("  id: %04x(%d) name: %s dataLen: %d", id, id, res.Name, len(res.Data))
		}
		resMap[id] = res
	}
	if Debug != nil {
		Debug.Println("end - image resources section")
	}
	return resMap, read, nil
}

func hasAlphaID0(Res map[int]ImageResource) bool {
	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_38034
	// 0x041D(1053) | (Photoshop 6.0) Alpha Identifiers.
	//                4 bytes of length, followed by 4 bytes each for every alpha identifier.
	//
	// This description is probably a little different from the actual structure.
	// "4 bytes of length" is included in Image Resource Blocks structure, not in the resource data block.
	// so alpha identifier appears from the head in the resource data block.
	aid, ok := Res[0x041D]
	if !ok {
		return true
	}
	for i, ln := 0, len(aid.Data); i < ln; i += 4 {
		if readUint32(aid.Data, i) == 0 {
			return true
		}
	}
	return false
}
