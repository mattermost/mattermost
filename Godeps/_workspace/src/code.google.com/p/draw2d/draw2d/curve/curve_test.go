package curve

import (
	"bufio"
	"code.google.com/p/draw2d/draw2d/raster"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"log"
	"os"
	"testing"
)

var (
	flattening_threshold float64 = 0.5
	testsCubicFloat64            = []CubicCurveFloat64{
		CubicCurveFloat64{100, 100, 200, 100, 100, 200, 200, 200},
		CubicCurveFloat64{100, 100, 300, 200, 200, 200, 300, 100},
		CubicCurveFloat64{100, 100, 0, 300, 200, 0, 300, 300},
		CubicCurveFloat64{150, 290, 10, 10, 290, 10, 150, 290},
		CubicCurveFloat64{10, 290, 10, 10, 290, 10, 290, 290},
		CubicCurveFloat64{100, 290, 290, 10, 10, 10, 200, 290},
	}
	testsQuadFloat64 = []QuadCurveFloat64{
		QuadCurveFloat64{100, 100, 200, 100, 200, 200},
		QuadCurveFloat64{100, 100, 290, 200, 290, 100},
		QuadCurveFloat64{100, 100, 0, 290, 200, 290},
		QuadCurveFloat64{150, 290, 10, 10, 290, 290},
		QuadCurveFloat64{10, 290, 10, 10, 290, 290},
		QuadCurveFloat64{100, 290, 290, 10, 120, 290},
	}
)

type Path struct {
	points []float64
}

func (p *Path) LineTo(x, y float64) {
	if len(p.points)+2 > cap(p.points) {
		points := make([]float64, len(p.points)+2, len(p.points)+32)
		copy(points, p.points)
		p.points = points
	} else {
		p.points = p.points[0 : len(p.points)+2]
	}
	p.points[len(p.points)-2] = x
	p.points[len(p.points)-1] = y
}

func init() {
	f, err := os.Create("_test.html")
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	defer f.Close()
	log.Printf("Create html viewer")
	f.Write([]byte("<html><body>"))
	for i := 0; i < len(testsCubicFloat64); i++ {
		f.Write([]byte(fmt.Sprintf("<div><img src='_testRec%d.png'/>\n<img src='_test%d.png'/>\n<img src='_testAdaptiveRec%d.png'/>\n<img src='_testAdaptive%d.png'/>\n<img src='_testParabolic%d.png'/>\n</div>\n", i, i, i, i, i)))
	}
	for i := 0; i < len(testsQuadFloat64); i++ {
		f.Write([]byte(fmt.Sprintf("<div><img src='_testQuad%d.png'/>\n</div>\n", i)))
	}
	f.Write([]byte("</body></html>"))

}

func savepng(filePath string, m image.Image) {
	f, err := os.Create(filePath)
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	defer f.Close()
	b := bufio.NewWriter(f)
	err = png.Encode(b, m)
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	err = b.Flush()
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
}

func drawPoints(img draw.Image, c color.Color, s ...float64) image.Image {
	/*for i := 0; i < len(s); i += 2 {
		x, y := int(s[i]+0.5), int(s[i+1]+0.5)
		img.Set(x, y, c)
		img.Set(x, y+1, c)
		img.Set(x, y-1, c)
		img.Set(x+1, y, c)
		img.Set(x+1, y+1, c)
		img.Set(x+1, y-1, c)
		img.Set(x-1, y, c)
		img.Set(x-1, y+1, c)
		img.Set(x-1, y-1, c)

	}*/
	return img
}

func TestCubicCurveRec(t *testing.T) {
	for i, curve := range testsCubicFloat64 {
		var p Path
		p.LineTo(curve[0], curve[1])
		curve.SegmentRec(&p, flattening_threshold)
		img := image.NewNRGBA(image.Rect(0, 0, 300, 300))
		raster.PolylineBresenham(img, color.NRGBA{0xff, 0, 0, 0xff}, curve[:]...)
		raster.PolylineBresenham(img, image.Black, p.points...)
		//drawPoints(img, image.NRGBAColor{0, 0, 0, 0xff}, curve[:]...)
		drawPoints(img, color.NRGBA{0, 0, 0, 0xff}, p.points...)
		savepng(fmt.Sprintf("_testRec%d.png", i), img)
		log.Printf("Num of points: %d\n", len(p.points))
	}
	fmt.Println()
}

func TestCubicCurve(t *testing.T) {
	for i, curve := range testsCubicFloat64 {
		var p Path
		p.LineTo(curve[0], curve[1])
		curve.Segment(&p, flattening_threshold)
		img := image.NewNRGBA(image.Rect(0, 0, 300, 300))
		raster.PolylineBresenham(img, color.NRGBA{0xff, 0, 0, 0xff}, curve[:]...)
		raster.PolylineBresenham(img, image.Black, p.points...)
		//drawPoints(img, image.NRGBAColor{0, 0, 0, 0xff}, curve[:]...)
		drawPoints(img, color.NRGBA{0, 0, 0, 0xff}, p.points...)
		savepng(fmt.Sprintf("_test%d.png", i), img)
		log.Printf("Num of points: %d\n", len(p.points))
	}
	fmt.Println()
}

func TestCubicCurveAdaptiveRec(t *testing.T) {
	for i, curve := range testsCubicFloat64 {
		var p Path
		p.LineTo(curve[0], curve[1])
		curve.AdaptiveSegmentRec(&p, 1, 0, 0)
		img := image.NewNRGBA(image.Rect(0, 0, 300, 300))
		raster.PolylineBresenham(img, color.NRGBA{0xff, 0, 0, 0xff}, curve[:]...)
		raster.PolylineBresenham(img, image.Black, p.points...)
		//drawPoints(img, image.NRGBAColor{0, 0, 0, 0xff}, curve[:]...)
		drawPoints(img, color.NRGBA{0, 0, 0, 0xff}, p.points...)
		savepng(fmt.Sprintf("_testAdaptiveRec%d.png", i), img)
		log.Printf("Num of points: %d\n", len(p.points))
	}
	fmt.Println()
}

func TestCubicCurveAdaptive(t *testing.T) {
	for i, curve := range testsCubicFloat64 {
		var p Path
		p.LineTo(curve[0], curve[1])
		curve.AdaptiveSegment(&p, 1, 0, 0)
		img := image.NewNRGBA(image.Rect(0, 0, 300, 300))
		raster.PolylineBresenham(img, color.NRGBA{0xff, 0, 0, 0xff}, curve[:]...)
		raster.PolylineBresenham(img, image.Black, p.points...)
		//drawPoints(img, image.NRGBAColor{0, 0, 0, 0xff}, curve[:]...)
		drawPoints(img, color.NRGBA{0, 0, 0, 0xff}, p.points...)
		savepng(fmt.Sprintf("_testAdaptive%d.png", i), img)
		log.Printf("Num of points: %d\n", len(p.points))
	}
	fmt.Println()
}

func TestCubicCurveParabolic(t *testing.T) {
	for i, curve := range testsCubicFloat64 {
		var p Path
		p.LineTo(curve[0], curve[1])
		curve.ParabolicSegment(&p, flattening_threshold)
		img := image.NewNRGBA(image.Rect(0, 0, 300, 300))
		raster.PolylineBresenham(img, color.NRGBA{0xff, 0, 0, 0xff}, curve[:]...)
		raster.PolylineBresenham(img, image.Black, p.points...)
		//drawPoints(img, image.NRGBAColor{0, 0, 0, 0xff}, curve[:]...)
		drawPoints(img, color.NRGBA{0, 0, 0, 0xff}, p.points...)
		savepng(fmt.Sprintf("_testParabolic%d.png", i), img)
		log.Printf("Num of points: %d\n", len(p.points))
	}
	fmt.Println()
}

func TestQuadCurve(t *testing.T) {
	for i, curve := range testsQuadFloat64 {
		var p Path
		p.LineTo(curve[0], curve[1])
		curve.Segment(&p, flattening_threshold)
		img := image.NewNRGBA(image.Rect(0, 0, 300, 300))
		raster.PolylineBresenham(img, color.NRGBA{0xff, 0, 0, 0xff}, curve[:]...)
		raster.PolylineBresenham(img, image.Black, p.points...)
		//drawPoints(img, image.NRGBAColor{0, 0, 0, 0xff}, curve[:]...)
		drawPoints(img, color.NRGBA{0, 0, 0, 0xff}, p.points...)
		savepng(fmt.Sprintf("_testQuad%d.png", i), img)
		log.Printf("Num of points: %d\n", len(p.points))
	}
	fmt.Println()
}

func BenchmarkCubicCurveRec(b *testing.B) {
	for i := 0; i < b.N; i++ {
		for _, curve := range testsCubicFloat64 {
			p := Path{make([]float64, 0, 32)}
			p.LineTo(curve[0], curve[1])
			curve.SegmentRec(&p, flattening_threshold)
		}
	}
}

func BenchmarkCubicCurve(b *testing.B) {
	for i := 0; i < b.N; i++ {
		for _, curve := range testsCubicFloat64 {
			p := Path{make([]float64, 0, 32)}
			p.LineTo(curve[0], curve[1])
			curve.Segment(&p, flattening_threshold)
		}
	}
}

func BenchmarkCubicCurveAdaptiveRec(b *testing.B) {
	for i := 0; i < b.N; i++ {
		for _, curve := range testsCubicFloat64 {
			p := Path{make([]float64, 0, 32)}
			p.LineTo(curve[0], curve[1])
			curve.AdaptiveSegmentRec(&p, 1, 0, 0)
		}
	}
}

func BenchmarkCubicCurveAdaptive(b *testing.B) {
	for i := 0; i < b.N; i++ {
		for _, curve := range testsCubicFloat64 {
			p := Path{make([]float64, 0, 32)}
			p.LineTo(curve[0], curve[1])
			curve.AdaptiveSegment(&p, 1, 0, 0)
		}
	}
}

func BenchmarkCubicCurveParabolic(b *testing.B) {
	for i := 0; i < b.N; i++ {
		for _, curve := range testsCubicFloat64 {
			p := Path{make([]float64, 0, 32)}
			p.LineTo(curve[0], curve[1])
			curve.ParabolicSegment(&p, flattening_threshold)
		}
	}
}

func BenchmarkQuadCurve(b *testing.B) {
	for i := 0; i < b.N; i++ {
		for _, curve := range testsQuadFloat64 {
			p := Path{make([]float64, 0, 32)}
			p.LineTo(curve[0], curve[1])
			curve.Segment(&p, flattening_threshold)
		}
	}
}
