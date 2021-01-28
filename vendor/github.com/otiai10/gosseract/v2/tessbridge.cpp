#if __FreeBSD__ >= 10
#include "/usr/local/include/leptonica/allheaders.h"
#include "/usr/local/include/tesseract/baseapi.h"
#else
#include <leptonica/allheaders.h>
#include <tesseract/baseapi.h>
#endif

#include <stdio.h>
#include <unistd.h>
#include "tessbridge.h"

TessBaseAPI Create() {
    tesseract::TessBaseAPI* api = new tesseract::TessBaseAPI();
    return (void*)api;
}

void Free(TessBaseAPI a) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    if (api != nullptr) {
        api->End();
        delete api;
    }
}

void Clear(TessBaseAPI a) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    if (api != nullptr) {
        api->Clear();
    }
}

void ClearPersistentCache(TessBaseAPI a) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    api->ClearPersistentCache();
}

int Init(TessBaseAPI a, char* tessdataprefix, char* languages) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    return api->Init(tessdataprefix, languages);
}

int Init(TessBaseAPI a, char* tessdataprefix, char* languages, char* configfilepath, char* errbuf) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;

    // {{{ Redirect STDERR to given buffer
    fflush(stderr);
    int original_stderr;
    original_stderr = dup(STDERR_FILENO);
    (void)freopen("/dev/null", "a", stderr);
    setbuf(stderr, errbuf);
    // }}}

    int ret;
    if (configfilepath != NULL) {
        char* configs[] = {configfilepath};
        int configs_size = 1;
        ret = api->Init(tessdataprefix, languages, tesseract::OEM_DEFAULT, configs, configs_size, NULL, NULL, false);
    } else {
        ret = api->Init(tessdataprefix, languages);
    }

    // {{{ Restore default stderr
    (void)freopen("/dev/null", "a", stderr);
    dup2(original_stderr, STDERR_FILENO);
    close(original_stderr);
    setbuf(stderr, NULL);
    // }}}

    return ret;
}

bool SetVariable(TessBaseAPI a, char* name, char* value) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    return api->SetVariable(name, value);
}

void SetPixImage(TessBaseAPI a, PixImage pix) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    Pix* image = (Pix*)pix;
    api->SetImage(image);
    if (api->GetSourceYResolution() < 70) {
        api->SetSourceResolution(70);
    }
}

void SetPageSegMode(TessBaseAPI a, int m) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    tesseract::PageSegMode mode = (tesseract::PageSegMode)m;
    api->SetPageSegMode(mode);
}

int GetPageSegMode(TessBaseAPI a) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    return api->GetPageSegMode();
}

char* UTF8Text(TessBaseAPI a) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    return api->GetUTF8Text();
}

char* HOCRText(TessBaseAPI a) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    return api->GetHOCRText(0);
}

bounding_boxes* GetBoundingBoxesVerbose(TessBaseAPI a) {
    using namespace tesseract;
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    struct bounding_boxes* box_array;
    box_array = (bounding_boxes*)malloc(sizeof(bounding_boxes));
    // linearly resize boxes array
    int realloc_threshold = 900;
    int realloc_raise = 1000;
    int capacity = 1000;
    box_array->boxes = (bounding_box*)malloc(capacity * sizeof(bounding_box));
    box_array->length = 0;
    api->Recognize(NULL);
    int block_num = 0;
    int par_num = 0;
    int line_num = 0;
    int word_num = 0;

    ResultIterator* res_it = api->GetIterator();
    while (!res_it->Empty(RIL_BLOCK)) {
        if (res_it->Empty(RIL_WORD)) {
            res_it->Next(RIL_WORD);
            continue;
        }
        // Add rows for any new block/paragraph/textline.
        if (res_it->IsAtBeginningOf(RIL_BLOCK)) {
            block_num++;
            par_num = 0;
            line_num = 0;
            word_num = 0;
        }
        if (res_it->IsAtBeginningOf(RIL_PARA)) {
            par_num++;
            line_num = 0;
            word_num = 0;
        }
        if (res_it->IsAtBeginningOf(RIL_TEXTLINE)) {
            line_num++;
            word_num = 0;
        }
        word_num++;

        if (box_array->length >= realloc_threshold) {
            capacity += realloc_raise;
            box_array->boxes = (bounding_box*)realloc(box_array->boxes, capacity * sizeof(bounding_box));
            realloc_threshold += realloc_raise;
        }

        box_array->boxes[box_array->length].word = res_it->GetUTF8Text(RIL_WORD);
        box_array->boxes[box_array->length].confidence = res_it->Confidence(RIL_WORD);
        res_it->BoundingBox(RIL_WORD, &box_array->boxes[box_array->length].x1, &box_array->boxes[box_array->length].y1,
                            &box_array->boxes[box_array->length].x2, &box_array->boxes[box_array->length].y2);

        // block, para, line, word numbers
        box_array->boxes[box_array->length].block_num = block_num;
        box_array->boxes[box_array->length].par_num = par_num;
        box_array->boxes[box_array->length].line_num = line_num;
        box_array->boxes[box_array->length].word_num = word_num;

        box_array->length++;
        res_it->Next(RIL_WORD);
    }

    return box_array;
}

bounding_boxes* GetBoundingBoxes(TessBaseAPI a, int pageIteratorLevel) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    struct bounding_boxes* box_array;
    box_array = (bounding_boxes*)malloc(sizeof(bounding_boxes));
    // linearly resize boxes array
    int realloc_threshold = 900;
    int realloc_raise = 1000;
    int capacity = 1000;
    box_array->boxes = (bounding_box*)malloc(capacity * sizeof(bounding_box));
    box_array->length = 0;
    api->Recognize(NULL);
    tesseract::ResultIterator* ri = api->GetIterator();
    tesseract::PageIteratorLevel level = (tesseract::PageIteratorLevel)pageIteratorLevel;

    if (ri != 0) {
        do {
            if (box_array->length >= realloc_threshold) {
                capacity += realloc_raise;
                box_array->boxes = (bounding_box*)realloc(box_array->boxes, capacity * sizeof(bounding_box));
                realloc_threshold += realloc_raise;
            }
            box_array->boxes[box_array->length].word = ri->GetUTF8Text(level);
            box_array->boxes[box_array->length].confidence = ri->Confidence(level);
            ri->BoundingBox(level, &box_array->boxes[box_array->length].x1, &box_array->boxes[box_array->length].y1,
                            &box_array->boxes[box_array->length].x2, &box_array->boxes[box_array->length].y2);
            box_array->length++;
        } while (ri->Next(level));
    }

    return box_array;
}

const char* Version(TessBaseAPI a) {
    tesseract::TessBaseAPI* api = (tesseract::TessBaseAPI*)a;
    const char* v = api->Version();
    return v;
}

PixImage CreatePixImageByFilePath(char* imagepath) {
    Pix* image = pixRead(imagepath);
    return (void*)image;
}

PixImage CreatePixImageFromBytes(unsigned char* data, int size) {
    Pix* image = pixReadMem(data, (size_t)size);
    return (void*)image;
}

void DestroyPixImage(PixImage pix) {
    Pix* img = (Pix*)pix;
    pixDestroy(&img);
}

const char* GetDataPath() {
    static tesseract::TessBaseAPI api;
    api.Init(nullptr, nullptr);
    return api.GetDatapath();
}
