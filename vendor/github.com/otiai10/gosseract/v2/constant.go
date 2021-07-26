package gosseract

// PageSegMode represents tesseract::PageSegMode.
// See https://github.com/tesseract-ocr/tesseract/wiki/ImproveQuality#page-segmentation-method and
// https://github.com/tesseract-ocr/tesseract/blob/a18620cfea33d03032b71fe1b9fc424777e34252/ccstruct/publictypes.h#L158-L183 for more information.
type PageSegMode int

const (
	// PSM_OSD_ONLY - Orientation and script detection (OSD) only.
	PSM_OSD_ONLY PageSegMode = iota
	// PSM_AUTO_OSD - Automatic page segmentation with OSD.
	PSM_AUTO_OSD
	// PSM_AUTO_ONLY - Automatic page segmentation, but no OSD, or OCR.
	PSM_AUTO_ONLY
	// PSM_AUTO - (DEFAULT) Fully automatic page segmentation, but no OSD.
	PSM_AUTO
	// PSM_SINGLE_COLUMN - Assume a single column of text of variable sizes.
	PSM_SINGLE_COLUMN
	// PSM_SINGLE_BLOCK_VERT_TEXT - Assume a single uniform block of vertically aligned text.
	PSM_SINGLE_BLOCK_VERT_TEXT
	// PSM_SINGLE_BLOCK - Assume a single uniform block of text.
	PSM_SINGLE_BLOCK
	// PSM_SINGLE_LINE - Treat the image as a single text line.
	PSM_SINGLE_LINE
	// PSM_SINGLE_WORD - Treat the image as a single word.
	PSM_SINGLE_WORD
	// PSM_CIRCLE_WORD - Treat the image as a single word in a circle.
	PSM_CIRCLE_WORD
	// PSM_SINGLE_CHAR - Treat the image as a single character.
	PSM_SINGLE_CHAR
	// PSM_SPARSE_TEXT - Find as much text as possible in no particular order.
	PSM_SPARSE_TEXT
	// PSM_SPARSE_TEXT_OSD - Sparse text with orientation and script det.
	PSM_SPARSE_TEXT_OSD
	// PSM_RAW_LINE - Treat the image as a single text line, bypassing hacks that are Tesseract-specific.
	PSM_RAW_LINE

	// PSM_COUNT - Just a number of enum entries. This is NOT a member of PSM ;)
	PSM_COUNT
)

// PageIteratorLevel maps directly to tesseracts enum tesseract::PageIteratorLevel
// represents the hierarchy of the page elements used in ResultIterator.
// https://github.com/tesseract-ocr/tesseract/blob/a18620cfea33d03032b71fe1b9fc424777e34252/ccstruct/publictypes.h#L219-L225
type PageIteratorLevel int

const (
	// RIL_BLOCK - Block of text/image/separator line.
	RIL_BLOCK PageIteratorLevel = iota
	// RIL_PARA - Paragraph within a block.
	RIL_PARA
	// RIL_TEXTLINE - Line within a paragraph.
	RIL_TEXTLINE
	// RIL_WORD - Word within a textline.
	RIL_WORD
	// RIL_SYMBOL - Symbol/character within a word.
	RIL_SYMBOL
)

// SettableVariable represents available strings for TessBaseAPI::SetVariable.
// See https://groups.google.com/forum/#!topic/tesseract-ocr/eHTBzrBiwvQ
// and https://github.com/tesseract-ocr/tesseract/blob/master/src/ccmain/tesseractclass.h
type SettableVariable string

// Followings are variables which can be used for TessBaseAPI::SetVariable.
// If anything missing (I know there are many), please add one below.
const (
	// DEBUG_FILE - File to send output to.
	DEBUG_FILE SettableVariable = "debug_file"
	// TESSEDIT_CHAR_WHITELIST - Whitelist of chars to recognize
	// There is a known issue in 4.00 with LSTM
	// https://github.com/tesseract-ocr/tesseract/issues/751
	TESSEDIT_CHAR_WHITELIST SettableVariable = "tessedit_char_whitelist"
	// TESSEDIT_CHAR_BLACKLIST - Blacklist of chars not to recognize
	// There is a known issue in 4.00 with LSTM
	// https://github.com/tesseract-ocr/tesseract/issues/751
	TESSEDIT_CHAR_BLACKLIST SettableVariable = "tessedit_char_blacklist"
)
