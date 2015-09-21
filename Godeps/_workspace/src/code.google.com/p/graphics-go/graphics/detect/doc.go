// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Package detect implements an object detector cascade.

The technique used is a degenerate tree of Haar-like classifiers, commonly
used for face detection. It is described in

	P. Viola, M. Jones.
	Rapid Object Detection using a Boosted Cascade of Simple Features, 2001
	IEEE Conference on Computer Vision and Pattern Recognition

A Cascade can be constructed manually from a set of Classifiers in stages,
or can be loaded from an XML file in the OpenCV format with

	classifier, _, err := detect.ParseOpenCV(r)

The classifier can be used to determine if a full image is detected as an
object using Detect

	if classifier.Match(m) {
		// m is an image of a face.
	}

It is also possible to search an image for occurrences of an object

	objs := classifier.Find(m)
*/
package detect
