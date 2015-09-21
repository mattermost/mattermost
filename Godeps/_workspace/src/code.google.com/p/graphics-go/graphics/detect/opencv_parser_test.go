// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"image"
	"os"
	"reflect"
	"testing"
)

var (
	classifier0 = Classifier{
		Feature: []Feature{
			Feature{Rect: image.Rect(0, 0, 3, 4), Weight: -1},
			Feature{Rect: image.Rect(3, 4, 5, 6), Weight: 3.1},
		},
		Threshold: 0.03,
		Left:      0.01,
		Right:     0.8,
	}
	classifier1 = Classifier{
		Feature: []Feature{
			Feature{Rect: image.Rect(3, 7, 17, 11), Weight: -3.2},
			Feature{Rect: image.Rect(3, 9, 17, 11), Weight: 2.},
		},
		Threshold: 0.11,
		Left:      0.03,
		Right:     0.83,
	}
	classifier2 = Classifier{
		Feature: []Feature{
			Feature{Rect: image.Rect(1, 1, 3, 3), Weight: -1.},
			Feature{Rect: image.Rect(3, 3, 5, 5), Weight: 2.5},
		},
		Threshold: 0.07,
		Left:      0.2,
		Right:     0.4,
	}
	cascade = Cascade{
		Stage: []CascadeStage{
			CascadeStage{
				Classifier: []Classifier{classifier0, classifier1},
				Threshold:  0.82,
			},
			CascadeStage{
				Classifier: []Classifier{classifier2},
				Threshold:  0.22,
			},
		},
		Size: image.Pt(20, 20),
	}
)

func TestParseOpenCV(t *testing.T) {
	file, err := os.Open("../../testdata/opencv.xml")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	cascadeFile, name, err := ParseOpenCV(file)
	if err != nil {
		t.Fatal(err)
	}
	if name != "name_of_cascade" {
		t.Fatalf("name: got %s want name_of_cascade", name)
	}

	if !reflect.DeepEqual(cascade, *cascadeFile) {
		t.Errorf("got\n %v want\n %v", *cascadeFile, cascade)
	}
}
