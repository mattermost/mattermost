/*
gcc main.c -I/usr/include/freetype2 -lfreetype && ./a.out 12 ../../testdata/luxisr.ttf with_hinting
*/

#include <stdio.h>
#include <ft2build.h>
#include FT_FREETYPE_H

void usage(char** argv) {
	fprintf(stderr, "usage: %s font_size font_file [with_hinting|sans_hinting]\n", argv[0]);
}

int main(int argc, char** argv) {
	FT_Error error;
	FT_Library library;
	FT_Face face;
	FT_Glyph_Metrics* m;
	FT_Outline* o;
	FT_Int major, minor, patch;
	int i, j, font_size, no_hinting;

	if (argc != 4) {
		usage(argv);
		return 1;
	}
	font_size = atoi(argv[1]);
	if (font_size <= 0) {
		fprintf(stderr, "invalid font_size\n");
		usage(argv);
		return 1;
	}
	if (!strcmp(argv[3], "with_hinting")) {
		no_hinting = 0;
	} else if (!strcmp(argv[3], "sans_hinting")) {
		no_hinting = 1;
	} else {
		fprintf(stderr, "neither \"with_hinting\" nor \"sans_hinting\"\n");
		usage(argv);
		return 1;
	};
	error = FT_Init_FreeType(&library);
	if (error) {
		fprintf(stderr, "FT_Init_FreeType: error #%d\n", error);
		return 1;
	}
	FT_Library_Version(library, &major, &minor, &patch);
	printf("freetype version %d.%d.%d\n", major, minor, patch);
	error = FT_New_Face(library, argv[2], 0, &face);
	if (error) {
		fprintf(stderr, "FT_New_Face: error #%d\n", error);
		return 1;
	}
	error = FT_Set_Char_Size(face, 0, font_size*64, 0, 0);
	if (error) {
		fprintf(stderr, "FT_Set_Char_Size: error #%d\n", error);
		return 1;
	}
	for (i = 0; i < face->num_glyphs; i++) {
		error = FT_Load_Glyph(face, i, no_hinting ? FT_LOAD_NO_HINTING : FT_LOAD_DEFAULT);
		if (error) {
			fprintf(stderr, "FT_Load_Glyph: glyph %d: error #%d\n", i, error);
			return 1;
		}
		if (face->glyph->format != FT_GLYPH_FORMAT_OUTLINE) {
			fprintf(stderr, "glyph format for glyph %d is not FT_GLYPH_FORMAT_OUTLINE\n", i);
			return 1;
		}
		m = &face->glyph->metrics;
		/* Print what Go calls the AdvanceWidth, and then: XMin, YMin, XMax, YMax. */
		printf("%ld %ld %ld %ld %ld;",
				m->horiAdvance,
				m->horiBearingX,
				m->horiBearingY - m->height,
				m->horiBearingX + m->width,
				m->horiBearingY);
		/* Print the glyph points. */
		o = &face->glyph->outline;
		for (j = 0; j < o->n_points; j++) {
			if (j != 0) {
				printf(", ");
			}
			printf("%ld %ld %d", o->points[j].x, o->points[j].y, o->tags[j] & 0x01);
		}
		printf("\n");
	}
	return 0;
}
