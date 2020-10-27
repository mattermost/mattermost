// +build ocr

package docconv

import (
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

var (
	exts = []string{".jpg", ".tif", ".tiff", ".png", ".pbm"}
)

func compareExt(ext string, exts []string) bool {
	for _, e := range exts {
		if ext == e {
			return true
		}
	}
	return false
}

func cleanupTemp(tmpDir string) {
	err := os.RemoveAll(tmpDir)
	if err != nil {
		log.Println(err)
	}
}

func ConvertPDFImages(path string) (BodyResult, error) {
	bodyResult := BodyResult{}

	tmp, err := ioutil.TempDir(os.TempDir(), "tmp-imgs-")
	if err != nil {
		bodyResult.err = err
		return bodyResult, err
	}
	tmpDir := fmt.Sprintf("%s/", tmp)

	defer cleanupTemp(tmpDir)

	_, err = exec.Command("pdfimages", "-j", path, tmpDir).Output()
	if err != nil {
		return bodyResult, err
	}

	filePaths := []string{}

	walkFunc := func(path string, info os.FileInfo, err error) error {
		path, err = filepath.Abs(path)
		if err != nil {
			return err
		}

		if compareExt(filepath.Ext(path), exts) {
			filePaths = append(filePaths, path)
		}
		return nil
	}
	filepath.Walk(tmpDir, walkFunc)

	fileLength := len(filePaths)

	if fileLength < 1 {
		return bodyResult, nil
	}

	var wg sync.WaitGroup

	data := make(chan string, fileLength)

	wg.Add(fileLength)

	for _, p := range filePaths {
		go func(pathFile string) {
			defer wg.Done()
			f, err := os.Open(pathFile)
			if err != nil {
				return
			}

			defer f.Close()
			out, _, err := ConvertImage(f)
			if err != nil {
				return
			}

			data <- out

		}(p)
	}

	wg.Wait()

	close(data)

	for str := range data {
		bodyResult.body += str + " "
	}

	return bodyResult, nil
}

// PdfHasImage verify if `path` (PDF) has images
func PDFHasImage(path string) bool {
	cmd := "pdffonts -l 5 %s | tail -n +3 | cut -d' ' -f1 | sort | uniq"
	out, err := exec.Command("bash", "-c", fmt.Sprintf(cmd, path)).Output()
	if err != nil {
		log.Println(err)
		return false
	}
	if string(out) == "" {
		return true
	}
	return false
}

func ConvertPDF(r io.Reader) (string, map[string]string, error) {
	f, err := NewLocalFile(r)
	if err != nil {
		return "", nil, fmt.Errorf("error creating local file: %v", err)
	}
	defer f.Done()

	bodyResult, metaResult, textConvertErr := ConvertPDFText(f.Name())
	if textConvertErr != nil {
		return "", nil, textConvertErr
	}
	if bodyResult.err != nil {
		return "", nil, bodyResult.err
	}
	if metaResult.err != nil {
		return "", nil, metaResult.err
	}

	if !PDFHasImage(f.Name()) {
		return bodyResult.body, metaResult.meta, nil
	}

	imageConvertResult, imageConvertErr := ConvertPDFImages(f.Name())
	if imageConvertErr != nil {
		log.Println(imageConvertErr)
		return bodyResult.body, metaResult.meta, nil
	}
	if imageConvertResult.err != nil {
		log.Println(imageConvertResult.err)
		return bodyResult.body, metaResult.meta, nil
	}

	fullBody := strings.Join([]string{bodyResult.body, imageConvertResult.body}, " ")

	return fullBody, metaResult.meta, nil

}
