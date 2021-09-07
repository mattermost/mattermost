package gosseract

// #if __FreeBSD__ >= 10
// #cgo LDFLAGS: -L/usr/local/lib -llept -ltesseract
// #else
// #cgo CXXFLAGS: -std=c++0x
// #cgo LDFLAGS: -llept -ltesseract
// #cgo CPPFLAGS: -Wno-unused-result
// #endif
// #include <stdlib.h>
// #include <stdbool.h>
// #include "tessbridge.h"
import "C"
import (
	"fmt"
	"image"
	"os"
	"path/filepath"
	"strings"
	"unsafe"
)

// Version returns the version of Tesseract-OCR
func Version() string {
	api := C.Create()
	defer C.Free(api)
	version := C.Version(api)
	return C.GoString(version)
}

// ClearPersistentCache clears any library-level memory caches. There are a variety of expensive-to-load constant data structures (mostly language dictionaries) that are cached globally – surviving the Init() and End() of individual TessBaseAPI's. This function allows the clearing of these caches.
func ClearPersistentCache() {
	api := C.Create()
	defer C.Free(api)
	C.ClearPersistentCache(api)
}

// Client is argument builder for tesseract::TessBaseAPI.
type Client struct {
	api C.TessBaseAPI

	// Holds a reference to the pix image to be able to destroy on client close
	// or when a new image is set
	pixImage C.PixImage

	// Trim specifies characters to trim, which would be trimed from result string.
	// As results of OCR, text often contains unnecessary characters, such as newlines, on the head/foot of string.
	// If `Trim` is set, this client will remove specified characters from the result.
	Trim bool

	// TessdataPrefix can indicate directory path to `tessdata`.
	// It is set `/usr/local/share/tessdata/` or something like that, as default.
	// TODO: Implement and test
	TessdataPrefix string

	// Languages are languages to be detected. If not specified, it's gonna be "eng".
	Languages []string

	// Variables is just a pool to evaluate "tesseract::TessBaseAPI->SetVariable" in delay.
	// TODO: Think if it should be public, or private property.
	Variables map[SettableVariable]string

	// Config is a file path to the configuration for Tesseract
	// See http://www.sk-spell.sk.cx/tesseract-ocr-parameters-in-302-version
	// TODO: Fix link to official page
	ConfigFilePath string

	// internal flag to check if the instance should be initialized again
	// i.e, we should create a new gosseract client when language or config file change
	shouldInit bool
}

// NewClient construct new Client. It's due to caller to Close this client.
func NewClient() *Client {
	client := &Client{
		api:        C.Create(),
		Variables:  map[SettableVariable]string{},
		Trim:       true,
		shouldInit: true,
	}
	return client
}

// Close frees allocated API. This MUST be called for ANY client constructed by "NewClient" function.
func (client *Client) Close() (err error) {
	// defer func() {
	// 	if e := recover(); e != nil {
	// 		err = fmt.Errorf("%v", e)
	// 	}
	// }()
	C.Clear(client.api)
	C.Free(client.api)
	if client.pixImage != nil {
		C.DestroyPixImage(client.pixImage)
		client.pixImage = nil
	}
	return err
}

// Version provides the version of Tesseract used by this client.
func (client *Client) Version() string {
	version := C.Version(client.api)
	return C.GoString(version)
}

// SetImage sets path to image file to be processed OCR.
func (client *Client) SetImage(imagepath string) error {

	if client.api == nil {
		return fmt.Errorf("TessBaseAPI is not constructed, please use `gosseract.NewClient`")
	}
	if imagepath == "" {
		return fmt.Errorf("image path cannot be empty")
	}
	if _, err := os.Stat(imagepath); err != nil {
		return fmt.Errorf("cannot detect the stat of specified file: %v", err)
	}

	if client.pixImage != nil {
		C.DestroyPixImage(client.pixImage)
		client.pixImage = nil
	}

	p := C.CString(imagepath)
	defer C.free(unsafe.Pointer(p))

	img := C.CreatePixImageByFilePath(p)
	client.pixImage = img

	return nil
}

// SetImageFromBytes sets the image data to be processed OCR.
func (client *Client) SetImageFromBytes(data []byte) error {

	if client.api == nil {
		return fmt.Errorf("TessBaseAPI is not constructed, please use `gosseract.NewClient`")
	}
	if len(data) == 0 {
		return fmt.Errorf("image data cannot be empty")
	}

	if client.pixImage != nil {
		C.DestroyPixImage(client.pixImage)
		client.pixImage = nil
	}

	img := C.CreatePixImageFromBytes((*C.uchar)(unsafe.Pointer(&data[0])), C.int(len(data)))
	client.pixImage = img

	return nil
}

// SetLanguage sets languages to use. English as default.
func (client *Client) SetLanguage(langs ...string) error {
	if len(langs) == 0 {
		return fmt.Errorf("languages cannot be empty")
	}

	client.Languages = langs

	client.flagForInit()

	return nil
}

// DisableOutput ...
func (client *Client) DisableOutput() error {
	err := client.SetVariable(DEBUG_FILE, os.DevNull)

	client.setVariablesToInitializedAPIIfNeeded()

	return err
}

// SetWhitelist sets whitelist chars.
// See official documentation for whitelist here https://github.com/tesseract-ocr/tesseract/wiki/ImproveQuality#dictionaries-word-lists-and-patterns
func (client *Client) SetWhitelist(whitelist string) error {
	err := client.SetVariable(TESSEDIT_CHAR_WHITELIST, whitelist)

	client.setVariablesToInitializedAPIIfNeeded()

	return err
}

// SetBlacklist sets blacklist chars.
// See official documentation for blacklist here https://github.com/tesseract-ocr/tesseract/wiki/ImproveQuality#dictionaries-word-lists-and-patterns
func (client *Client) SetBlacklist(blacklist string) error {
	err := client.SetVariable(TESSEDIT_CHAR_BLACKLIST, blacklist)

	client.setVariablesToInitializedAPIIfNeeded()

	return err
}

// SetVariable sets parameters, representing tesseract::TessBaseAPI->SetVariable.
// See official documentation here https://zdenop.github.io/tesseract-doc/classtesseract_1_1_tess_base_a_p_i.html#a2e09259c558c6d8e0f7e523cbaf5adf5
// Because `api->SetVariable` must be called after `api->Init`, this method cannot detect unexpected key for variables.
// Check `client.setVariablesToInitializedAPI` for more information.
func (client *Client) SetVariable(key SettableVariable, value string) error {
	client.Variables[key] = value

	client.setVariablesToInitializedAPIIfNeeded()

	return nil
}

// SetPageSegMode sets "Page Segmentation Mode" (PSM) to detect layout of characters.
// See official documentation for PSM here https://github.com/tesseract-ocr/tesseract/wiki/ImproveQuality#page-segmentation-method
// See https://github.com/otiai10/gosseract/issues/52 for more information.
func (client *Client) SetPageSegMode(mode PageSegMode) error {
	C.SetPageSegMode(client.api, C.int(mode))
	return nil
}

// SetConfigFile sets the file path to config file.
func (client *Client) SetConfigFile(fpath string) error {
	info, err := os.Stat(fpath)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("the specified config file path seems to be a directory")
	}
	client.ConfigFilePath = fpath

	client.flagForInit()

	return nil
}

// SetTessdataPrefix sets path to the models directory.
// Environment variable TESSDATA_PREFIX is used as default.
func (client *Client) SetTessdataPrefix(prefix string) error {
	if prefix == "" {
		return fmt.Errorf("tessdata prefix could not be empty")
	}
	client.TessdataPrefix = prefix
	client.flagForInit()
	return nil
}

// Initialize tesseract::TessBaseAPI
func (client *Client) init() error {

	if !client.shouldInit {
		C.SetPixImage(client.api, client.pixImage)
		return nil
	}

	var languages *C.char
	if len(client.Languages) != 0 {
		languages = C.CString(strings.Join(client.Languages, "+"))
	}
	defer C.free(unsafe.Pointer(languages))

	var configfile *C.char
	if _, err := os.Stat(client.ConfigFilePath); err == nil {
		configfile = C.CString(client.ConfigFilePath)
	}
	defer C.free(unsafe.Pointer(configfile))

	var tessdataPrefix *C.char
	if client.TessdataPrefix != "" {
		tessdataPrefix = C.CString(client.TessdataPrefix)
	}
	defer C.free(unsafe.Pointer(tessdataPrefix))

	errbuf := [512]C.char{}
	res := C.Init(client.api, tessdataPrefix, languages, configfile, &errbuf[0])
	msg := C.GoString(&errbuf[0])

	if res != 0 {
		return fmt.Errorf("failed to initialize TessBaseAPI with code %d: %s", res, msg)
	}

	if err := client.setVariablesToInitializedAPI(); err != nil {
		return err
	}

	if client.pixImage == nil {
		return fmt.Errorf("PixImage is not set, use SetImage or SetImageFromBytes before Text or HOCRText")
	}

	C.SetPixImage(client.api, client.pixImage)

	client.shouldInit = false

	return nil
}

// This method flag the current instance to be initialized again on the next call to a function that
// requires a gosseract API initialized: when user change the config file or the languages
// the instance needs to init a new gosseract api
func (client *Client) flagForInit() {
	client.shouldInit = true
}

// This method sets all the sspecified variables to TessBaseAPI structure.
// Because `api->SetVariable` must be called after `api->Init()`,
// gosseract.Client.SetVariable cannot call `api->SetVariable` directly.
// See https://zdenop.github.io/tesseract-doc/classtesseract_1_1_tess_base_a_p_i.html#a2e09259c558c6d8e0f7e523cbaf5adf5
func (client *Client) setVariablesToInitializedAPI() error {
	for key, value := range client.Variables {
		k, v := C.CString(string(key)), C.CString(value)
		defer C.free(unsafe.Pointer(k))
		defer C.free(unsafe.Pointer(v))
		res := C.SetVariable(client.api, k, v)
		if !bool(res) {
			return fmt.Errorf("failed to set variable with key(%v) and value(%v)", key, value)
		}
	}
	return nil
}

// Call setVariablesToInitializedAPI only if the API is initialized
// it is useful to call when changing variables that does not requires
// to init a new tesseract instance. Otherwise it is better to just flag
// the instance for re-init (Client.flagForInit())
func (client *Client) setVariablesToInitializedAPIIfNeeded() error {
	if !client.shouldInit {
		return client.setVariablesToInitializedAPI()
	}

	return nil
}

// Text finally initialize tesseract::TessBaseAPI, execute OCR and extract text detected as string.
func (client *Client) Text() (out string, err error) {
	if err = client.init(); err != nil {
		return
	}
	out = C.GoString(C.UTF8Text(client.api))
	if client.Trim {
		out = strings.Trim(out, "\n")
	}
	return out, err
}

// HOCRText finally initialize tesseract::TessBaseAPI, execute OCR and returns hOCR text.
// See https://en.wikipedia.org/wiki/HOCR for more information of hOCR.
func (client *Client) HOCRText() (out string, err error) {
	if err = client.init(); err != nil {
		return
	}
	out = C.GoString(C.HOCRText(client.api))
	return
}

// BoundingBox contains the position, confidence and UTF8 text of the recognized word
type BoundingBox struct {
	Box                                image.Rectangle
	Word                               string
	Confidence                         float64
	BlockNum, ParNum, LineNum, WordNum int
}

// GetBoundingBoxes returns bounding boxes for each matched word
func (client *Client) GetBoundingBoxes(level PageIteratorLevel) (out []BoundingBox, err error) {
	if client.api == nil {
		return out, fmt.Errorf("TessBaseAPI is not constructed, please use `gosseract.NewClient`")
	}
	if err = client.init(); err != nil {
		return
	}
	boxArray := C.GetBoundingBoxes(client.api, C.int(level))
	length := int(boxArray.length)
	defer C.free(unsafe.Pointer(boxArray.boxes))
	defer C.free(unsafe.Pointer(boxArray))
	out = make([]BoundingBox, 0, length)
	for i := 0; i < length; i++ {
		// cast to bounding_box: boxes + i*sizeof(box)
		box := (*C.struct_bounding_box)(unsafe.Pointer(uintptr(unsafe.Pointer(boxArray.boxes)) + uintptr(i)*unsafe.Sizeof(C.struct_bounding_box{})))
		out = append(out, BoundingBox{
			Box:        image.Rect(int(box.x1), int(box.y1), int(box.x2), int(box.y2)),
			Word:       C.GoString(box.word),
			Confidence: float64(box.confidence),
		})
	}

	return
}

// GetAvailableLanguages returns a list of available languages in the default tesspath
func GetAvailableLanguages() ([]string, error) {
	languages, err := filepath.Glob(filepath.Join(getDataPath(), "*.traineddata"))
	if err != nil {
		return languages, err
	}
	for i := 0; i < len(languages); i++ {
		languages[i] = filepath.Base(languages[i])
		idx := strings.Index(languages[i], ".")
		languages[i] = languages[i][:idx]
	}
	return languages, nil
}

// GetBoundingBoxesVerbose returns bounding boxes at word level with block_num, par_num, line_num and word_num
// according to the c++ api that returns a formatted TSV output. Reference: `TessBaseAPI::GetTSVText`.
func (client *Client) GetBoundingBoxesVerbose() (out []BoundingBox, err error) {
	if client.api == nil {
		return out, fmt.Errorf("TessBaseAPI is not constructed, please use `gosseract.NewClient`")
	}
	if err = client.init(); err != nil {
		return
	}
	boxArray := C.GetBoundingBoxesVerbose(client.api)
	length := int(boxArray.length)
	defer C.free(unsafe.Pointer(boxArray.boxes))
	defer C.free(unsafe.Pointer(boxArray))
	out = make([]BoundingBox, 0, length)
	for i := 0; i < length; i++ {
		// cast to bounding_box: boxes + i*sizeof(box)
		box := (*C.struct_bounding_box)(unsafe.Pointer(uintptr(unsafe.Pointer(boxArray.boxes)) + uintptr(i)*unsafe.Sizeof(C.struct_bounding_box{})))
		out = append(out, BoundingBox{
			Box:        image.Rect(int(box.x1), int(box.y1), int(box.x2), int(box.y2)),
			Word:       C.GoString(box.word),
			Confidence: float64(box.confidence),
			BlockNum:   int(box.block_num),
			ParNum:     int(box.par_num),
			LineNum:    int(box.line_num),
			WordNum:    int(box.word_num),
		})
	}
	return
}

// getDataPath is useful hepler to determine where current tesseract
// installation stores trained models
func getDataPath() string {
	return C.GoString(C.GetDataPath())
}
