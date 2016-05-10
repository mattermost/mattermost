package exif

type FieldName string

// UnknownPrefix is used as the first part of field names for decoded tags for
// which there is no known/supported EXIF field.
const UnknownPrefix = "UnknownTag_"

// Primary EXIF fields
const (
	ImageWidth                 FieldName = "ImageWidth"
	ImageLength                          = "ImageLength" // Image height called Length by EXIF spec
	BitsPerSample                        = "BitsPerSample"
	Compression                          = "Compression"
	PhotometricInterpretation            = "PhotometricInterpretation"
	Orientation                          = "Orientation"
	SamplesPerPixel                      = "SamplesPerPixel"
	PlanarConfiguration                  = "PlanarConfiguration"
	YCbCrSubSampling                     = "YCbCrSubSampling"
	YCbCrPositioning                     = "YCbCrPositioning"
	XResolution                          = "XResolution"
	YResolution                          = "YResolution"
	ResolutionUnit                       = "ResolutionUnit"
	DateTime                             = "DateTime"
	ImageDescription                     = "ImageDescription"
	Make                                 = "Make"
	Model                                = "Model"
	Software                             = "Software"
	Artist                               = "Artist"
	Copyright                            = "Copyright"
	ExifIFDPointer                       = "ExifIFDPointer"
	GPSInfoIFDPointer                    = "GPSInfoIFDPointer"
	InteroperabilityIFDPointer           = "InteroperabilityIFDPointer"
	ExifVersion                          = "ExifVersion"
	FlashpixVersion                      = "FlashpixVersion"
	ColorSpace                           = "ColorSpace"
	ComponentsConfiguration              = "ComponentsConfiguration"
	CompressedBitsPerPixel               = "CompressedBitsPerPixel"
	PixelXDimension                      = "PixelXDimension"
	PixelYDimension                      = "PixelYDimension"
	MakerNote                            = "MakerNote"
	UserComment                          = "UserComment"
	RelatedSoundFile                     = "RelatedSoundFile"
	DateTimeOriginal                     = "DateTimeOriginal"
	DateTimeDigitized                    = "DateTimeDigitized"
	SubSecTime                           = "SubSecTime"
	SubSecTimeOriginal                   = "SubSecTimeOriginal"
	SubSecTimeDigitized                  = "SubSecTimeDigitized"
	ImageUniqueID                        = "ImageUniqueID"
	ExposureTime                         = "ExposureTime"
	FNumber                              = "FNumber"
	ExposureProgram                      = "ExposureProgram"
	SpectralSensitivity                  = "SpectralSensitivity"
	ISOSpeedRatings                      = "ISOSpeedRatings"
	OECF                                 = "OECF"
	ShutterSpeedValue                    = "ShutterSpeedValue"
	ApertureValue                        = "ApertureValue"
	BrightnessValue                      = "BrightnessValue"
	ExposureBiasValue                    = "ExposureBiasValue"
	MaxApertureValue                     = "MaxApertureValue"
	SubjectDistance                      = "SubjectDistance"
	MeteringMode                         = "MeteringMode"
	LightSource                          = "LightSource"
	Flash                                = "Flash"
	FocalLength                          = "FocalLength"
	SubjectArea                          = "SubjectArea"
	FlashEnergy                          = "FlashEnergy"
	SpatialFrequencyResponse             = "SpatialFrequencyResponse"
	FocalPlaneXResolution                = "FocalPlaneXResolution"
	FocalPlaneYResolution                = "FocalPlaneYResolution"
	FocalPlaneResolutionUnit             = "FocalPlaneResolutionUnit"
	SubjectLocation                      = "SubjectLocation"
	ExposureIndex                        = "ExposureIndex"
	SensingMethod                        = "SensingMethod"
	FileSource                           = "FileSource"
	SceneType                            = "SceneType"
	CFAPattern                           = "CFAPattern"
	CustomRendered                       = "CustomRendered"
	ExposureMode                         = "ExposureMode"
	WhiteBalance                         = "WhiteBalance"
	DigitalZoomRatio                     = "DigitalZoomRatio"
	FocalLengthIn35mmFilm                = "FocalLengthIn35mmFilm"
	SceneCaptureType                     = "SceneCaptureType"
	GainControl                          = "GainControl"
	Contrast                             = "Contrast"
	Saturation                           = "Saturation"
	Sharpness                            = "Sharpness"
	DeviceSettingDescription             = "DeviceSettingDescription"
	SubjectDistanceRange                 = "SubjectDistanceRange"
	LensMake                             = "LensMake"
	LensModel                            = "LensModel"
)

// thumbnail fields
const (
	ThumbJPEGInterchangeFormat       = "ThumbJPEGInterchangeFormat"       // offset to thumb jpeg SOI
	ThumbJPEGInterchangeFormatLength = "ThumbJPEGInterchangeFormatLength" // byte length of thumb
)

// GPS fields
const (
	GPSVersionID        FieldName = "GPSVersionID"
	GPSLatitudeRef                = "GPSLatitudeRef"
	GPSLatitude                   = "GPSLatitude"
	GPSLongitudeRef               = "GPSLongitudeRef"
	GPSLongitude                  = "GPSLongitude"
	GPSAltitudeRef                = "GPSAltitudeRef"
	GPSAltitude                   = "GPSAltitude"
	GPSTimeStamp                  = "GPSTimeStamp"
	GPSSatelites                  = "GPSSatelites"
	GPSStatus                     = "GPSStatus"
	GPSMeasureMode                = "GPSMeasureMode"
	GPSDOP                        = "GPSDOP"
	GPSSpeedRef                   = "GPSSpeedRef"
	GPSSpeed                      = "GPSSpeed"
	GPSTrackRef                   = "GPSTrackRef"
	GPSTrack                      = "GPSTrack"
	GPSImgDirectionRef            = "GPSImgDirectionRef"
	GPSImgDirection               = "GPSImgDirection"
	GPSMapDatum                   = "GPSMapDatum"
	GPSDestLatitudeRef            = "GPSDestLatitudeRef"
	GPSDestLatitude               = "GPSDestLatitude"
	GPSDestLongitudeRef           = "GPSDestLongitudeRef"
	GPSDestLongitude              = "GPSDestLongitude"
	GPSDestBearingRef             = "GPSDestBearingRef"
	GPSDestBearing                = "GPSDestBearing"
	GPSDestDistanceRef            = "GPSDestDistanceRef"
	GPSDestDistance               = "GPSDestDistance"
	GPSProcessingMethod           = "GPSProcessingMethod"
	GPSAreaInformation            = "GPSAreaInformation"
	GPSDateStamp                  = "GPSDateStamp"
	GPSDifferential               = "GPSDifferential"
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
