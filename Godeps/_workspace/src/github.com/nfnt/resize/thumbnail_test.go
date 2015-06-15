package resize

import (
	"image"
	"runtime"
	"testing"
)

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
}

var thumbnailTests = []struct {
	origWidth      int
	origHeight     int
	maxWidth       uint
	maxHeight      uint
	expectedWidth  uint
	expectedHeight uint
}{
	{5, 5, 10, 10, 5, 5},
	{10, 10, 5, 5, 5, 5},
	{10, 50, 10, 10, 2, 10},
	{50, 10, 10, 10, 10, 2},
	{50, 100, 60, 90, 45, 90},
	{120, 100, 60, 90, 60, 50},
	{200, 250, 200, 150, 120, 150},
}

func TestThumbnail(t *testing.T) {
	for i, tt := range thumbnailTests {
		img := image.NewGray16(image.Rect(0, 0, tt.origWidth, tt.origHeight))

		outImg := Thumbnail(tt.maxWidth, tt.maxHeight, img, NearestNeighbor)

		newWidth := uint(outImg.Bounds().Dx())
		newHeight := uint(outImg.Bounds().Dy())
		if newWidth != tt.expectedWidth ||
			newHeight != tt.expectedHeight {
			t.Errorf("%d. Thumbnail(%v, %v, img, NearestNeighbor) => "+
				"width: %v, height: %v, want width: %v, height: %v",
				i, tt.maxWidth, tt.maxHeight,
				newWidth, newHeight, tt.expectedWidth, tt.expectedHeight,
			)
		}
	}
}
