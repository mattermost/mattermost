package exif

type FieldName string

// UnknownPrefix is used as the first part of field names for decoded tags for
// which there is no known/supported EXIF field.
const UnknownPrefix = "UnknownTag_"

// Primary EXIF fields
const (
	ImageWidth                 FieldName = "ImageWidth"
	ImageLength                FieldName = "ImageLength" // Image height called Length by EXIF spec
	BitsPerSample              FieldName = "BitsPerSample"
	Compression                FieldName = "Compression"
	PhotometricInterpretation  FieldName = "PhotometricInterpretation"
	Orientation                FieldName = "Orientation"
	SamplesPerPixel            FieldName = "SamplesPerPixel"
	PlanarConfiguration        FieldName = "PlanarConfiguration"
	YCbCrSubSampling           FieldName = "YCbCrSubSampling"
	YCbCrPositioning           FieldName = "YCbCrPositioning"
	XResolution                FieldName = "XResolution"
	YResolution                FieldName = "YResolution"
	ResolutionUnit             FieldName = "ResolutionUnit"
	DateTime                   FieldName = "DateTime"
	ImageDescription           FieldName = "ImageDescription"
	Make                       FieldName = "Make"
	Model                      FieldName = "Model"
	Software                   FieldName = "Software"
	Artist                     FieldName = "Artist"
	Copyright                  FieldName = "Copyright"
	ExifIFDPointer             FieldName = "ExifIFDPointer"
	GPSInfoIFDPointer          FieldName = "GPSInfoIFDPointer"
	InteroperabilityIFDPointer FieldName = "InteroperabilityIFDPointer"
	ExifVersion                FieldName = "ExifVersion"
	FlashpixVersion            FieldName = "FlashpixVersion"
	ColorSpace                 FieldName = "ColorSpace"
	ComponentsConfiguration    FieldName = "ComponentsConfiguration"
	CompressedBitsPerPixel     FieldName = "CompressedBitsPerPixel"
	PixelXDimension            FieldName = "PixelXDimension"
	PixelYDimension            FieldName = "PixelYDimension"
	MakerNote                  FieldName = "MakerNote"
	UserComment                FieldName = "UserComment"
	RelatedSoundFile           FieldName = "RelatedSoundFile"
	DateTimeOriginal           FieldName = "DateTimeOriginal"
	DateTimeDigitized          FieldName = "DateTimeDigitized"
	SubSecTime                 FieldName = "SubSecTime"
	SubSecTimeOriginal         FieldName = "SubSecTimeOriginal"
	SubSecTimeDigitized        FieldName = "SubSecTimeDigitized"
	ImageUniqueID              FieldName = "ImageUniqueID"
	ExposureTime               FieldName = "ExposureTime"
	FNumber                    FieldName = "FNumber"
	ExposureProgram            FieldName = "ExposureProgram"
	SpectralSensitivity        FieldName = "SpectralSensitivity"
	ISOSpeedRatings            FieldName = "ISOSpeedRatings"
	OECF                       FieldName = "OECF"
	ShutterSpeedValue          FieldName = "ShutterSpeedValue"
	ApertureValue              FieldName = "ApertureValue"
	BrightnessValue            FieldName = "BrightnessValue"
	ExposureBiasValue          FieldName = "ExposureBiasValue"
	MaxApertureValue           FieldName = "MaxApertureValue"
	SubjectDistance            FieldName = "SubjectDistance"
	MeteringMode               FieldName = "MeteringMode"
	LightSource                FieldName = "LightSource"
	Flash                      FieldName = "Flash"
	FocalLength                FieldName = "FocalLength"
	SubjectArea                FieldName = "SubjectArea"
	FlashEnergy                FieldName = "FlashEnergy"
	SpatialFrequencyResponse   FieldName = "SpatialFrequencyResponse"
	FocalPlaneXResolution      FieldName = "FocalPlaneXResolution"
	FocalPlaneYResolution      FieldName = "FocalPlaneYResolution"
	FocalPlaneResolutionUnit   FieldName = "FocalPlaneResolutionUnit"
	SubjectLocation            FieldName = "SubjectLocation"
	ExposureIndex              FieldName = "ExposureIndex"
	SensingMethod              FieldName = "SensingMethod"
	FileSource                 FieldName = "FileSource"
	SceneType                  FieldName = "SceneType"
	CFAPattern                 FieldName = "CFAPattern"
	CustomRendered             FieldName = "CustomRendered"
	ExposureMode               FieldName = "ExposureMode"
	WhiteBalance               FieldName = "WhiteBalance"
	DigitalZoomRatio           FieldName = "DigitalZoomRatio"
	FocalLengthIn35mmFilm      FieldName = "FocalLengthIn35mmFilm"
	SceneCaptureType           FieldName = "SceneCaptureType"
	GainControl                FieldName = "GainControl"
	Contrast                   FieldName = "Contrast"
	Saturation                 FieldName = "Saturation"
	Sharpness                  FieldName = "Sharpness"
	DeviceSettingDescription   FieldName = "DeviceSettingDescription"
	SubjectDistanceRange       FieldName = "SubjectDistanceRange"
	LensMake                   FieldName = "LensMake"
	LensModel                  FieldName = "LensModel"
)

// Windows-specific tags
const (
	XPTitle    FieldName = "XPTitle"
	XPComment  FieldName = "XPComment"
	XPAuthor   FieldName = "XPAuthor"
	XPKeywords FieldName = "XPKeywords"
	XPSubject  FieldName = "XPSubject"
)

// thumbnail fields
const (
	ThumbJPEGInterchangeFormat       FieldName = "ThumbJPEGInterchangeFormat"       // offset to thumb jpeg SOI
	ThumbJPEGInterchangeFormatLength FieldName = "ThumbJPEGInterchangeFormatLength" // byte length of thumb
)

// GPS fields
const (
	GPSVersionID        FieldName = "GPSVersionID"
	GPSLatitudeRef      FieldName = "GPSLatitudeRef"
	GPSLatitude         FieldName = "GPSLatitude"
	GPSLongitudeRef     FieldName = "GPSLongitudeRef"
	GPSLongitude        FieldName = "GPSLongitude"
	GPSAltitudeRef      FieldName = "GPSAltitudeRef"
	GPSAltitude         FieldName = "GPSAltitude"
	GPSTimeStamp        FieldName = "GPSTimeStamp"
	GPSSatelites        FieldName = "GPSSatelites"
	GPSStatus           FieldName = "GPSStatus"
	GPSMeasureMode      FieldName = "GPSMeasureMode"
	GPSDOP              FieldName = "GPSDOP"
	GPSSpeedRef         FieldName = "GPSSpeedRef"
	GPSSpeed            FieldName = "GPSSpeed"
	GPSTrackRef         FieldName = "GPSTrackRef"
	GPSTrack            FieldName = "GPSTrack"
	GPSImgDirectionRef  FieldName = "GPSImgDirectionRef"
	GPSImgDirection     FieldName = "GPSImgDirection"
	GPSMapDatum         FieldName = "GPSMapDatum"
	GPSDestLatitudeRef  FieldName = "GPSDestLatitudeRef"
	GPSDestLatitude     FieldName = "GPSDestLatitude"
	GPSDestLongitudeRef FieldName = "GPSDestLongitudeRef"
	GPSDestLongitude    FieldName = "GPSDestLongitude"
	GPSDestBearingRef   FieldName = "GPSDestBearingRef"
	GPSDestBearing      FieldName = "GPSDestBearing"
	GPSDestDistanceRef  FieldName = "GPSDestDistanceRef"
	GPSDestDistance     FieldName = "GPSDestDistance"
	GPSProcessingMethod FieldName = "GPSProcessingMethod"
	GPSAreaInformation  FieldName = "GPSAreaInformation"
	GPSDateStamp        FieldName = "GPSDateStamp"
	GPSDifferential     FieldName = "GPSDifferential"
)

// interoperability fields
const (
	InteroperabilityIndex FieldName = "InteroperabilityIndex"
)

var exifFields = map[uint16]FieldName{
	/////////////////////////////////////
	////////// IFD 0 ////////////////////
	/////////////////////////////////////

	// image data structure for the thumbnail
	0x0100: ImageWidth,
	0x0101: ImageLength,
	0x0102: BitsPerSample,
	0x0103: Compression,
	0x0106: PhotometricInterpretation,
	0x0112: Orientation,
	0x0115: SamplesPerPixel,
	0x011C: PlanarConfiguration,
	0x0212: YCbCrSubSampling,
	0x0213: YCbCrPositioning,
	0x011A: XResolution,
	0x011B: YResolution,
	0x0128: ResolutionUnit,

	// Other tags
	0x0132: DateTime,
	0x010E: ImageDescription,
	0x010F: Make,
	0x0110: Model,
	0x0131: Software,
	0x013B: Artist,
	0x8298: Copyright,

	// Windows-specific tags
	0x9c9b: XPTitle,
	0x9c9c: XPComment,
	0x9c9d: XPAuthor,
	0x9c9e: XPKeywords,
	0x9c9f: XPSubject,

	// private tags
	exifPointer: ExifIFDPointer,

	/////////////////////////////////////
	////////// Exif sub IFD /////////////
	/////////////////////////////////////

	gpsPointer:     GPSInfoIFDPointer,
	interopPointer: InteroperabilityIFDPointer,

	0x9000: ExifVersion,
	0xA000: FlashpixVersion,

	0xA001: ColorSpace,

	0x9101: ComponentsConfiguration,
	0x9102: CompressedBitsPerPixel,
	0xA002: PixelXDimension,
	0xA003: PixelYDimension,

	0x927C: MakerNote,
	0x9286: UserComment,

	0xA004: RelatedSoundFile,
	0x9003: DateTimeOriginal,
	0x9004: DateTimeDigitized,
	0x9290: SubSecTime,
	0x9291: SubSecTimeOriginal,
	0x9292: SubSecTimeDigitized,

	0xA420: ImageUniqueID,

	// picture conditions
	0x829A: ExposureTime,
	0x829D: FNumber,
	0x8822: ExposureProgram,
	0x8824: SpectralSensitivity,
	0x8827: ISOSpeedRatings,
	0x8828: OECF,
	0x9201: ShutterSpeedValue,
	0x9202: ApertureValue,
	0x9203: BrightnessValue,
	0x9204: ExposureBiasValue,
	0x9205: MaxApertureValue,
	0x9206: SubjectDistance,
	0x9207: MeteringMode,
	0x9208: LightSource,
	0x9209: Flash,
	0x920A: FocalLength,
	0x9214: SubjectArea,
	0xA20B: FlashEnergy,
	0xA20C: SpatialFrequencyResponse,
	0xA20E: FocalPlaneXResolution,
	0xA20F: FocalPlaneYResolution,
	0xA210: FocalPlaneResolutionUnit,
	0xA214: SubjectLocation,
	0xA215: ExposureIndex,
	0xA217: SensingMethod,
	0xA300: FileSource,
	0xA301: SceneType,
	0xA302: CFAPattern,
	0xA401: CustomRendered,
	0xA402: ExposureMode,
	0xA403: WhiteBalance,
	0xA404: DigitalZoomRatio,
	0xA405: FocalLengthIn35mmFilm,
	0xA406: SceneCaptureType,
	0xA407: GainControl,
	0xA408: Contrast,
	0xA409: Saturation,
	0xA40A: Sharpness,
	0xA40B: DeviceSettingDescription,
	0xA40C: SubjectDistanceRange,
	0xA433: LensMake,
	0xA434: LensModel,
}

var gpsFields = map[uint16]FieldName{
	/////////////////////////////////////
	//// GPS sub-IFD ////////////////////
	/////////////////////////////////////
	0x0:  GPSVersionID,
	0x1:  GPSLatitudeRef,
	0x2:  GPSLatitude,
	0x3:  GPSLongitudeRef,
	0x4:  GPSLongitude,
	0x5:  GPSAltitudeRef,
	0x6:  GPSAltitude,
	0x7:  GPSTimeStamp,
	0x8:  GPSSatelites,
	0x9:  GPSStatus,
	0xA:  GPSMeasureMode,
	0xB:  GPSDOP,
	0xC:  GPSSpeedRef,
	0xD:  GPSSpeed,
	0xE:  GPSTrackRef,
	0xF:  GPSTrack,
	0x10: GPSImgDirectionRef,
	0x11: GPSImgDirection,
	0x12: GPSMapDatum,
	0x13: GPSDestLatitudeRef,
	0x14: GPSDestLatitude,
	0x15: GPSDestLongitudeRef,
	0x16: GPSDestLongitude,
	0x17: GPSDestBearingRef,
	0x18: GPSDestBearing,
	0x19: GPSDestDistanceRef,
	0x1A: GPSDestDistance,
	0x1B: GPSProcessingMethod,
	0x1C: GPSAreaInformation,
	0x1D: GPSDateStamp,
	0x1E: GPSDifferential,
}

var interopFields = map[uint16]FieldName{
	/////////////////////////////////////
	//// Interoperability sub-IFD ///////
	/////////////////////////////////////
	0x1: InteroperabilityIndex,
}

var thumbnailFields = map[uint16]FieldName{
	0x0201: ThumbJPEGInterchangeFormat,
	0x0202: ThumbJPEGInterchangeFormatLength,
}
