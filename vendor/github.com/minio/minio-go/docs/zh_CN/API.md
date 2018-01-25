# Minio Go Client API文档 [![Slack](https://slack.minio.io/slack?type=svg)](https://slack.minio.io)

## 初使化Minio Client对象。

##  Minio

```go
package main

import (
    "fmt"

    "github.com/minio/minio-go"
)

func main() {
        // 使用ssl
        ssl := true

        // 初使化minio client对象。
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
        // 使用ssl
        ssl := true

        // 初使化minio client对象。
        s3Client, err := minio.New("s3.amazonaws.com", "YOUR-ACCESSKEYID", "YOUR-SECRETACCESSKEY", ssl)
        if err != nil {
                fmt.Println(err)
                return
        }
}
```

| 操作存储桶                                 | 操作对象                                  | 操作加密对象                 | Presigned操作                          | 存储桶策略/通知                         | 客户端自定义设置 |
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
## 1. 构造函数
<a name="Minio"></a>

### New(endpoint, accessKeyID, secretAccessKey string, ssl bool) (*Client, error)
初使化一个新的client对象。

__参数__

|参数   | 类型   |描述   |
|:---|:---| :---|
|`endpoint`   | _string_  |S3兼容对象存储服务endpoint   |
|`accessKeyID`  |_string_   |对象存储的Access key |
|`secretAccessKey`  | _string_  |对象存储的Secret key |
|`ssl`   | _bool_  |true代表使用HTTPS |

### NewWithRegion(endpoint, accessKeyID, secretAccessKey string, ssl bool, region string) (*Client, error)
初使化minio client,带有region配置。和New()不同的是，NewWithRegion避免了bucket-location操作，所以会快那么一丢丢。如果你的应用只使用一个region的话可以用这个方法。

__参数__

|参数   |类型   |描述   |
|:---|:---| :---|
|`endpoint`   | _string_  |S3兼容对象存储服务endpoint |
|`accessKeyID`  |_string_   |对象存储的Access key |
|`secretAccessKey`  | _string_  |对象存储的Secret key |
|`ssl` | _bool_  |true代表使用HTTPS |
|`region`| _string_ | 对象存储的region |

## 2. 操作存储桶

<a name="MakeBucket"></a>
### MakeBucket(bucketName, location string) error
创建一个存储桶。

__参数__

| 参数  | 类型  | 描述  |
|---|---|---|
|`bucketName`  | _string_  | 存储桶名称 |
| `location`  |  _string_ | 存储桶被创建的region(地区)，默认是us-east-1(美国东一区)，下面列举的是其它合法的值。注意：如果用的是minio服务的话，resion是在它的配置文件中，（默认是us-east-1）。|
| | |us-east-1 |
| | |us-west-1 |
| | |us-west-2 |
| | |eu-west-1 |
| | | eu-central-1|
| | | ap-southeast-1|
| | | ap-northeast-1|
| | | ap-southeast-2|
| | | sa-east-1|


__示例__


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
列出所有的存储桶。

| 参数  | 类型   | 描述  |
|---|---|---|
|`bucketList`  | _[]minio.BucketInfo_  | 所有存储桶的list。 |


__minio.BucketInfo__

| 参数  | 类型   | 描述  |
|---|---|---|
|`bucket.Name`  | _string_  | 存储桶名称 |
|`bucket.CreationDate`  | _time.Time_  | 存储桶的创建时间 |


__示例__


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
检查存储桶是否存在。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称 |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`found`  | _bool_ | 存储桶是否存在  |
|`err` | _error_  | 标准Error  |


__示例__


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
删除一个存储桶，存储桶必须为空才能被成功删除。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |

__示例__


```go
err = minioClient.RemoveBucket("mybucket")
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="ListObjects"></a>
### ListObjects(bucketName, prefix string, recursive bool, doneCh chan struct{}) <-chan ObjectInfo
列举存储桶里的对象。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName` | _string_  |存储桶名称   |
|`objectPrefix` |_string_   | 要列举的对象前缀 |
|`recursive`  | _bool_  |`true`代表递归查找，`false`代表类似文件夹查找，以'/'分隔，不查子文件夹。  |
|`doneCh`  | _chan struct{}_ | 在该channel上结束ListObjects iterator的一个message。 |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`objectInfo`  | _chan minio.ObjectInfo_ |存储桶中所有对象的read channel，对象的格式如下： |

__minio.ObjectInfo__

|属性   |类型   |描述   |
|:---|:---| :---|
|`objectInfo.Key`  | _string_ |对象的名称 |
|`objectInfo.Size`  | _int64_ |对象的大小 |
|`objectInfo.ETag`  | _string_ |对象的MD5校验码 |
|`objectInfo.LastModified`  | _time.Time_ |对象的最后修改时间 |


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
使用listing API v2版本列举存储桶中的对象。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称 |
| `objectPrefix` |_string_   | 要列举的对象前缀 |
| `recursive`  | _bool_  |`true`代表递归查找，`false`代表类似文件夹查找，以'/'分隔，不查子文件夹。  |
|`doneCh`  | _chan struct{}_ | 在该channel上结束ListObjects iterator的一个message。  |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`objectInfo`  | _chan minio.ObjectInfo_ |存储桶中所有对象的read channel |


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
列举存储桶中未完整上传的对象。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称 |
| `prefix` |_string_   | 不完整上传的对象的前缀 |
| `recursive`  | _bool_  |`true`代表递归查找，`false`代表类似文件夹查找，以'/'分隔，不查子文件夹。 |
|`doneCh`  | _chan struct{}_ | 在该channel上结束ListIncompleteUploads iterator的一个message。   |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`multiPartInfo`  | _chan minio.ObjectMultipartInfo_  |multipart对象格式如下： |

__minio.ObjectMultipartInfo__

|属性   |类型   |描述   |
|:---|:---| :---|
|`multiPartObjInfo.Key`  | _string_  |未完整上传的对象的名称 |
|`multiPartObjInfo.UploadID` | _string_ |未完整上传的对象的Upload ID |
|`multiPartObjInfo.Size` | _int64_ |未完整上传的对象的大小 |

__示例__


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

## 3. 操作对象

<a name="GetObject"></a>
### GetObject(bucketName, objectName string, opts GetObjectOptions) (*Object, error)
返回对象数据的流，error是读流时经常抛的那些错。


__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称  |
|`opts` | _minio.GetObjectOptions_ | GET请求的一些额外参数，像encryption，If-Match |


__minio.GetObjectOptions__

|参数 | 类型 | 描述 |
|:---|:---|:---|
| `opts.Materials` | _encrypt.Materials_ | `encrypt`包提供的对流加密的接口，(更多信息，请看https://godoc.org/github.com/minio/minio-go) |

__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`object`  | _*minio.Object_ |_minio.Object_代表了一个object reader。它实现了io.Reader, io.Seeker, io.ReaderAt and io.Closer接口。 |


__示例__


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
下载并将文件保存到本地文件系统。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称 |
|`objectName` | _string_  |对象的名称  |
|`filePath` | _string_  |下载后保存的路径 |
|`opts` | _minio.GetObjectOptions_ | GET请求的一些额外参数，像encryption，If-Match |


__示例__


```go
err = minioClient.FGetObject("mybucket", "myobject", "/tmp/myobject", minio.GetObjectOptions{})
if err != nil {
    fmt.Println(err)
    return
}
```
<a name="GetObjectWithContext"></a>
### GetObjectWithContext(ctx context.Context, bucketName, objectName string, opts GetObjectOptions) (*Object, error)
和GetObject操作是一样的，不过传入了取消请求的context。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |请求上下文（Request context） |
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称  |
|`opts` | _minio.GetObjectOptions_ |  GET请求的一些额外参数，像encryption，If-Match |


__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`object`  | _*minio.Object_ |_minio.Object_代表了一个object reader。它实现了io.Reader, io.Seeker, io.ReaderAt and io.Closer接口。 |


__示例__


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
和FGetObject操作是一样的，不过允许取消请求。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |请求上下文 |
|`bucketName`  | _string_  |存储桶名称 |
|`objectName` | _string_  |对象的名称  |
|`filePath` | _string_  |下载后保存的路径 |
|`opts` | _minio.GetObjectOptions_ | GET请求的一些额外参数，像encryption，If-Match  |


__示例__


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
和FGetObject操作是一样的，不过会对加密请求进行解密。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称 |
|`objectName` | _string_  |对象的名称  |
|`filePath` | _string_  |下载后保存的路径|
|`materials` | _encrypt.Materials_ | `encrypt`包提供的对流加密的接口，(更多信息，请看https://godoc.org/github.com/minio/minio-go) |


__示例__


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
当对象小于64MiB时，直接在一次PUT请求里进行上传。当大于64MiB时，根据文件的实际大小，PutObject会自动地将对象进行拆分成64MiB一块或更大一些进行上传。对象的最大大小是5TB。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称   |
|`reader` | _io.Reader_  |任意实现了io.Reader的GO类型 |
|`objectSize`| _int64_ |上传的对象的大小，-1代表未知。 |
|`opts` | _minio.PutObjectOptions_  |  允许用户设置可选的自定义元数据，内容标题，加密密钥和用于分段上传操作的线程数量。 |

__minio.PutObjectOptions__

|属性 | 类型 | 描述 |
|:--- |:--- | :--- |
| `opts.UserMetadata` | _map[string]string_ | 用户元数据的Map|
| `opts.Progress` | _io.Reader_ | 获取上传进度的Reader |
| `opts.ContentType` | _string_ | 对象的Content type， 例如"application/text" |
| `opts.ContentEncoding` | _string_ | 对象的Content encoding，例如"gzip" |
| `opts.ContentDisposition` | _string_ | 对象的Content disposition, "inline" |
| `opts.CacheControl` | _string_ | 指定针对请求和响应的缓存机制，例如"max-age=600"|
| `opts.EncryptMaterials` | _encrypt.Materials_ | `encrypt`包提供的对流加密的接口，(更多信息，请看https://godoc.org/github.com/minio/minio-go) |


__示例__


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

API方法在minio-go SDK版本v3.0.3中提供的PutObjectWithSize，PutObjectWithMetadata，PutObjectStreaming和PutObjectWithProgress被替换为接受指向PutObjectOptions struct的指针的新的PutObject调用变体。

<a name="PutObjectWithContext"></a>
### PutObjectWithContext(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, opts PutObjectOptions) (n int, err error)
和PutObject是一样的，不过允许取消请求。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |请求上下文 |
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称   |
|`reader` | _io.Reader_  |任何实现io.Reader的Go类型 |
|`objectSize`| _int64_ | 上传的对象的大小，-1代表未知 |
|`opts` | _minio.PutObjectOptions_  |允许用户设置可选的自定义元数据，content-type，content-encoding，content-disposition以及cache-control headers，传递加密模块以加密对象，并可选地设置multipart put操作的线程数量。|


__示例__


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
通过在服务端对已存在的对象进行拷贝，实现新建或者替换对象。它支持有条件的拷贝，拷贝对象的一部分，以及在服务端的加解密。请查看`SourceInfo`和`DestinationInfo`两个类型来了解更多细节。 

拷贝多个源文件到一个目标对象，请查看`ComposeObject` API。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`dst`  | _minio.DestinationInfo_  |目标对象 |
|`src` | _minio.SourceInfo_  |源对象 |


__示例__


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
通过使用服务端拷贝实现钭多个源对象合并创建成一个新的对象。

__参数__


|参数   |类型   |描述   |
|:---|:---|:---|
|`dst`  | _minio.DestinationInfo_  |要被创建的目标对象 |
|`srcs` | _[]minio.SourceInfo_  |要合并的多个源对象 |


__示例__


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
构建一个可用于服务端拷贝操作（像`CopyObject`和`ComposeObject`）的`SourceInfo`对象。该对象可用于给源对象设置拷贝条件。

__参数__

| 参数         | 类型             | 描述                                                      |
| :---          | :---             | :---                                                             |
| `bucket`      | _string_         | 源存储桶                                       |
| `object`      | _string_         | 源对象                                     |
| `decryptSSEC` | _*minio.SSEInfo_ | 源对象的解密信息 (`nil`代表不用解密) |

__示例__

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
构建一个用于服务端拷贝操作（像`CopyObject`和`ComposeObject`）的用作目标对象的`DestinationInfo`。

__参数__

| 参数         | 类型                | 描述                                                                                                    |
| :---          | :---                | :---                                                                                                           |
| `bucket`      | _string_            | 目标存储桶名称                                                                                 |
| `object`      | _string_            | 目标对象名称                                                                                |
| `encryptSSEC` | _*minio.SSEInfo_    | 源对象的加密信息 (`nil`代表不用加密)                                               |
| `userMeta`    | _map[string]string_ | 给目标对象的用户元数据，如果是nil,并只有一个源对象，则将源对象的用户元数据拷贝给目标对象。|

__示例__

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
将filePath对应的文件内容上传到一个对象中。

当对象小于64MiB时，FPutObject直接在一次PUT请求里进行上传。当大于64MiB时，根据文件的实际大小，FPutObject会自动地将对象进行拆分成64MiB一块或更大一些进行上传。对象的最大大小是5TB。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称 |
|`filePath` | _string_  |要上传的文件的路径 |
|`opts` | _minio.PutObjectOptions_  |允许用户设置可选的自定义元数据，content-type，content-encoding，content-disposition以及cache-control headers，传递加密模块以加密对象，并可选地设置multipart put操作的线程数量。 |


__示例__


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
和FPutObject操作是一样的，不过允许取消请求。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`ctx`  | _context.Context_  |请求上下文  |
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称 |
|`filePath` | _string_  |要上传的文件的路径 |
|`opts` | _minio.PutObjectOptions_  |允许用户设置可选的自定义元数据，content-type，content-encoding，content-disposition以及cache-control headers，传递加密模块以加密对象，并可选地设置multipart put操作的线程数量。 |

__示例__


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
获取对象的元数据。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称   |
|`opts` | _minio.StatObjectOptions_ | GET info/stat请求的一些额外参数，像encryption，If-Match |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`objInfo`  | _minio.ObjectInfo_  |对象stat信息 |


__minio.ObjectInfo__

|属性   |类型   |描述   |
|:---|:---| :---|
|`objInfo.LastModified`  | _time.Time_  |对象的最后修改时间 |
|`objInfo.ETag` | _string_ |对象的MD5校验码|
|`objInfo.ContentType` | _string_ |对象的Content type|
|`objInfo.Size` | _int64_ |对象的大小|


__示例__


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
删除一个对象。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称 |


```go
err = minioClient.RemoveObject("mybucket", "myobject")
if err != nil {
    fmt.Println(err)
    return
}
```

<a name="RemoveObjects"></a>
### RemoveObjects(bucketName string, objectsCh chan string) (errorCh <-chan RemoveObjectError)

从一个input channel里删除一个对象集合。一次发送到服务端的删除请求最多可删除1000个对象。通过error channel返回的错误信息。

__参数__

|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectsCh` | _chan string_  | 要删除的对象的channel   |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`errorCh` | _<-chan minio.RemoveObjectError_  | 删除时观察到的错误的Receive-only channel。 |


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
删除一个未完整上传的对象。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |
|`objectName` | _string_  |对象的名称   |

__示例__


```go
err = minioClient.RemoveIncompleteUpload("mybucket", "myobject")
if err != nil {
    fmt.Println(err)
    return
}
```

## 4. 操作加密对象

<a name="NewSymmetricKey"></a>
### NewSymmetricKey(key []byte) *encrypt.SymmetricKey

__参数__

|参数   |类型   |描述   |
|:---|:---| :---|
|`key`  | _string_  |存储桶名称  |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`symmetricKey`  | _*encrypt.SymmetricKey_ | 加密解密的对称秘钥 |

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

__参数__

|参数   |类型   |描述   |
|:---|:---| :---|
|`privateKey` | _[]byte_ | Private key数据  |
|`publicKey`  | _[]byte_ | Public key数据  |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`asymmetricKey`  | _*encrypt.AsymmetricKey_ | 加密解密的非对称秘钥 |
|`err`  | _error_ |  标准Error |


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

返回对象的解密流。读流时的常见错误。

__参数__

|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  | 存储桶名称  |
|`objectName` | _string_  | 对象的名称  |
|`encryptMaterials` | _encrypt.Materials_ | `encrypt`包提供的对流加密的接口，(更多信息，请看https://godoc.org/github.com/minio/minio-go) |


__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`stream`  | _io.ReadCloser_ | 返回对象的reader,调用者需要在读取之后进行关闭。 |
|`err`  | _error | 错误信息 |


__示例__


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
加密并上传对象。

__参数__

|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称   |
|`reader` | _io.Reader_  |任何实现io.Reader的Go类型 |
|`encryptMaterials` | _encrypt.Materials_  | `encrypt`包提供的对流加密的接口，(更多信息，请看https://godoc.org/github.com/minio/minio-go) |

__示例__

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
通过一个文件进行加密并上传到对象。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectName` | _string_  |对象的名称 |
|`filePath` | _string_  |要上传的文件的路径 |
|`encryptMaterials` | _encrypt.Materials_  | `encrypt`包提供的对流加密的接口，(更多信息，请看https://godoc.org/github.com/minio/minio-go) |

__示例__


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
创建一个通过用户提供的key(SSE-C),进行服务端加解密操作的key对象。

__参数__

| 参数  | 类型     | 描述                                                                                          |
| :---   | :---     | :---                                                                                                 |
| `key`  | _[]byte_ | 未编码的二进制key数组                                                        |
| `algo` | _string_ | 加密算法，可以为空（默认是`AES256`） |


## 5. Presigned操作

<a name="PresignedGetObject"></a>
### PresignedGetObject(bucketName, objectName string, expiry time.Duration, reqParams url.Values) (*url.URL, error)
生成一个用于HTTP GET操作的presigned URL。浏览器/移动客户端可以在即使存储桶为私有的情况下也可以通过这个URL进行下载。这个presigned URL可以有一个过期时间，默认是7天。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |
|`objectName` | _string_  |对象的名称   |
|`expiry` | _time.Duration_  |presigned URL的过期时间，单位是秒   |
|`reqParams` | _url.Values_  |额外的响应头，支持_response-expires_， _response-content-type_， _response-cache-control_， _response-content-disposition_。  |


__示例__


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
生成一个用于HTTP GET操作的presigned URL。浏览器/移动客户端可以在即使存储桶为私有的情况下也可以通过这个URL进行下载。这个presigned URL可以有一个过期时间，默认是7天。

注意：你可以通过只指定对象名称上传到S3。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |
|`objectName` | _string_  |对象的名称   |
|`expiry` | _time.Duration_  |presigned URL的过期时间，单位是秒 |


__示例__


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
生成一个用于HTTP GET操作的presigned URL。浏览器/移动客户端可以在即使存储桶为私有的情况下也可以通过这个URL进行下载。这个presigned URL可以有一个过期时间，默认是7天。

__参数__

|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |
|`objectName` | _string_  |对象的名称   |
|`expiry` | _time.Duration_  |presigned URL的过期时间，单位是秒   |
|`reqParams` | _url.Values_  |额外的响应头，支持_response-expires_， _response-content-type_， _response-cache-control_， _response-content-disposition_。  |


__示例__


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
允许给POST操作的presigned URL设置策略条件。这些策略包括比如，接收对象上传的存储桶名称，名称前缀，过期策略。

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

## 6. 存储桶策略/通知

<a name="SetBucketPolicy"></a>
### SetBucketPolicy(bucketname, objectPrefix string, policy policy.BucketPolicy) error
给存储桶或者对象前缀设置访问权限。

必须引入`github.com/minio/minio-go/pkg/policy`包。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName` | _string_  |存储桶名称|
|`objectPrefix` | _string_  |对象的名称前缀|
|`policy` | _policy.BucketPolicy_  |Policy的取值如下： |
| |  | _policy.BucketPolicyNone_ |
| |  | _policy.BucketPolicyReadOnly_ |
| |  | _policy.BucketPolicyReadWrite_ |
| |  | _policy.BucketPolicyWriteOnly_ |


__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`err` | _error_  |标准Error   |


__示例__


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
获取存储桶或者对象前缀的访问权限。

必须引入`github.com/minio/minio-go/pkg/policy`包。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |
|`objectPrefix` | _string_  |该存储桶下的对象前缀 |

__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketPolicy`  | _policy.BucketPolicy_ |取值如下： `none`, `readonly`, `readwrite`,或者`writeonly`   |
|`err` | _error_  |标准Error  |

__示例__


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
获取指定的存储桶和前缀的访问策略。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称  |
|`objectPrefix` | _string_  |该存储桶下的对象前缀  |

__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketPolicies`  | _map[string]minio.BucketPolicy_ |对象以及它们的权限的Map  |
|`err` | _error_  |标准Error  |

__示例__


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
获取存储桶的通知配置

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称 |

__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketNotification`  | _minio.BucketNotification_ |含有所有通知配置的数据结构|
|`err` | _error_  |标准Error  |

__示例__


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
给存储桶设置新的通知

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |
|`bucketNotification`  | _minio.BucketNotification_  |发送给配置的web service的XML  |

__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`err` | _error_  |标准Error  |

__示例__


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
删除存储桶上所有配置的通知

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  |存储桶名称   |

__返回值__


|参数   |类型   |描述   |
|:---|:---| :---|
|`err` | _error_  |标准Error  |

__示例__


```go
err = minioClient.RemoveAllBucketNotification("mybucket")
if err != nil {
    fmt.Println("Unable to remove bucket notifications.", err)
    return
}
```

<a name="ListenBucketNotification"></a>
### ListenBucketNotification(bucketName, prefix, suffix string, events []string, doneCh <-chan struct{}) <-chan NotificationInfo
ListenBucketNotification API通过notification channel接收存储桶通知事件。返回的notification channel有两个属性，'Records'和'Err'。

- 'Records'持有从服务器返回的通知信息。
- 'Err'表示的是处理接收到的通知时报的任何错误。

注意：一旦报错，notification channel就会关闭。

__参数__


|参数   |类型   |描述   |
|:---|:---| :---|
|`bucketName`  | _string_  | 被监听通知的存储桶   |
|`prefix`  | _string_ | 过滤通知的对象前缀  |
|`suffix`  | _string_ | 过滤通知的对象后缀  |
|`events`  | _[]string_ | 开启指定事件类型的通知 |
|`doneCh`  | _chan struct{}_ | 在该channel上结束ListenBucketNotification iterator的一个message。  |

__返回值__

|参数   |类型   |描述   |
|:---|:---| :---|
|`notificationInfo` | _chan minio.NotificationInfo_ | 存储桶通知的channel |

__minio.NotificationInfo__

|属性   |类型   |描述   |
|`notificationInfo.Records` | _[]minio.NotificationEvent_ | 通知事件的集合 |
|`notificationInfo.Err` | _error_ | 操作时报的任何错误(标准Error) |


__示例__


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

## 7. 客户端自定义设置

<a name="SetAppInfo"></a>
### SetAppInfo(appName, appVersion string)
给User-Agent添加的自定义应用信息。

__参数__

| 参数  | 类型  | 描述  |
|---|---|---|
|`appName`  | _string_  | 发请求的应用名称 |
| `appVersion`| _string_ | 发请求的应用版本 |


__示例__


```go
// Set Application name and version to be used in subsequent API requests.
minioClient.SetAppInfo("myCloudApp", "1.0.0")
```

<a name="SetCustomTransport"></a>
### SetCustomTransport(customHTTPTransport http.RoundTripper)
重写默认的HTTP transport，通常用于调试或者添加自定义的TLS证书。

__参数__

| 参数  | 类型  | 描述  |
|---|---|---|
|`customHTTPTransport`  | _http.RoundTripper_  | 自定义的transport，例如：为了调试对API请求响应进行追踪。|


<a name="TraceOn"></a>
### TraceOn(outputStream io.Writer)
开启HTTP tracing。追踪信息输出到io.Writer，如果outputstream为nil，则trace写入到os.Stdout标准输出。

__参数__

| 参数  | 类型  | 描述  |
|---|---|---|
|`outputStream`  | _io.Writer_  | HTTP trace写入到outputStream |


<a name="TraceOff"></a>
### TraceOff()
关闭HTTP tracing。

<a name="SetS3TransferAccelerate"></a>
### SetS3TransferAccelerate(acceleratedEndpoint string)
给后续所有API请求设置ASW S3传输加速endpoint。
注意：此API仅对AWS S3有效，对其它S3兼容的对象存储服务不生效。

__参数__

| 参数  | 类型  | 描述  |
|---|---|---|
|`acceleratedEndpoint`  | _string_  | 设置新的S3传输加速endpoint。|


## 8. 了解更多

- [用Go语言创建属于你的音乐播放器APP示例](https://docs.minio.io/docs/go-music-player-app)
