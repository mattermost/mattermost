# Minio Go Client API Reference [![Slack](https://slack.minio.io/slack?type=svg)](https://slack.minio.io)

## Initialize Minio Client object.

##  Minio

```go
package main

import (
    "fmt"

    "github.com/minio/minio-go"
)

func main() {
        // Use a secure connection.
        ssl := true

        // Initialize minio client object.
        minioClient, err := minio.New("play.minio.io:9000", "Q3AM3UQ867SPQQA43P2F", "zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG", ssl)
        if err != nil {
                fmt.Println(err)
                return
        }
}
```

## AWS S3

```go
package main

import (
    "fmt"

    "github.com/minio/minio-go"
)

func main() {
        // Use a secure connection.
        ssl := true

        // Initialize minio client object.
        s3Client, err := minio.New("s3.amazonaws.com", "YOUR-ACCESSKEYID", "YOUR-SECRETACCESSKEY", ssl)
        if err != nil {
                fmt.Println(err)
                return
        }
}
```

| Bucket operations                                 | Object operations                                   | Encrypted Object operations                 | Presigned operations                          | Bucket Policy/Notification Operations                         | Client custom settings                                |
| :---                                              | :---                                                | :---                                        | :---                                          | :---                                                          | :---                                                  |
| [`MakeBucket`](#MakeBucket)                       | [`GetObject`](#GetObject)                           | [`NewSymmetricKey`](#NewSymmetricKey)       | [`PresignedGetObject`](#PresignedGetObject)   | [`SetBucketPolicy`](#SetBucketPolicy)                         | [`SetAppInfo`](#SetAppInfo)                           |
| [`ListBuckets`](#ListBuckets)                     | [`PutObject`](#PutObject)                           | [`NewAsymmetricKey`](#NewAsymmetricKey)     | [`PresignedPutObject`](#PresignedPutObject)   | [`GetBucketPolicy`](#GetBucketPolicy)                         | [`SetCustomTransport`](#SetCustomTransport)           |
| [`BucketExists`](#BucketExists)                   | [`CopyObject`](#CopyObject)                         | [`GetEncryptedObject`](#GetEncryptedObject) | [`PresignedPostPolicy`](#PresignedPostPolicy) | [`ListBucketPolicies`](#ListBucketPolicies)                   | [`TraceOn`](#TraceOn)                                 |
| [`RemoveBucket`](#RemoveBucket)                   | [`StatObject`](#StatObject)                         | [`PutEncryptedObject`](#PutEncryptedObject) |                                               | [`SetBucketNotification`](#SetBucketNotification)             | [`TraceOff`](#TraceOff)                               |
| [`ListObjects`](#ListObjects)                     | [`RemoveObject`](#RemoveObject)                     | [`NewSSEInfo`](#NewSSEInfo)               |                                               | [`GetBucketNotification`](#GetBucketNotification)             | [`SetS3TransferAccelerate`](#SetS3TransferAccelerate) |
| [`ListObjectsV2`](#ListObjectsV2)                 | [`RemoveObjects`](#RemoveObjects)                   | [`FPutEncryptedObject`](#FPutEncryptedObject)    |                                               | [`RemoveAllBucketNotification`](#RemoveAllBucketNotification) |                                                       |
| [`ListIncompleteUploads`](#ListIncompleteUploads) | [`RemoveIncompleteUpload`](#RemoveIncompleteUpload) |                                             |                                               | [`ListenBucketNotification`](#ListenBucketNotification)       |                                                       |
|                                                   | [`FPutObject`](#FPutObject)                         |                                             |                                               |                                                               |                                                       |
|                                                   | [`FGetObject`](#FGetObject)                         |                                             |                                               |                                                               |                                                       |
|                                                   | [`ComposeObject`](#ComposeObject)                   |                                             |                                               |                                                               |                                                       |
|                                                   | [`NewSourceInfo`](#NewSourceInfo)                   |                                             |                                               |                                                               |                                                       |
|                                                   | [`NewDestinationInfo`](#NewDestinationInfo)         |                                             |                                               |                                                               |                                                       |
|   | [`PutObjectWithContext`](#PutObjectWithContext)  | |   |   |
|   | [`GetObjectWithContext`](#GetObjectWithContext)  | |   |   |
|   | [`FPutObjectWithContext`](#FPutObjectWithContext)  | |   |   |
|   | [`FGetObjectWithContext`](#FGetObjectWithContext)  | |   |   |
## 1. Constructor
<a name="Minio"></a>

### New(endpoint, accessKeyID, secretAccessKey string, ssl bool) (*Client, error)
Initializes a new client object.

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`endpoint`   | _string_  |S3 compatible object storage endpoint   |
|`accessKeyID`  |_string_   |Access key for the object storage |
|`secretAccessKey`  | _string_  |Secret key for the object storage |
|`ssl`   | _bool_  | If 'true' API requests will be secure (HTTPS), and insecure (HTTP) otherwise  |

### NewWithRegion(endpoint, accessKeyID, secretAccessKey string, ssl bool, region string) (*Client, error)
Initializes minio client, with region configured. Unlike New(), NewWithRegion avoids bucket-location lookup operations and it is slightly faster. Use this function when your application deals with a single region.

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`endpoint`   | _string_  |S3 compatible object storage endpoint |
|`accessKeyID`  |_string_   |Access key for the object storage |
|`secretAccessKey`  | _string_  |Secret key for the object storage |
|`ssl` | _bool_  | If 'true' API requests will be secure (HTTPS), and insecure (HTTP) otherwise |
|`region`| _string_ | Region for the object storage |

## 2. Bucket operations

<a name="MakeBucket"></a>
### MakeBucket(bucketName, location string) error
Creates a new bucket.

__Parameters__

| Param  | Type  | Description  |
|---|---|---|
|`bucketName`  | _string_  | Name of the bucket |
| `location`  |  _string_ | Region where the bucket is to be created. Default value is us-east-1. Other valid values are listed below. Note: When used with minio server, use the region specified in its config file (defaults to us-east-1).|
| | |us-east-1 |
| | |us-west-1 |
| | |us-west-2 |
| | |eu-west-1 |
| | | eu-central-1|
| | | ap-southeast-1|
| | | ap-northeast-1|
| | | ap-southeast-2|
| | | sa-east-1|


__Example__


```go
err = minioClient.MakeBucket("mybucket", "us-east-1")
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully created mybucket.")
```

<a name="ListBuckets"></a>
### ListBuckets() ([]BucketInfo, error)
Lists all buckets.

| Param  | Type  | Description  |
|---|---|---|
|`bucketList`  | _[]minio.BucketInfo_  | Lists of all buckets |


__minio.BucketInfo__

| Field  | Type  | Description  |
|---|---|---|
|`bucket.Name`  | _string_  | Name of the bucket |
|`bucket.CreationDate`  | _time.Time_  | Date of bucket creation |


__Example__


```go
buckets, err := minioClient.ListBuckets()
if err != nil {
    fmt.Println(err)
    return
}
for _, bucket := range buckets {
    fmt.Println(bucket)
}
```

<a name="BucketExists"></a>
### BucketExists(bucketName string) (found bool, err error)
Checks if a bucket exists.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket |


__Return Values__

|Param   |Type   |Description   |
|:---|:---| :---|
|`found`  | _bool_ | Indicates whether bucket exists or not  |
|`err` | _error_  | Standard Error  |


__Example__


```go
found, err := minioClient.BucketExists("mybucket")
if err != nil {
    fmt.Println(err)
    return
}
if found {
    fmt.Println("Bucket found")
}
```

<a name="RemoveBucket"></a>
### RemoveBucket(bucketName string) error
Removes a bucket, bucket should be empty to be successfully removed.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |

__Example__


```go
err = minioClient.RemoveBucket("mybucket")
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="ListObjects"></a>
### ListObjects(bucketName, prefix string, recursive bool, doneCh chan struct{}) <-chan ObjectInfo
Lists objects in a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName` | _string_  |Name of the bucket   |
|`objectPrefix` |_string_   | Prefix of objects to be listed |
|`recursive`  | _bool_  |`true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'.  |
|`doneCh`  | _chan struct{}_ | A message on this channel ends the ListObjects iterator.  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`objectInfo`  | _chan minio.ObjectInfo_ |Read channel for all objects in the bucket, the object is of the format listed below: |

__minio.ObjectInfo__

|Field   |Type   |Description   |
|:---|:---| :---|
|`objectInfo.Key`  | _string_ |Name of the object |
|`objectInfo.Size`  | _int64_ |Size of the object |
|`objectInfo.ETag`  | _string_ |MD5 checksum of the object |
|`objectInfo.LastModified`  | _time.Time_ |Time when object was last modified |


```go
// Create a done channel to control 'ListObjects' go routine.
doneCh := make(chan struct{})

// Indicate to our routine to exit cleanly upon return.
defer close(doneCh)

isRecursive := true
objectCh := minioClient.ListObjects("mybucket", "myprefix", isRecursive, doneCh)
for object := range objectCh {
    if object.Err != nil {
        fmt.Println(object.Err)
        return
    }
    fmt.Println(object)
}
```


<a name="ListObjectsV2"></a>
### ListObjectsV2(bucketName, prefix string, recursive bool, doneCh chan struct{}) <-chan ObjectInfo
Lists objects in a bucket using the recommended listing API v2

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket |
| `objectPrefix` |_string_   | Prefix of objects to be listed |
| `recursive`  | _bool_  |`true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'.  |
|`doneCh`  | _chan struct{}_ | A message on this channel ends the ListObjectsV2 iterator.  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`objectInfo`  | _chan minio.ObjectInfo_ |Read channel for all the objects in the bucket, the object is of the format listed below: |


```go
// Create a done channel to control 'ListObjectsV2' go routine.
doneCh := make(chan struct{})

// Indicate to our routine to exit cleanly upon return.
defer close(doneCh)

isRecursive := true
objectCh := minioClient.ListObjectsV2("mybucket", "myprefix", isRecursive, doneCh)
for object := range objectCh {
    if object.Err != nil {
        fmt.Println(object.Err)
        return
    }
    fmt.Println(object)
}
```

<a name="ListIncompleteUploads"></a>
### ListIncompleteUploads(bucketName, prefix string, recursive bool, doneCh chan struct{}) <- chan ObjectMultipartInfo
Lists partially uploaded objects in a bucket.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket |
| `prefix` |_string_   | Prefix of objects that are partially uploaded |
| `recursive`  | _bool_  |`true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'.  |
|`doneCh`  | _chan struct{}_ | A message on this channel ends the ListenIncompleteUploads iterator.  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`multiPartInfo`  | _chan minio.ObjectMultipartInfo_  |Emits multipart objects of the format listed below: |

__minio.ObjectMultipartInfo__

|Field   |Type   |Description   |
|:---|:---| :---|
|`multiPartObjInfo.Key`  | _string_  |Name of incompletely uploaded object |
|`multiPartObjInfo.UploadID` | _string_ |Upload ID of incompletely uploaded object |
|`multiPartObjInfo.Size` | _int64_ |Size of incompletely uploaded object |

__Example__


```go
// Create a done channel to control 'ListObjects' go routine.
doneCh := make(chan struct{})

// Indicate to our routine to exit cleanly upon return.
defer close(doneCh)

isRecursive := true // Recursively list everything at 'myprefix'
multiPartObjectCh := minioClient.ListIncompleteUploads("mybucket", "myprefix", isRecursive, doneCh)
for multiPartObject := range multiPartObjectCh {
    if multiPartObject.Err != nil {
        fmt.Println(multiPartObject.Err)
        return
    }
    fmt.Println(multiPartObject)
}
```

## 3. Object operations

<a name="GetObject"></a>
### GetObject(bucketName, objectName string, opts GetObjectOptions) (*Object, error)
Returns a stream of the object data. Most of the common errors occur when reading the stream.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object  |
|`opts` | _minio.GetObjectOptions_ | Options for GET requests specifying additional options like encryption, If-Match |


__minio.GetObjectOptions__

|Field | Type | Description |
|:---|:---|:---|
| `opts.Materials` | _encrypt.Materials_ | Interface provided by `encrypt` package to encrypt a stream of data (For more information see https://godoc.org/github.com/minio/minio-go) |

__Return Value__


|Param   |Type   |Description   |
|:---|:---| :---|
|`object`  | _*minio.Object_ |_minio.Object_ represents object reader. It implements io.Reader, io.Seeker, io.ReaderAt and io.Closer interfaces. |


__Example__


```go
object, err := minioClient.GetObject("mybucket", "myobject", minio.GetObjectOptions{})
if err != nil {
    fmt.Println(err)
    return
}
localFile, err := os.Create("/tmp/local-file.jpg")
if err != nil {
    fmt.Println(err)
    return
}
if _, err = io.Copy(localFile, object); err != nil {
    fmt.Println(err)
    return
}
```

<a name="FGetObject"></a>
### FGetObject(bucketName, objectName, filePath string, opts GetObjectOptions) error
Downloads and saves the object as a file in the local filesystem.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket |
|`objectName` | _string_  |Name of the object  |
|`filePath` | _string_  |Path to download object to |
|`opts` | _minio.GetObjectOptions_ | Options for GET requests specifying additional options like encryption, If-Match |


__Example__


```go
err = minioClient.FGetObject("mybucket", "myobject", "/tmp/myobject", minio.GetObjectOptions{})
if err != nil {
    fmt.Println(err)
    return
}
```
<a name="GetObjectWithContext"></a>
### GetObjectWithContext(ctx context.Context, bucketName, objectName string, opts GetObjectOptions) (*Object, error)
Identical to GetObject operation, but accepts a context for request cancellation.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |Request context  |
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object  |
|`opts` | _minio.GetObjectOptions_ | Options for GET requests specifying additional options like encryption, If-Match |


__Return Value__


|Param   |Type   |Description   |
|:---|:---| :---|
|`object`  | _*minio.Object_ |_minio.Object_ represents object reader. It implements io.Reader, io.Seeker, io.ReaderAt and io.Closer interfaces. |


__Example__


```go
ctx, cancel := context.WithTimeout(context.Background(), 100 * time.Second)
defer cancel()

object, err := minioClient.GetObjectWithContext(ctx, "mybucket", "myobject", minio.GetObjectOptions{})
if err != nil {
    fmt.Println(err)
    return
}

localFile, err := os.Create("/tmp/local-file.jpg")
if err != nil {
    fmt.Println(err)
    return
}

if _, err = io.Copy(localFile, object); err != nil {
    fmt.Println(err)
    return
}
```

<a name="FGetObjectWithContext"></a>
### FGetObjectWithContext(ctx context.Context, bucketName, objectName, filePath string, opts GetObjectOptions) error
Identical to FGetObject operation, but allows request cancellation.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |Request context |
|`bucketName`  | _string_  |Name of the bucket |
|`objectName` | _string_  |Name of the object  |
|`filePath` | _string_  |Path to download object to |
|`opts` | _minio.GetObjectOptions_ | Options for GET requests specifying additional options like encryption, If-Match |


__Example__


```go
ctx, cancel := context.WithTimeout(context.Background(), 100 * time.Second)
defer cancel()

err = minioClient.FGetObjectWithContext(ctx, "mybucket", "myobject", "/tmp/myobject", minio.GetObjectOptions{})
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="FGetEncryptedObject"></a>
### FGetEncryptedObject(bucketName, objectName, filePath string, materials encrypt.Materials) error
Identical to FGetObject operation, but decrypts an encrypted request

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket |
|`objectName` | _string_  |Name of the object  |
|`filePath` | _string_  |Path to download object to |
|`materials` | _encrypt.Materials_ | Interface provided by `encrypt` package to encrypt a stream of data (For more information see https://godoc.org/github.com/minio/minio-go) |


__Example__


```go
// Generate a master symmetric key
key := encrypt.NewSymmetricKey([]byte("my-secret-key-00"))

// Build the CBC encryption material
cbcMaterials, err := encrypt.NewCBCSecureMaterials(key)
if err != nil {
    fmt.Println(err)
    return
}

err = minioClient.FGetEncryptedObject("mybucket", "myobject", "/tmp/myobject", cbcMaterials)
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="PutObject"></a>
### PutObject(bucketName, objectName string, reader io.Reader, objectSize int64,opts PutObjectOptions) (n int, err error)
Uploads objects that are less than 64MiB in a single PUT operation. For objects that are greater than 64MiB in size, PutObject seamlessly uploads the object as parts of 64MiB or more depending on the actual file size. The max upload size for an object is 5TB.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object   |
|`reader` | _io.Reader_  |Any Go type that implements io.Reader |
|`objectSize`| _int64_ |Size of the object being uploaded. Pass -1 if stream size is unknown |
|`opts` | _minio.PutObjectOptions_  | Allows user to set optional custom metadata, content headers, encryption keys and number of threads for multipart upload operation. |

__minio.PutObjectOptions__

|Field | Type | Description |
|:--- |:--- | :--- |
| `opts.UserMetadata` | _map[string]string_ | Map of user metadata|
| `opts.Progress` | _io.Reader_ | Reader to fetch progress of an upload |
| `opts.ContentType` | _string_ | Content type of object, e.g "application/text" |
| `opts.ContentEncoding` | _string_ | Content encoding of object, e.g "gzip" |
| `opts.ContentDisposition` | _string_ | Content disposition of object, "inline" |
| `opts.CacheControl` | _string_ | Used to specify directives for caching mechanisms in both requests and responses e.g "max-age=600"|
| `opts.EncryptMaterials` | _encrypt.Materials_ | Interface provided by `encrypt` package to encrypt a stream of data (For more information see https://godoc.org/github.com/minio/minio-go) |
| `opts.StorageClass` | _string_ | Specify storage class for the object. Supported values for Minio server are `REDUCED_REDUNDANCY` and `STANDARD` |

__Example__


```go
file, err := os.Open("my-testfile")
if err != nil {
    fmt.Println(err)
    return
}
defer file.Close()

fileStat, err := file.Stat()
if err != nil {
    fmt.Println(err)
    return
}

n, err := minioClient.PutObject("mybucket", "myobject", file, fileStat.Size(), minio.PutObjectOptions{ContentType:"application/octet-stream"})
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully uploaded bytes: ", n)
```

API methods PutObjectWithSize, PutObjectWithMetadata, PutObjectStreaming, and PutObjectWithProgress available in minio-go SDK release v3.0.3 are replaced by the new PutObject call variant that accepts a pointer to PutObjectOptions struct.

<a name="PutObjectWithContext"></a>
### PutObjectWithContext(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, opts PutObjectOptions) (n int, err error)
Identical to PutObject operation, but allows request cancellation.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |Request context |
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object   |
|`reader` | _io.Reader_  |Any Go type that implements io.Reader |
|`objectSize`| _int64_ | size of the object being uploaded. Pass -1 if stream size is unknown |
|`opts` | _minio.PutObjectOptions_  |Pointer to struct that allows user to set optional custom metadata, content-type, content-encoding,content-disposition and cache-control headers, pass encryption module for encrypting objects, and optionally configure number of threads for multipart put operation. |


__Example__


```go
ctx, cancel := context.WithTimeout(context.Background(), 10 * time.Second)
defer cancel()

file, err := os.Open("my-testfile")
if err != nil {
    fmt.Println(err)
    return
}
defer file.Close()

fileStat, err := file.Stat()
if err != nil {
    fmt.Println(err)
    return
}

n, err := minioClient.PutObjectWithContext(ctx, "my-bucketname", "my-objectname", file, fileStat.Size(), minio.PutObjectOptions{
	ContentType: "application/octet-stream",
})
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully uploaded bytes: ", n)
```

<a name="CopyObject"></a>
### CopyObject(dst DestinationInfo, src SourceInfo) error
Create or replace an object through server-side copying of an existing object. It supports conditional copying, copying a part of an object and server-side encryption of destination and decryption of source. See the `SourceInfo` and `DestinationInfo` types for further details.

To copy multiple source objects into a single destination object see the `ComposeObject` API.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`dst`  | _minio.DestinationInfo_  |Argument describing the destination object |
|`src` | _minio.SourceInfo_  |Argument describing the source object |


__Example__


```go
// Use-case 1: Simple copy object with no conditions.
// Source object
src := minio.NewSourceInfo("my-sourcebucketname", "my-sourceobjectname", nil)

// Destination object
dst, err := minio.NewDestinationInfo("my-bucketname", "my-objectname", nil, nil)
if err != nil {
    fmt.Println(err)
    return
}

// Copy object call
err = minioClient.CopyObject(dst, src)
if err != nil {
    fmt.Println(err)
    return
}
```

```go
// Use-case 2:
// Copy object with copy-conditions, and copying only part of the source object.
// 1. that matches a given ETag
// 2. and modified after 1st April 2014
// 3. but unmodified since 23rd April 2014
// 4. copy only first 1MiB of object.

// Source object
src := minio.NewSourceInfo("my-sourcebucketname", "my-sourceobjectname", nil)

// Set matching ETag condition, copy object which matches the following ETag.
src.SetMatchETagCond("31624deb84149d2f8ef9c385918b653a")

// Set modified condition, copy object modified since 2014 April 1.
src.SetModifiedSinceCond(time.Date(2014, time.April, 1, 0, 0, 0, 0, time.UTC))

// Set unmodified condition, copy object unmodified since 2014 April 23.
src.SetUnmodifiedSinceCond(time.Date(2014, time.April, 23, 0, 0, 0, 0, time.UTC))

// Set copy-range of only first 1MiB of file.
src.SetRange(0, 1024*1024-1)

// Destination object
dst, err := minio.NewDestinationInfo("my-bucketname", "my-objectname", nil, nil)
if err != nil {
    fmt.Println(err)
    return
}

// Copy object call
err = minioClient.CopyObject(dst, src)
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="ComposeObject"></a>
### ComposeObject(dst minio.DestinationInfo, srcs []minio.SourceInfo) error
Create an object by concatenating a list of source objects using server-side copying.

__Parameters__


|Param   |Type   |Description   |
|:---|:---|:---|
|`dst`  | _minio.DestinationInfo_  |Struct with info about the object to be created. |
|`srcs` | _[]minio.SourceInfo_  |Slice of struct with info about source objects to be concatenated in order. |


__Example__


```go
// Prepare source decryption key (here we assume same key to
// decrypt all source objects.)
decKey := minio.NewSSEInfo([]byte{1, 2, 3}, "")

// Source objects to concatenate. We also specify decryption
// key for each
src1 := minio.NewSourceInfo("bucket1", "object1", &decKey)
src1.SetMatchETagCond("31624deb84149d2f8ef9c385918b653a")

src2 := minio.NewSourceInfo("bucket2", "object2", &decKey)
src2.SetMatchETagCond("f8ef9c385918b653a31624deb84149d2")

src3 := minio.NewSourceInfo("bucket3", "object3", &decKey)
src3.SetMatchETagCond("5918b653a31624deb84149d2f8ef9c38")

// Create slice of sources.
srcs := []minio.SourceInfo{src1, src2, src3}

// Prepare destination encryption key
encKey := minio.NewSSEInfo([]byte{8, 9, 0}, "")

// Create destination info
dst, err := minio.NewDestinationInfo("bucket", "object", &encKey, nil)
if err != nil {
    fmt.Println(err)
    return
}

// Compose object call by concatenating multiple source files.
err = minioClient.ComposeObject(dst, srcs)
if err != nil {
    fmt.Println(err)
    return
}

fmt.Println("Composed object successfully.")
```

<a name="NewSourceInfo"></a>
### NewSourceInfo(bucket, object string, decryptSSEC *SSEInfo) SourceInfo
Construct a `SourceInfo` object that can be used as the source for server-side copying operations like `CopyObject` and `ComposeObject`. This object can be used to set copy-conditions on the source.

__Parameters__

| Param         | Type             | Description                                                      |
| :---          | :---             | :---                                                             |
| `bucket`      | _string_         | Name of the source bucket                                        |
| `object`      | _string_         | Name of the source object                                        |
| `decryptSSEC` | _*minio.SSEInfo_ | Decryption info for the source object (`nil` without encryption) |

__Example__

```go
// No decryption parameter.
src := minio.NewSourceInfo("bucket", "object", nil)

// Destination object
dst, err := minio.NewDestinationInfo("my-bucketname", "my-objectname", nil, nil)
if err != nil {
    fmt.Println(err)
    return
}

// Copy object call
err = minioClient.CopyObject(dst, src)
if err != nil {
    fmt.Println(err)
    return
}
```

```go
// With decryption parameter.
decKey := minio.NewSSEInfo([]byte{1,2,3}, "")
src := minio.NewSourceInfo("bucket", "object", &decKey)

// Destination object
dst, err := minio.NewDestinationInfo("my-bucketname", "my-objectname", nil, nil)
if err != nil {
    fmt.Println(err)
    return
}

// Copy object call
err = minioClient.CopyObject(dst, src)
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="NewDestinationInfo"></a>
### NewDestinationInfo(bucket, object string, encryptSSEC *SSEInfo, userMeta map[string]string) (DestinationInfo, error)
Construct a `DestinationInfo` object that can be used as the destination object for server-side copying operations like `CopyObject` and `ComposeObject`.

__Parameters__

| Param         | Type                | Description                                                                                                    |
| :---          | :---                | :---                                                                                                           |
| `bucket`      | _string_            | Name of the destination bucket                                                                                 |
| `object`      | _string_            | Name of the destination object                                                                                 |
| `encryptSSEC` | _*minio.SSEInfo_    | Encryption info for the source object (`nil` without encryption)                                               |
| `userMeta`    | _map[string]string_ | User metadata to be set on the destination. If nil, with only one source, user-metadata is copied from source. |

__Example__

```go
// No encryption parameter.
src := minio.NewSourceInfo("bucket", "object", nil)
dst, err := minio.NewDestinationInfo("bucket", "object", nil, nil)
if err != nil {
    fmt.Println(err)
    return
}

// Copy object call
err = minioClient.CopyObject(dst, src)
if err != nil {
    fmt.Println(err)
    return
}
```

```go
src := minio.NewSourceInfo("bucket", "object", nil)

// With encryption parameter.
encKey := minio.NewSSEInfo([]byte{1,2,3}, "")
dst, err := minio.NewDestinationInfo("bucket", "object", &encKey, nil)
if err != nil {
    fmt.Println(err)
    return
}

// Copy object call
err = minioClient.CopyObject(dst, src)
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="FPutObject"></a>
### FPutObject(bucketName, objectName, filePath, opts PutObjectOptions) (length int64, err error)
Uploads contents from a file to objectName.

FPutObject uploads objects that are less than 64MiB in a single PUT operation. For objects that are greater than the 64MiB in size, FPutObject seamlessly uploads the object in chunks of 64MiB or more depending on the actual file size. The max upload size for an object is 5TB.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object |
|`filePath` | _string_  |Path to file to be uploaded |
|`opts` | _minio.PutObjectOptions_  |Pointer to struct that allows user to set optional custom metadata, content-type, content-encoding,content-disposition and cache-control headers, pass encryption module for encrypting objects, and optionally configure number of threads for multipart put operation.  |


__Example__


```go
n, err := minioClient.FPutObject("my-bucketname", "my-objectname", "my-filename.csv", minio.PutObjectOptions{
	ContentType: "application/csv",
});
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully uploaded bytes: ", n)
```

<a name="FPutObjectWithContext"></a>
### FPutObjectWithContext(ctx context.Context, bucketName, objectName, filePath, opts PutObjectOptions) (length int64, err error)
Identical to FPutObject operation, but allows request cancellation.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |Request context  |
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object |
|`filePath` | _string_  |Path to file to be uploaded |
|`opts` | _minio.PutObjectOptions_  |Pointer to struct that allows user to set optional custom metadata, content-type, content-encoding,content-disposition and cache-control headers, pass encryption module for encrypting objects, and optionally configure number of threads for multipart put operation. |

__Example__


```go
ctx, cancel := context.WithTimeout(context.Background(), 100 * time.Second)
defer cancel()

n, err := minioClient.FPutObjectWithContext(ctx, "mybucket", "myobject.csv", "/tmp/otherobject.csv", minio.PutObjectOptions{ContentType:"application/csv"})
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully uploaded bytes: ", n)
```

<a name="StatObject"></a>
### StatObject(bucketName, objectName string, opts StatObjectOptions) (ObjectInfo, error)
Fetch metadata of an object.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object   |
|`opts` | _minio.StatObjectOptions_ | Options for GET info/stat requests specifying additional options like encryption, If-Match |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`objInfo`  | _minio.ObjectInfo_  |Object stat information |


__minio.ObjectInfo__

|Field   |Type   |Description   |
|:---|:---| :---|
|`objInfo.LastModified`  | _time.Time_  |Time when object was last modified |
|`objInfo.ETag` | _string_ |MD5 checksum of the object|
|`objInfo.ContentType` | _string_ |Content type of the object|
|`objInfo.Size` | _int64_ |Size of the object|


__Example__


```go
objInfo, err := minioClient.StatObject("mybucket", "myobject", minio.StatObjectOptions{})
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println(objInfo)
```

<a name="RemoveObject"></a>
### RemoveObject(bucketName, objectName string) error
Removes an object.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object |


```go
err = minioClient.RemoveObject("mybucket", "myobject")
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="RemoveObjects"></a>
### RemoveObjects(bucketName string, objectsCh chan string) (errorCh <-chan RemoveObjectError)
Removes a list of objects obtained from an input channel. The call sends a delete request to the server up to 1000 objects at a time. The errors observed are sent over the error channel.

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectsCh` | _chan string_  | Channel of objects to be removed   |


__Return Values__

|Param   |Type   |Description   |
|:---|:---| :---|
|`errorCh` | _<-chan minio.RemoveObjectError_  | Receive-only channel of errors observed during deletion.  |


```go
objectsCh := make(chan string)

// Send object names that are needed to be removed to objectsCh
go func() {
	defer close(objectsCh)
	// List all objects from a bucket-name with a matching prefix.
	for object := range minioClient.ListObjects("my-bucketname", "my-prefixname", true, nil) {
		if object.Err != nil {
			log.Fatalln(object.Err)
		}
		objectsCh <- object.Key
	}
}()

for rErr := range minioClient.RemoveObjects("mybucket", objectsCh) {
    fmt.Println("Error detected during deletion: ", rErr)
}
```

<a name="RemoveIncompleteUpload"></a>
### RemoveIncompleteUpload(bucketName, objectName string) error
Removes a partially uploaded object.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |
|`objectName` | _string_  |Name of the object   |

__Example__


```go
err = minioClient.RemoveIncompleteUpload("mybucket", "myobject")
if err != nil {
    fmt.Println(err)
    return
}
```

## 4. Encrypted object operations

<a name="NewSymmetricKey"></a>
### NewSymmetricKey(key []byte) *encrypt.SymmetricKey

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`key`  | _string_  |Name of the bucket  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`symmetricKey`  | _*encrypt.SymmetricKey_ | represents a symmetric key structure which can be used to encrypt and decrypt data |

```go
symKey := encrypt.NewSymmetricKey([]byte("my-secret-key-00"))

// Build the CBC encryption material with symmetric key.
cbcMaterials, err := encrypt.NewCBCSecureMaterials(symKey)
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully initialized Symmetric key CBC materials", cbcMaterials)

object, err := minioClient.GetEncryptedObject("mybucket", "myobject", cbcMaterials)
if err != nil {
    fmt.Println(err)
    return
}
defer object.Close()
```

<a name="NewAsymmetricKey"></a>
### NewAsymmetricKey(privateKey []byte, publicKey[]byte) (*encrypt.AsymmetricKey, error)

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`privateKey` | _[]byte_ | Private key data  |
|`publicKey`  | _[]byte_ | Public key data  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`asymmetricKey`  | _*encrypt.AsymmetricKey_ | represents an asymmetric key structure which can be used to encrypt and decrypt data |
|`err`  | _error_ |  Standard Error |


```go
privateKey, err := ioutil.ReadFile("private.key")
if err != nil {
    fmt.Println(err)
    return
}

publicKey, err := ioutil.ReadFile("public.key")
if err != nil {
    fmt.Println(err)
    return
}

// Initialize the asymmetric key
asymmetricKey, err := encrypt.NewAsymmetricKey(privateKey, publicKey)
if err != nil {
    fmt.Println(err)
    return
}

// Build the CBC encryption material for asymmetric key.
cbcMaterials, err := encrypt.NewCBCSecureMaterials(asymmetricKey)
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully initialized Asymmetric key CBC materials", cbcMaterials)

object, err := minioClient.GetEncryptedObject("mybucket", "myobject", cbcMaterials)
if err != nil {
    fmt.Println(err)
    return
}
defer object.Close()
```

<a name="GetEncryptedObject"></a>
### GetEncryptedObject(bucketName, objectName string, encryptMaterials encrypt.Materials) (io.ReadCloser, error)

Returns the decrypted stream of the object data based of the given encryption materials. Most of the common errors occur when reading the stream.

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  | Name of the bucket  |
|`objectName` | _string_  | Name of the object  |
|`encryptMaterials` | _encrypt.Materials_ | Interface provided by `encrypt` package to encrypt a stream of data (For more information see https://godoc.org/github.com/minio/minio-go) |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`stream`  | _io.ReadCloser_ | Returns the deciphered object reader, caller should close after reading. |
|`err`  | _error | Returns errors. |


__Example__


```go
// Generate a master symmetric key
key := encrypt.NewSymmetricKey([]byte("my-secret-key-00"))

// Build the CBC encryption material
cbcMaterials, err := encrypt.NewCBCSecureMaterials(key)
if err != nil {
    fmt.Println(err)
    return
}

object, err := minioClient.GetEncryptedObject("mybucket", "myobject", cbcMaterials)
if err != nil {
    fmt.Println(err)
    return
}
defer object.Close()

localFile, err := os.Create("/tmp/local-file.jpg")
if err != nil {
    fmt.Println(err)
    return
}
defer localFile.Close()

if _, err = io.Copy(localFile, object); err != nil {
    fmt.Println(err)
    return
}
```

<a name="PutEncryptedObject"></a>

### PutEncryptedObject(bucketName, objectName string, reader io.Reader, encryptMaterials encrypt.Materials) (n int, err error)
Encrypt and upload an object.

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object   |
|`reader` | _io.Reader_  |Any Go type that implements io.Reader |
|`encryptMaterials` | _encrypt.Materials_  | Interface provided by `encrypt` package to encrypt a stream of data (For more information see https://godoc.org/github.com/minio/minio-go) |

__Example__

```go
// Load a private key
privateKey, err := ioutil.ReadFile("private.key")
if err != nil {
    fmt.Println(err)
    return
}

// Load a public key
publicKey, err := ioutil.ReadFile("public.key")
if err != nil {
    fmt.Println(err)
    return
}

// Build an asymmetric key
key, err := encrypt.NewAsymmetricKey(privateKey, publicKey)
if err != nil {
    fmt.Println(err)
    return
}

// Build the CBC encryption module
cbcMaterials, err := encrypt.NewCBCSecureMaterials(key)
if err != nil {
    fmt.Println(err)
    return
}

// Open a file to upload
file, err := os.Open("my-testfile")
if err != nil {
    fmt.Println(err)
    return
}
defer file.Close()

// Upload the encrypted form of the file
n, err := minioClient.PutEncryptedObject("mybucket", "myobject", file, cbcMaterials)
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully uploaded encrypted bytes: ", n)
```

<a name="FPutEncryptedObject"></a>
### FPutEncryptedObject(bucketName, objectName, filePath, encryptMaterials encrypt.Materials) (n int, err error)
Encrypt and upload an object from a file.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectName` | _string_  |Name of the object |
|`filePath` | _string_  |Path to file to be uploaded |
|`encryptMaterials` | _encrypt.Materials_  | Interface provided by `encrypt` package to encrypt a stream of data (For more information see https://godoc.org/github.com/minio/minio-go)The module that encrypts data |

__Example__


```go
// Load a private key
privateKey, err := ioutil.ReadFile("private.key")
if err != nil {
    fmt.Println(err)
    return
}

// Load a public key
publicKey, err := ioutil.ReadFile("public.key")
if err != nil {
    fmt.Println(err)
    return
}

// Build an asymmetric key
key, err := encrypt.NewAsymmetricKey(privateKey, publicKey)
if err != nil {
    fmt.Println(err)
    return
}

// Build the CBC encryption module
cbcMaterials, err := encrypt.NewCBCSecureMaterials(key)
if err != nil {
    fmt.Println(err)
    return
}

n, err := minioClient.FPutEncryptedObject("mybucket", "myobject.csv", "/tmp/otherobject.csv", cbcMaterials)
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully uploaded encrypted bytes: ", n)
```

<a name="NewSSEInfo"></a>

### NewSSEInfo(key []byte, algo string) SSEInfo
Create a key object for use as encryption or decryption parameter in operations involving server-side-encryption with customer provided key (SSE-C).

__Parameters__

| Param  | Type     | Description                                                                                          |
| :---   | :---     | :---                                                                                                 |
| `key`  | _[]byte_ | Byte-slice of the raw, un-encoded binary key                                                         |
| `algo` | _string_ | Algorithm to use in encryption or decryption with the given key. Can be empty (defaults to `AES256`) |


## 5. Presigned operations

<a name="PresignedGetObject"></a>
### PresignedGetObject(bucketName, objectName string, expiry time.Duration, reqParams url.Values) (*url.URL, error)
Generates a presigned URL for HTTP GET operations. Browsers/Mobile clients may point to this URL to directly download objects even if the bucket is private. This presigned URL can have an associated expiration time in seconds after which it is no longer operational. The default expiry is set to 7 days.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |
|`objectName` | _string_  |Name of the object   |
|`expiry` | _time.Duration_  |Expiry of presigned URL in seconds   |
|`reqParams` | _url.Values_  |Additional response header overrides supports _response-expires_, _response-content-type_, _response-cache-control_, _response-content-disposition_.  |


__Example__


```go
// Set request parameters for content-disposition.
reqParams := make(url.Values)
reqParams.Set("response-content-disposition", "attachment; filename=\"your-filename.txt\"")

// Generates a presigned url which expires in a day.
presignedURL, err := minioClient.PresignedGetObject("mybucket", "myobject", time.Second * 24 * 60 * 60, reqParams)
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully generated presigned URL", presignedURL)
```

<a name="PresignedPutObject"></a>
### PresignedPutObject(bucketName, objectName string, expiry time.Duration) (*url.URL, error)
Generates a presigned URL for HTTP PUT operations. Browsers/Mobile clients may point to this URL to upload objects directly to a bucket even if it is private. This presigned URL can have an associated expiration time in seconds after which it is no longer operational. The default expiry is set to 7 days.

NOTE: you can upload to S3 only with specified object name.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |
|`objectName` | _string_  |Name of the object   |
|`expiry` | _time.Duration_  |Expiry of presigned URL in seconds |


__Example__


```go
// Generates a url which expires in a day.
expiry := time.Second * 24 * 60 * 60 // 1 day.
presignedURL, err := minioClient.PresignedPutObject("mybucket", "myobject", expiry)
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully generated presigned URL", presignedURL)
```

<a name="PresignedHeadObject"></a>
### PresignedHeadObject(bucketName, objectName string, expiry time.Duration, reqParams url.Values) (*url.URL, error)
Generates a presigned URL for HTTP HEAD operations. Browsers/Mobile clients may point to this URL to directly get metadata from objects even if the bucket is private. This presigned URL can have an associated expiration time in seconds after which it is no longer operational. The default expiry is set to 7 days.

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |
|`objectName` | _string_  |Name of the object   |
|`expiry` | _time.Duration_  |Expiry of presigned URL in seconds   |
|`reqParams` | _url.Values_  |Additional response header overrides supports _response-expires_, _response-content-type_, _response-cache-control_, _response-content-disposition_.  |


__Example__


```go
// Set request parameters for content-disposition.
reqParams := make(url.Values)
reqParams.Set("response-content-disposition", "attachment; filename=\"your-filename.txt\"")

// Generates a presigned url which expires in a day.
presignedURL, err := minioClient.PresignedHeadObject("mybucket", "myobject", time.Second * 24 * 60 * 60, reqParams)
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Successfully generated presigned URL", presignedURL)
```

<a name="PresignedPostPolicy"></a>
### PresignedPostPolicy(PostPolicy) (*url.URL, map[string]string, error)
Allows setting policy conditions to a presigned URL for POST operations. Policies such as bucket name to receive object uploads, key name prefixes, expiry policy may be set.

```go
// Initialize policy condition config.
policy := minio.NewPostPolicy()

// Apply upload policy restrictions:
policy.SetBucket("mybucket")
policy.SetKey("myobject")
policy.SetExpires(time.Now().UTC().AddDate(0, 0, 10)) // expires in 10 days

// Only allow 'png' images.
policy.SetContentType("image/png")

// Only allow content size in range 1KB to 1MB.
policy.SetContentLengthRange(1024, 1024*1024)

// Add a user metadata using the key "custom" and value "user"
policy.SetUserMetadata("custom", "user")

// Get the POST form key/value object:
url, formData, err := minioClient.PresignedPostPolicy(policy)
if err != nil {
    fmt.Println(err)
    return
}

// POST your content from the command line using `curl`
fmt.Printf("curl ")
for k, v := range formData {
    fmt.Printf("-F %s=%s ", k, v)
}
fmt.Printf("-F file=@/etc/bash.bashrc ")
fmt.Printf("%s\n", url)
```

## 6. Bucket policy/notification operations

<a name="SetBucketPolicy"></a>
### SetBucketPolicy(bucketname, objectPrefix string, policy policy.BucketPolicy) error
Set access permissions on bucket or an object prefix.

Importing `github.com/minio/minio-go/pkg/policy` package is needed.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName` | _string_  |Name of the bucket|
|`objectPrefix` | _string_  |Name of the object prefix|
|`policy` | _policy.BucketPolicy_  |Policy can be one of the following, |
| |  | _policy.BucketPolicyNone_ |
| |  | _policy.BucketPolicyReadOnly_ |
| |  | _policy.BucketPolicyReadWrite_ |
| |  | _policy.BucketPolicyWriteOnly_ |


__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`err` | _error_  |Standard Error   |


__Example__


```go
// Sets 'mybucket' with a sub-directory 'myprefix' to be anonymously accessible for
// both read and write operations.
err = minioClient.SetBucketPolicy("mybucket", "myprefix", policy.BucketPolicyReadWrite)
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="GetBucketPolicy"></a>
### GetBucketPolicy(bucketName, objectPrefix string) (policy.BucketPolicy, error)
Get access permissions on a bucket or a prefix.

Importing `github.com/minio/minio-go/pkg/policy` package is needed.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |
|`objectPrefix` | _string_  |Prefix matching objects under the bucket  |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketPolicy`  | _policy.BucketPolicy_ |string that contains: `none`, `readonly`, `readwrite`, or `writeonly`   |
|`err` | _error_  |Standard Error  |

__Example__


```go
bucketPolicy, err := minioClient.GetBucketPolicy("mybucket", "")
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println("Access permissions for mybucket is", bucketPolicy)
```

<a name="ListBucketPolicies"></a>
### ListBucketPolicies(bucketName, objectPrefix string) (map[string]BucketPolicy, error)
Get access permissions rules associated to the specified bucket and prefix.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket  |
|`objectPrefix` | _string_  |Prefix matching objects under the bucket  |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketPolicies`  | _map[string]minio.BucketPolicy_ |Map of object resource paths and their permissions  |
|`err` | _error_  |Standard Error  |

__Example__


```go
bucketPolicies, err := minioClient.ListBucketPolicies("mybucket", "")
if err != nil {
    fmt.Println(err)
    return
}
for resource, permission := range bucketPolicies {
    fmt.Println(resource, " => ", permission)
}
```

<a name="GetBucketNotification"></a>
### GetBucketNotification(bucketName string) (BucketNotification, error)
Get notification configuration on a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketNotification`  | _minio.BucketNotification_ |structure which holds all notification configurations|
|`err` | _error_  |Standard Error  |

__Example__


```go
bucketNotification, err := minioClient.GetBucketNotification("mybucket")
if err != nil {
    fmt.Println("Failed to get bucket notification configurations for mybucket", err)
    return
}

for _, queueConfig := range bucketNotification.QueueConfigs {
    for _, e := range queueConfig.Events {
        fmt.Println(e + " event is enabled")
    }
}
```

<a name="SetBucketNotification"></a>
### SetBucketNotification(bucketName string, bucketNotification BucketNotification) error
Set a new bucket notification on a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |
|`bucketNotification`  | _minio.BucketNotification_  |Represents the XML to be sent to the configured web service  |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`err` | _error_  |Standard Error  |

__Example__


```go
queueArn := minio.NewArn("aws", "sqs", "us-east-1", "804605494417", "PhotoUpdate")

queueConfig := minio.NewNotificationConfig(queueArn)
queueConfig.AddEvents(minio.ObjectCreatedAll, minio.ObjectRemovedAll)
queueConfig.AddFilterPrefix("photos/")
queueConfig.AddFilterSuffix(".jpg")

bucketNotification := minio.BucketNotification{}
bucketNotification.AddQueue(queueConfig)

err = minioClient.SetBucketNotification("mybucket", bucketNotification)
if err != nil {
    fmt.Println("Unable to set the bucket notification: ", err)
    return
}
```

<a name="RemoveAllBucketNotification"></a>
### RemoveAllBucketNotification(bucketName string) error
Remove all configured bucket notifications on a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |Name of the bucket   |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`err` | _error_  |Standard Error  |

__Example__


```go
err = minioClient.RemoveAllBucketNotification("mybucket")
if err != nil {
    fmt.Println("Unable to remove bucket notifications.", err)
    return
}
```

<a name="ListenBucketNotification"></a>
### ListenBucketNotification(bucketName, prefix, suffix string, events []string, doneCh <-chan struct{}) <-chan NotificationInfo
ListenBucketNotification API receives bucket notification events through the notification channel. The returned notification channel has two fields 'Records' and 'Err'.

- 'Records' holds the notifications received from the server.
- 'Err' indicates any error while processing the received notifications.

NOTE: Notification channel is closed at the first occurrence of an error.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  | Bucket to listen notifications on   |
|`prefix`  | _string_ | Object key prefix to filter notifications for  |
|`suffix`  | _string_ | Object key suffix to filter notifications for  |
|`events`  | _[]string_ | Enables notifications for specific event types |
|`doneCh`  | _chan struct{}_ | A message on this channel ends the ListenBucketNotification iterator  |

__Return Values__

|Param   |Type   |Description   |
|:---|:---| :---|
|`notificationInfo` | _chan minio.NotificationInfo_ | Channel of bucket notifications |

__minio.NotificationInfo__

|Field   |Type   |Description   |
|`notificationInfo.Records` | _[]minio.NotificationEvent_ | Collection of notification events |
|`notificationInfo.Err` | _error_ | Carries any error occurred during the operation (Standard Error) |


__Example__


```go
// Create a done channel to control 'ListenBucketNotification' go routine.
doneCh := make(chan struct{})

// Indicate a background go-routine to exit cleanly upon return.
defer close(doneCh)

// Listen for bucket notifications on "mybucket" filtered by prefix, suffix and events.
for notificationInfo := range minioClient.ListenBucketNotification("mybucket", "myprefix/", ".mysuffix", []string{
    "s3:ObjectCreated:*",
    "s3:ObjectAccessed:*",
    "s3:ObjectRemoved:*",
    }, doneCh) {
    if notificationInfo.Err != nil {
        fmt.Println(notificationInfo.Err)
    }
    fmt.Println(notificationInfo)
}
```

## 7. Client custom settings

<a name="SetAppInfo"></a>
### SetAppInfo(appName, appVersion string)
Add custom application details to User-Agent.

__Parameters__

| Param  | Type  | Description  |
|---|---|---|
|`appName`  | _string_  | Name of the application performing the API requests. |
| `appVersion`| _string_ | Version of the application performing the API requests. |


__Example__


```go
// Set Application name and version to be used in subsequent API requests.
minioClient.SetAppInfo("myCloudApp", "1.0.0")
```

<a name="SetCustomTransport"></a>
### SetCustomTransport(customHTTPTransport http.RoundTripper)
Overrides default HTTP transport. This is usually needed for debugging or for adding custom TLS certificates.

__Parameters__

| Param  | Type  | Description  |
|---|---|---|
|`customHTTPTransport`  | _http.RoundTripper_  | Custom transport e.g, to trace API requests and responses for debugging purposes.|


<a name="TraceOn"></a>
### TraceOn(outputStream io.Writer)
Enables HTTP tracing. The trace is written to the io.Writer provided. If outputStream is nil, trace is written to os.Stdout.

__Parameters__

| Param  | Type  | Description  |
|---|---|---|
|`outputStream`  | _io.Writer_  | HTTP trace is written into outputStream.|


<a name="TraceOff"></a>
### TraceOff()
Disables HTTP tracing.

<a name="SetS3TransferAccelerate"></a>
### SetS3TransferAccelerate(acceleratedEndpoint string)
Set AWS S3 transfer acceleration endpoint for all API requests hereafter.
NOTE: This API applies only to AWS S3 and is a no operation for S3 compatible object storage services.

__Parameters__

| Param  | Type  | Description  |
|---|---|---|
|`acceleratedEndpoint`  | _string_  | Set to new S3 transfer acceleration endpoint.|


## 8. Explore Further

- [Build your own Go Music Player App example](https://docs.minio.io/docs/go-music-player-app)
