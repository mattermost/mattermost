#ifdef __cplusplus
extern "C" {
#endif

typedef void* TessBaseAPI;
typedef void* PixImage;

struct bounding_box {
    int x1, y1, x2, y2;
    char* word;
    float confidence;
    int block_num, par_num, line_num, word_num;
};

struct bounding_boxes {
    int length;
    struct bounding_box* boxes;
};

TessBaseAPI Create(void);

void Free(TessBaseAPI);
void Clear(TessBaseAPI);
void ClearPersistentCache(TessBaseAPI);
int Init(TessBaseAPI, char*, char*, char*, char*);
struct bounding_boxes* GetBoundingBoxes(TessBaseAPI, int);
struct bounding_boxes* GetBoundingBoxesVerbose(TessBaseAPI);
bool SetVariable(TessBaseAPI, char*, char*);
void SetPixImage(TessBaseAPI a, PixImage pix);
void SetPageSegMode(TessBaseAPI, int);
int GetPageSegMode(TessBaseAPI);
char* UTF8Text(TessBaseAPI);
char* HOCRText(TessBaseAPI);
const char* Version(TessBaseAPI);
const char* GetDataPath();

PixImage CreatePixImageByFilePath(char*);
PixImage CreatePixImageFromBytes(unsigned char*, int);
void DestroyPixImage(PixImage pix);

#ifdef __cplusplus
}
#endif /* extern "C" */
