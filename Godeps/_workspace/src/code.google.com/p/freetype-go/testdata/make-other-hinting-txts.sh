#!/usr/bin/env bash
#
# This script creates the optional x-*-hinting.txt files from fonts that are
# not checked in for copyright or file size reasons.
#
# Run it from this directory (testdata).
#
# It has only been tested on an Ubuntu 14.04 system.

set -e

: ${FONTDIR:=/usr/share/fonts/truetype}

ln -sf $FONTDIR/droid/DroidSansJapanese.ttf       x-droid-sans-japanese.ttf
ln -sf $FONTDIR/msttcorefonts/Arial_Bold.ttf      x-arial-bold.ttf 
ln -sf $FONTDIR/msttcorefonts/Times_New_Roman.ttf x-times-new-roman.ttf
ln -sf $FONTDIR/ttf-dejavu/DejaVuSans-Oblique.ttf x-deja-vu-sans-oblique.ttf

${CC:=gcc} ../cmd/print-glyph-points/main.c $(pkg-config --cflags --libs freetype2) -o print-glyph-points

# Uncomment these lines to also recreate the luxisr-*-hinting.txt files.
# ./print-glyph-points 12 luxisr.ttf sans_hinting > luxisr-12pt-sans-hinting.txt
# ./print-glyph-points 12 luxisr.ttf with_hinting > luxisr-12pt-with-hinting.txt

./print-glyph-points  9 x-droid-sans-japanese.ttf sans_hinting  > x-droid-sans-japanese-9pt-sans-hinting.txt
./print-glyph-points  9 x-droid-sans-japanese.ttf with_hinting  > x-droid-sans-japanese-9pt-with-hinting.txt
./print-glyph-points 11 x-arial-bold.ttf sans_hinting           > x-arial-bold-11pt-sans-hinting.txt
./print-glyph-points 11 x-arial-bold.ttf with_hinting           > x-arial-bold-11pt-with-hinting.txt
./print-glyph-points 13 x-times-new-roman.ttf sans_hinting      > x-times-new-roman-13pt-sans-hinting.txt
./print-glyph-points 13 x-times-new-roman.ttf with_hinting      > x-times-new-roman-13pt-with-hinting.txt
./print-glyph-points 17 x-deja-vu-sans-oblique.ttf sans_hinting > x-deja-vu-sans-oblique-17pt-sans-hinting.txt
./print-glyph-points 17 x-deja-vu-sans-oblique.ttf with_hinting > x-deja-vu-sans-oblique-17pt-with-hinting.txt

rm print-glyph-points
