package psd

import (
	"errors"
	"image"
	"io"
)

// Layer represents layer.
type Layer struct {
	SeqID int

	Name        string
	UnicodeName string
	MBCSName    string

	Rect image.Rectangle
	// Channel key is the channel ID.
	// 	0 = red, 1 = green, etc.
	// 	-1 = transparency mask
	// 	-2 = user supplied layer mask
	// 	-3 = real user supplied layer mask
	//         (when both a user mask and a vector mask are present)
	Channel               map[int]Channel
	BlendMode             BlendMode
	Opacity               uint8
	Clipping              bool
	BlendClippedElements  bool
	Flags                 uint8
	Mask                  Mask
	Picker                image.Image
	AdditionalLayerInfo   map[AdditionalInfoKey][]byte
	SectionDividerSetting struct {
		Type      int
		BlendMode BlendMode
		SubType   int
	}

	Layer []Layer
}

// TransparencyProtected returns whether the layer's transparency being protected.
func (l *Layer) TransparencyProtected() bool {
	return l.Flags&1 != 0
}

// Visible returns whether the layer is visible.
func (l *Layer) Visible() bool {
	return l.Flags&2 == 0
}

// HasImage returns whether the layer has an image data.
func (l *Layer) HasImage() bool {
	return l.SectionDividerSetting.Type == 0
}

// Folder returns whether the layer is folder(group layer).
func (l *Layer) Folder() bool {
	return l.SectionDividerSetting.Type == 1 || l.SectionDividerSetting.Type == 2
}

// FolderIsOpen returns whether the folder is opened when layer is folder.
func (l *Layer) FolderIsOpen() bool {
	return l.SectionDividerSetting.Type == 1
}

func (l *Layer) String() string {
	return l.Name
}

// Mask represents layer mask and vector mask.
type Mask struct {
	Rect         image.Rectangle
	DefaultColor int
	Flags        int

	RealRect            image.Rectangle
	RealBackgroundColor int
	RealFlags           int

	UserMaskDensity   int
	UserMaskFeather   float64
	VectorMaskDensity int
	VectorMaskFeather float64
}

// Enabled returns whether the mask is enabled.
func (m *Mask) Enabled() bool {
	return m.Flags&2 == 0
}

// RealEnabled returns whether the user real mask is enabled.
func (m *Mask) RealEnabled() bool {
	return m.RealFlags&2 == 0
}

// Channel represents a channel of the color.
type Channel struct {
	// Data is uncompressed channel image data.
	Data   []byte
	Picker image.Image
}

func readLayerAndMaskInfo(r io.Reader, cfg *Config, o *DecodeOptions) (psd *PSD, read int, err error) {
	if Debug != nil {
		Debug.Println("start - layer and mask information section")
	}

	psd = &PSD{
		Config: *cfg,
	}

	// Layer and Mask Information Section
	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_75067
	intSize := get4or8(cfg.PSB())
	b := make([]byte, intSize)
	var l int
	if l, err = io.ReadFull(r, b[:intSize]); err != nil {
		return nil, 0, err
	}
	read += l
	layerAndMaskInfoLen := int(readUint(b, 0, intSize))
	if Debug != nil {
		Debug.Println("  layerAndMaskInfoLen:", layerAndMaskInfoLen)
		reportReaderPosition("  file offset: 0x%08x", r)
	}
	if layerAndMaskInfoLen == 0 {
		return psd, read, nil
	}

	var layer []Layer
	if read < layerAndMaskInfoLen+intSize {
		if layer, l, err = readLayerInfo(r, cfg, o); err != nil {
			return nil, read, err
		}
		read += l
	}

	if layerAndMaskInfoLen+intSize-read >= 4 {
		// Global layer mask info
		// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_17115
		if l, err = io.ReadFull(r, b[:4]); err != nil {
			return nil, read, err
		}
		read += l
		if globalLayerMaskInfoLen := int(readUint32(b, 0)); globalLayerMaskInfoLen > 0 {
			if Debug != nil {
				Debug.Println("  globalLayerMaskInfoLen:", globalLayerMaskInfoLen)
				reportReaderPosition("    file offset: 0x%08x", r)
			}
			// TODO(oov): implement
			if l, err = discard(r, globalLayerMaskInfoLen); err != nil {
				return nil, read, err
			}
			read += l
		}
	}

	if layerAndMaskInfoLen+intSize-read >= 8 {
		var layer2 []Layer
		if psd.AdditinalLayerInfo, layer2, l, err = readAdditionalLayerInfo(r, layerAndMaskInfoLen+intSize-read, cfg, o); err != nil {
			return nil, read, err
		}
		read += l
		if layer != nil && layer2 != nil {
			return nil, read, errors.New("psd: unexpected layer structure")
		}
		if layer2 != nil {
			layer = layer2
		}
	}

	if psd.Layer, err = buildTree(layer); err != nil {
		return nil, read, err
	}

	if remain := layerAndMaskInfoLen + intSize - read; remain != 0 && remain < intSize {
		if l, err = discard(r, remain); err != nil {
			return nil, read, err
		}
		read += l
	}

	if read != layerAndMaskInfoLen+intSize {
		return nil, read, errors.New("psd: layer and mask info read size mismatched. expected " + itoa(layerAndMaskInfoLen+4) + " actual " + itoa(read))
	}
	if Debug != nil {
		Debug.Println("end - layer and mask information section")
	}
	return psd, read, nil
}

func buildTree(layer []Layer) ([]Layer, error) {
	// idx type
	// 0: 3
	// 1:  3
	// 2:   0
	// 3:   0
	// 4:  1
	// 5:  0
	// 6:  0
	// 7: 1
	stack := make([][]Layer, 0, 8)
	n := []Layer{}
	for i, l := range layer {
		switch l.SectionDividerSetting.Type {
		case 1, 2:
			l.Layer = n
			if len(stack) == 0 {
				return nil, errors.New("psd: layer tree structure is broken(#" + itoa(i) + ")")
			}
			n = stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			n = append(n, l)
		case 3:
			stack = append(stack, n)
			n = []Layer{}
		default:
			n = append(n, l)
		}
	}
	return n, nil
}

func readSectionDividerSetting(l *Layer) (typ int, blendMode BlendMode, subType int, err error) {
	b, ok := l.AdditionalLayerInfo[AdditionalInfoKeySectionDividerSetting]
	if ok {
		typ = int(readUint32(b, 0))
		if len(b) < 12 {
			return typ, "", 0, nil
		}
		if string(b[4:8]) != sectionSignature {
			return 0, "", 0, errors.New("psd: unexpected signature in section divider setting")
		}
		blendMode = BlendMode(b[8:12])
		if len(b) < 16 {
			return typ, blendMode, 0, nil
		}
		subType = int(readUint32(b, 12))
		return typ, blendMode, subType, nil
	}
	b, ok = l.AdditionalLayerInfo[AdditionalInfoKeySectionDividerSetting2]
	if ok {
		typ = int(readUint32(b, 0))
		if len(b) < 12 {
			return typ, "", 0, nil
		}
		if string(b[4:8]) != sectionSignature {
			return 0, "", 0, errors.New("psd: unexpected signature in section divider setting 2")
		}
		blendMode = BlendMode(b[8:12])
		if len(b) < 16 {
			return typ, blendMode, 0, nil
		}
		subType = int(readUint32(b, 12))
		return typ, blendMode, subType, nil
	}
	return 0, "", 0, nil
}

type channelData struct {
	ChIndex int
	DataLen int
}

type layerChannelInfo struct {
	Layer       *Layer
	ChannelData []channelData
}

func readLayerInfo(r io.Reader, cfg *Config, o *DecodeOptions) (layer []Layer, read int, err error) {
	intSize := get4or8(cfg.PSB())
	if Debug != nil {
		Debug.Println("start - layer info section")
	}
	b := make([]byte, 16)
	var l int
	if l, err = io.ReadFull(r, b[:intSize]); err != nil {
		return nil, 0, err
	}
	read += l
	layerInfoLen := int(readUint(b, 0, intSize))
	if Debug != nil {
		Debug.Println("  layerInfoLen:", layerInfoLen)
	}
	if layerInfoLen == 0 {
		if Debug != nil {
			Debug.Println("end - layer info section")
		}
		return nil, read, nil
	}

	if l, err = io.ReadFull(r, b[:2]); err != nil {
		return nil, read, err
	}
	read += l
	numLayers := readUint16(b, 0)
	if numLayers&0x8000 != 0 {
		numLayers = ^numLayers + 1
		// how can I use this info...?
		// hasAlphaForMergedResult = true
	}
	if Debug != nil {
		Debug.Println("  numLayers:", numLayers)
	}

	layerSlice := make([]Layer, numLayers)
	lcis := make([]layerChannelInfo, numLayers)
	for i := range layerSlice {
		if Debug != nil {
			Debug.Printf("start - layer #%d structure", i)
		}
		layer := &layerSlice[i]
		layer.SeqID = i

		if l, err = io.ReadFull(r, b[:16]); err != nil {
			return nil, read, err
		}
		read += l
		layer.Rect = image.Rect(
			int(int32(readUint32(b, 4))), int(int32(readUint32(b, 0))),
			int(int32(readUint32(b, 12))), int(int32(readUint32(b, 8))),
		)

		if l, err = io.ReadFull(r, b[:2]); err != nil {
			return nil, read, err
		}
		read += l
		numChannels := int(readUint16(b, 0))

		lci := layerChannelInfo{
			Layer:       layer,
			ChannelData: make([]channelData, numChannels),
		}
		for j := 0; j < numChannels; j++ {
			if l, err = io.ReadFull(r, b[:2+intSize]); err != nil {
				return nil, read, err
			}
			read += l
			lci.ChannelData[j] = channelData{
				ChIndex: int(int16(readUint16(b, 0))),
				DataLen: int(readUint(b, 2, intSize)),
			}
		}
		lcis[i] = lci

		if l, err = io.ReadFull(r, b[:12]); err != nil {
			return nil, read, err
		}
		read += l
		if string(b[:4]) != sectionSignature {
			return nil, read, errors.New("psd: unexpected the blend mode signature")
		}
		layer.BlendMode = BlendMode(b[4:8])
		layer.Opacity = b[8]
		layer.Clipping = b[9] != 0
		layer.Flags = b[10]
		// b[11] - Filler(zero)
		if l, err = readLayerExtraData(r, layer, cfg, o); err != nil {
			return nil, read, err
		}
		read += l

		if data, ok := layer.AdditionalLayerInfo[AdditionalInfoKeyUnicodeLayerName]; ok && data != nil {
			layer.UnicodeName = readUnicodeString(data)
			layer.Name = layer.UnicodeName
			delete(layer.AdditionalLayerInfo, AdditionalInfoKeyUnicodeLayerName)
		} else {
			layer.Name = layer.MBCSName
		}

		// this is called "Blend Clipped Layers as Group" in Photoshop's Layer Style dialog.
		if data, ok := layer.AdditionalLayerInfo[AdditionalInfoKeyBlendClippingElements]; ok && data != nil {
			layer.BlendClippedElements = data[0] != 0
			delete(layer.AdditionalLayerInfo, AdditionalInfoKeyBlendClippingElements)
		} else {
			layer.BlendClippedElements = true
		}

		if layer.SectionDividerSetting.Type,
			layer.SectionDividerSetting.BlendMode,
			layer.SectionDividerSetting.SubType,
			err = readSectionDividerSetting(layer); err != nil {
			return nil, read, err
		}
		if layer.SectionDividerSetting.BlendMode == "" {
			layer.SectionDividerSetting.BlendMode = layer.BlendMode
		}
		delete(layer.AdditionalLayerInfo, AdditionalInfoKeySectionDividerSetting)

		if Debug != nil {
			Debug.Printf("layer #%d", layer.SeqID)
			Debug.Println("  Name:", layer.Name)
			Debug.Println("  Rect:", layer.Rect)
			Debug.Println("  Channels:", len(layer.Channel))
			Debug.Println("  BlendMode:", layer.BlendMode)
			Debug.Println("  Opacity:", layer.Opacity)
			Debug.Println("  Clipping:", layer.Clipping)
			Debug.Println("  Flags:", layer.Flags)
			Debug.Println("    TransparecyProtected:", layer.TransparencyProtected())
			Debug.Println("    Visible:", layer.Visible())
			Debug.Println("    Photoshop 5.0 and later:", layer.Flags&8 != 0)
			// this information is useful for the group layer,
			// but sadly it isn't written correctly by some other softwares.
			Debug.Println("    Pixel data irrelevant to appearance of document:", layer.Flags&8 != 0 && layer.Flags&16 != 0)
			Debug.Println("  SectionDividerSetting:")
			Debug.Println("    Type:", layer.SectionDividerSetting.Type)
			Debug.Println("    BlendMode:", layer.SectionDividerSetting.BlendMode)
			Debug.Println("    SubType:", layer.SectionDividerSetting.SubType)
			Debug.Println("  LayerMask:")
			Debug.Println("    Rect:", layer.Mask.Rect)
			Debug.Println("    DefaultColor:", layer.Mask.DefaultColor)
			Debug.Println("    Flags:", layer.Mask.Flags)
			Debug.Println("      Position relative to layer:", layer.Mask.Flags&1 != 0)
			Debug.Println("      Layer mask enabled:", layer.Mask.Enabled())
			Debug.Println("      Invert layer mask when blending (Obsolete):", layer.Mask.Flags&4 != 0)
			Debug.Println("      The user mask actually came from rendering other data:", layer.Mask.Flags&8 != 0)
			Debug.Printf("end - layer #%d structure", i)
		}
	}
	if !o.SkipLayerImage {
		if l, err = readLayerImage(lcis, r, cfg, o); err != nil {
			return nil, read, err
		}
		read += l
		if l, err = adjustAlign4(r, read+4-layerInfoLen); err != nil {
			return nil, read, err
		}
		read += l
	} else {
		if l, err = discard(r, layerInfoLen+4-read); err != nil {
			return nil, read, err
		}
		read += l
	}

	if layerInfoLen+intSize != read {
		return nil, read, errors.New("psd: layer info read size mismatched. expected " + itoa(layerInfoLen+4) + " actual " + itoa(read))
	}
	if Debug != nil {
		Debug.Println("end - layer info section")
	}
	return layerSlice, read, nil
}

func readLayerImage(lcis []layerChannelInfo, r io.Reader, cfg *Config, o *DecodeOptions) (read int, err error) {
	var l int
	b := make([]byte, 2)
	for i, lci := range lcis {
		chMap := map[int]Channel{}
		pickerChs := make([][]byte, cfg.ColorMode.Channels(), 8)
		for _, j := range lci.ChannelData {
			var readCh int
			if j.DataLen >= 2 {
				if l, err = io.ReadFull(r, b[:2]); err != nil {
					return read, err
				}
				readCh += l
				read += l
			}
			cmpMethod := CompressionMethod(readUint16(b, 0))
			if Debug != nil {
				Debug.Printf("  layer #%d %q channel #%d image data", i, lci.Layer.Name, j.ChIndex)
				Debug.Println("    length:", j.DataLen, "compression method:", cmpMethod)
				reportReaderPosition("    file offset: 0x%08x", r)
			}

			var rect image.Rectangle
			switch j.ChIndex {
			case -3:
				rect = lci.Layer.Mask.RealRect
			case -2:
				rect = lci.Layer.Mask.Rect
			default:
				rect = lci.Layer.Rect
			}
			data := make([]byte, (rect.Dx()*cfg.Depth+7)>>3*rect.Dy())
			pk := findGrayPicker(cfg.Depth)
			pk.setSource(rect, data)

			if j.DataLen > 2 {
				if l, err = cmpMethod.Decode(data, r, int64(j.DataLen-2), rect, cfg.Depth, 1, cfg.PSB()); err != nil {
					return read, err
				}
				readCh += l
				read += l
			}
			// It seems we can discard in this case
			if readCh < j.DataLen {
				if l, err = discard(r, j.DataLen-readCh); err != nil {
					return read, err
				}
				readCh += l
				read += l
			}
			if readCh != j.DataLen {
				return read, errors.New("psd: layer: " + itoa(i) + " channel: " + itoa(j.ChIndex) + " read size mismatched. expected " + itoa(j.DataLen) + " actual " + itoa(readCh))
			}

			chMap[j.ChIndex] = Channel{
				Data:   data,
				Picker: pk,
			}
			switch {
			case j.ChIndex >= 0:
				pickerChs[j.ChIndex] = data
			case j.ChIndex == -1:
				pickerChs = append(pickerChs, data)
			}
		}
		pk := findPicker(cfg.Depth, cfg.ColorMode, cfg.ColorMode.Channels() < len(pickerChs))
		pk.setSource(lci.Layer.Rect, pickerChs...)
		lci.Layer.Picker = pk
		lci.Layer.Channel = chMap
		if o.LayerImageLoaded != nil {
			o.LayerImageLoaded(lci.Layer, i, len(lcis))
		}
	}
	return read, nil
}

func readLayerExtraData(r io.Reader, layer *Layer, cfg *Config, o *DecodeOptions) (read int, err error) {
	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_22582
	// Layer mask / adjustment layer data
	if Debug != nil {
		Debug.Println("start - layer extra data section")
	}
	b := make([]byte, 16)
	var l int
	if l, err = io.ReadFull(r, b[:4]); err != nil {
		return 0, err
	}
	read += l
	extraDataLen := int(readUint32(b, 0))
	if Debug != nil {
		Debug.Println("  extraDataLen:", extraDataLen)
	}
	if extraDataLen == 0 {
		return read, err
	}

	l, err = readLayerMaskAndAdjustmentLayerData(r, layer, cfg, o)
	read += l
	if err != nil {
		return read, err
	}

	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_21332
	// Layer blending ranges data
	if l, err = io.ReadFull(r, b[:4]); err != nil {
		return read, err
	}
	read += l
	if blendingRangesLen := int(readUint32(b, 0)); blendingRangesLen > 0 {
		if Debug != nil {
			Debug.Println("  layer blending ranges data skipped:", blendingRangesLen)
		}
		// TODO(oov): implement
		if l, err = discard(r, blendingRangesLen); err != nil {
			return read, err
		}
		read += l
	}

	// Layer name: Pascal string, padded to a multiple of 4 bytes.
	if layer.MBCSName, l, err = readPascalString(r); err != nil {
		return read, err
	}
	read += l
	if l, err = adjustAlign4(r, l); err != nil {
		return read, err
	}
	read += l

	if read < extraDataLen+4 {
		var layers []Layer
		if layer.AdditionalLayerInfo, layers, l, err = readAdditionalLayerInfo(r, extraDataLen+4-read, cfg, o); err != nil {
			return read, err
		}
		read += l
		if len(layers) > 0 {
			return read, errors.New("psd: unexpected layer structure")
		}
	} else {
		layer.AdditionalLayerInfo = map[AdditionalInfoKey][]byte{}
	}

	if extraDataLen+4 != read {
		return read, errors.New("psd: layer extra info read size mismatched. expected " + itoa(extraDataLen+4) + " actual " + itoa(read))
	}
	if Debug != nil {
		Debug.Println("end - layer extra data section")
	}
	return read, nil
}

func readLayerMaskAndAdjustmentLayerData(r io.Reader, layer *Layer, cfg *Config, o *DecodeOptions) (read int, err error) {
	// Layer mask / adjustment layer data
	// Can be 40 bytes, 24 bytes, or 4 bytes if no layer mask.
	// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_22582
	var l int
	b := make([]byte, 16)
	if l, err = io.ReadFull(r, b[:4]); err != nil {
		return read, err
	}
	read += l

	maskLen := int(readUint32(b, 0))
	if maskLen == 0 {
		// no layer mask
		return read, nil
	}
	var readMask int

	if maskLen-readMask < 16 {
		// "Rectangle enclosing layer mask" is not present.
		if maskLen-readMask > 0 {
			l, err = discard(r, maskLen-readMask)
			read += l
			if err != nil {
				return read, err
			}
		}
		return read, nil
	}
	if l, err = io.ReadFull(r, b[:16]); err != nil {
		return read, err
	}
	read += l
	readMask += l
	layer.Mask.Rect = image.Rect(
		int(int32(readUint32(b, 4))), int(int32(readUint32(b, 0))),
		int(int32(readUint32(b, 12))), int(int32(readUint32(b, 8))),
	)

	if maskLen-readMask < 1 {
		// "Default color" is not present.
		return read, nil
	}
	if l, err = io.ReadFull(r, b[:1]); err != nil {
		return read, err
	}
	read += l
	readMask += l
	layer.Mask.DefaultColor = int(b[0])

	// bit 0 = position relative to layer
	// bit 1 = layer mask disabled
	// bit 2 = invert layer mask when blending (Obsolete)
	// bit 3 = indicates that the user mask actually came from rendering other data
	// bit 4 = indicates that the user and/or vector masks have parameters applied to them
	if maskLen-readMask < 1 {
		// "Flags" is not present.
		return read, nil
	}
	if l, err = io.ReadFull(r, b[:1]); err != nil {
		return read, err
	}
	read += l
	readMask += l
	layer.Mask.Flags = int(b[0])

	layer.Mask.UserMaskDensity = 255
	layer.Mask.VectorMaskDensity = 255

	// Mask Parameters. Only present if bit 4 of Flags set above.
	if layer.Mask.Flags&16 != 0 {
		if maskLen-readMask < 1 {
			// "Mask Parameters" is not present.
			return read, nil
		}
		if l, err = io.ReadFull(r, b[:1]); err != nil {
			return read, err
		}
		read += l
		readMask += l

		// Mask Parameters bit flags present as follows:
		// bit 0 = user mask density, 1 byte
		// bit 1 = user mask feather, 8 byte, double
		// bit 2 = vector mask density, 1 byte
		// bit 3 = vector mask feather, 8 bytes, double
		maskParam := int(b[0])
		if maskParam&1 != 0 {
			if maskLen-readMask < 1 {
				// "user mask density" is not present.
				return read, nil
			}
			if l, err = io.ReadFull(r, b[:1]); err != nil {
				return read, err
			}
			read += l
			readMask += l
			layer.Mask.UserMaskDensity = int(b[0])
		}
		if maskParam&2 != 0 {
			if maskLen-readMask < 8 {
				// "user mask feather" is not present.
				if maskLen-readMask > 0 {
					l, err = discard(r, maskLen-readMask)
					read += l
					if err != nil {
						return read, err
					}
				}
				return read, nil
			}
			if l, err = io.ReadFull(r, b[:8]); err != nil {
				return read, err
			}
			read += l
			readMask += l
			layer.Mask.UserMaskFeather = readFloat64(b, 0)
		}
		if maskParam&4 != 0 {
			if maskLen-readMask < 1 {
				// "vector mask density" is not present.
				return read, nil
			}
			if l, err = io.ReadFull(r, b[:1]); err != nil {
				return read, err
			}
			read += l
			readMask += l
			layer.Mask.VectorMaskDensity = int(b[0])
		}
		if maskParam&8 != 0 {
			if maskLen-readMask < 8 {
				// "vector mask feather" is not present.
				if maskLen-readMask > 0 {
					l, err = discard(r, maskLen-readMask)
					read += l
					if err != nil {
						return read, err
					}
				}
				return read, nil
			}
			if l, err = io.ReadFull(r, b[:8]); err != nil {
				return read, err
			}
			read += l
			readMask += l
			layer.Mask.VectorMaskFeather = readFloat64(b, 0)
		}
	}

	if maskLen == 20 {
		// Padding. Only present if size = 20.
		if readMask < maskLen && maskLen-readMask <= 2 {
			if l, err = io.ReadFull(r, b[:maskLen-readMask]); err != nil {
				return read, err
			}
			read += l
			readMask += l
		}
		return read, nil
	}

	if maskLen-readMask < 1 {
		// "Real Flags" is not present.
		return read, nil
	}
	if l, err = io.ReadFull(r, b[:1]); err != nil {
		return read, err
	}
	read += l
	readMask += l
	layer.Mask.RealFlags = int(b[0])

	if maskLen-readMask < 1 {
		// "Real user mask background" is not present.
		return read, nil
	}
	if l, err = io.ReadFull(r, b[:1]); err != nil {
		return read, err
	}
	read += l
	readMask += l
	layer.Mask.RealBackgroundColor = int(b[0])

	if maskLen-readMask < 16 {
		// "Rectangle enclosing layer mask" is not present.
		if maskLen-readMask > 0 {
			l, err = discard(r, maskLen-readMask)
			read += l
			if err != nil {
				return read, err
			}
		}
		return read, nil
	}
	if l, err = io.ReadFull(r, b[:16]); err != nil {
		return read, err
	}
	read += l
	readMask += l
	layer.Mask.RealRect = image.Rect(
		int(readUint32(b, 4)), int(readUint32(b, 0)),
		int(readUint32(b, 12)), int(readUint32(b, 8)),
	)

	return read, nil
}

func readAdditionalLayerInfo(r io.Reader, infoLen int, cfg *Config, o *DecodeOptions) (infos map[AdditionalInfoKey][]byte, layers []Layer, read int, err error) {
	if Debug != nil {
		Debug.Println("start - additional layer info section")
		Debug.Println("  infoLen:", infoLen)
	}
	infos = map[AdditionalInfoKey][]byte{}
	b := make([]byte, 8)
	var l int
	for read < infoLen {
		// Sometimes I encountered padded section and unpadded section,
		// so find the signature to avoid failure.
		b[0] = 0
		for read < infoLen && b[0] != '8' {
			if l, err = io.ReadFull(r, b[:1]); err != nil {
				return nil, nil, read, err
			}
			read += l
		}
		if b[0] != '8' {
			break
		}
		if l, err = io.ReadFull(r, b[1:]); err != nil {
			return nil, nil, read, err
		}
		read += l

		if sig := string(b[:4]); sig != sectionSignature && sig != "8B64" {
			return nil, nil, read, errors.New("psd: unexpected the signature found in the additional layer information block")
		}

		key := AdditionalInfoKey(b[4:])
		switch key {
		case AdditionalInfoKeyLayerInfo,
			AdditionalInfoKeyLayerInfo16,
			AdditionalInfoKeyLayerInfo32:
			if Debug != nil {
				Debug.Println("  key:", key)
			}
			var layrs []Layer
			if layrs, l, err = readLayerInfo(r, cfg, o); err != nil {
				return nil, nil, read, err
			}
			read += l
			layers = append(layers, layrs...)
		default:
			intSize := key.LenSize(cfg.PSB())
			if l, err = io.ReadFull(r, b[:intSize]); err != nil {
				return nil, nil, read, err
			}
			read += l
			var data []byte
			if ln := int(readUint(b, 0, intSize)); ln > 0 {
				data = make([]byte, ln)
				if l, err = io.ReadFull(r, data); err != nil {
					return nil, nil, read, err
				}
				read += l
			}
			infos[key] = data
			if Debug != nil {
				Debug.Println("  key:", key, "dataLen:", len(data))
			}
		}
	}
	if infoLen != read {
		return nil, nil, read, errors.New("psd: additional layer info read size mismatched. expected " + itoa(infoLen) + " actual " + itoa(read))
	}
	if Debug != nil {
		Debug.Println("end - additional layer info section")
	}
	return infos, layers, read, nil
}
