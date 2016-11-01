# Golang Client API Reference [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/Minio/minio?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

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

| Bucket operations  |Object operations   | Presigned operations  | Bucket Policy/Notification Operations |
|:---|:---|:---|:---|
|[`MakeBucket`](#MakeBucket)   |[`GetObject`](#GetObject)   | [`PresignedGetObject`](#PresignedGetObject)  |[`SetBucketPolicy`](#SetBucketPolicy)   |
|[`ListBuckets`](#ListBuckets)   |[`PutObject`](#PutObject)   |[`PresignedPutObject`](#PresignedPutObject)   | [`GetBucketPolicy`](#GetBucketPolicy)  |
|[`BucketExists`](#BucketExists)   |[`CopyObject`](#CopyObject)   |[`PresignedPostPolicy`](#PresignedPostPolicy)   |  [`ListBucketPolicies`](#ListBucketPolicies)  |
| [`RemoveBucket`](#RemoveBucket)  |[`StatObject`](#StatObject)   |   |  [`SetBucketNotification`](#SetBucketNotification)  |
|[`ListObjects`](#ListObjects)   |[`RemoveObject`](#RemoveObject)   |   |  [`GetBucketNotification`](#GetBucketNotification)   |
|[`ListObjectsV2`](#ListObjectsV2) | [`RemoveObjects`](#RemoveObjects) |   | [`RemoveAllBucketNotification`](#RemoveAllBucketNotification)  |
|[`ListIncompleteUploads`](#ListIncompleteUploads) | [`RemoveIncompleteUpload`](#RemoveIncompleteUpload) |   |  [`ListenBucketNotification`](#ListenBucketNotification)  |
|   | [`FPutObject`](#FPutObject)  |   |   |
|   | [`FGetObject`](#FGetObject)  |   |   |

## 1. Constructor
<a name="Minio"></a>

### New(endpoint string, accessKeyID string, secretAccessKey string, ssl bool) (*Client, error)
Initializes a new client object.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`endpoint`   | _string_  |S3 object storage endpoint.   |
| `accessKeyID`  |_string_   | Access key for the object storage endpoint.  |
| `secretAccessKey`  | _string_  |Secret key for the object storage endpoint.   |
|`ssl`   | _bool_  | Set this value to 'true' to enable secure (HTTPS) access.  |


## 2. Bucket operations

<a name="MakeBucket"></a>
### MakeBucket(bucketName string, location string) error
Creates a new bucket.


__Parameters__

| Param  | Type  | Description  |
|---|---|---|
|`bucketName`  | _string_  | Name of the bucket. | 
| `location`  |  _string_ | Default value is us-east-1 Region where the bucket is created. Valid values are listed below:|
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

err := minioClient.MakeBucket("mybucket", "us-east-1")
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
|`bucketList`  | _[]BucketInfo_  | Lists bucket in following format shown below: | 


| Param  | Type  | Description  |
|---|---|---|
|`bucket.Name`  | _string_  | bucket name. | 
|`bucket.CreationDate`  | _time.Time_  | date when bucket was created. | 


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
|`bucketName`  | _string_  |name of the bucket.   |


__Return Values__

|Param   |Type   |Description   |
|:---|:---| :---|
|`found`  | _bool_ | indicates whether bucket exists or not  |
|`err` | _error_  | standard error  |


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

Removes a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |

__Example__


```go

err := minioClient.RemoveBucket("mybucket")
if err != nil {
    fmt.Println(err)
    return
}

```

<a name="ListObjects"></a>
### ListObjects(bucketName string, prefix string, recursive bool, doneCh chan struct{}) <-chan ObjectInfo

Lists objects in a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
| `objectPrefix` |_string_   | the prefix of the objects that should be listed. |
| `recursive`  | _bool_  |`true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'.  |
|`doneCh`  | _chan struct{}_ | Set this value to 'true' to enable secure (HTTPS) access.  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`chan ObjectInfo`  | _chan ObjectInfo_ |Read channel for all the objects in the bucket, the object is of the format listed below: |

|Param   |Type   |Description   |
|:---|:---| :---|
|`objectInfo.Key`  | _string_ |name of the object. |
|`objectInfo.Size`  | _int64_ |size of the object. |
|`objectInfo.ETag`  | _string_ |etag of the object. |
|`objectInfo.LastModified`  | _time.Time_ |modified time stamp. |


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
### ListObjectsV2(bucketName string, prefix string, recursive bool, doneCh chan struct{}) <-chan ObjectInfo

Lists objects in a bucket using the recommanded listing API v2 

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
| `objectPrefix` |_string_   | the prefix of the objects that should be listed. |
| `recursive`  | _bool_  |`true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'.  |
|`doneCh`  | _chan struct{}_ | Set this value to 'true' to enable secure (HTTPS) access.  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`chan ObjectInfo`  | _chan ObjectInfo_ |Read channel for all the objects in the bucket, the object is of the format listed below: |

|Param   |Type   |Description   |
|:---|:---| :---|
|`objectInfo.Key`  | _string_ |name of the object. |
|`objectInfo.Size`  | _int64_ |size of the object. |
|`objectInfo.ETag`  | _string_ |etag of the object. |
|`objectInfo.LastModified`  | _time.Time_ |modified time stamp. |


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
### ListIncompleteUploads(bucketName string, prefix string, recursive bool, doneCh chan struct{}) <- chan ObjectMultipartInfo

Lists partially uploaded objects in a bucket.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
| `prefix` |_string_   | prefix of the object names that are partially uploaded |
| `recursive`  | _bool_  |`true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'.  |
|`doneCh`  | _chan struct{}_ | Set this value to 'true' to enable secure (HTTPS) access.  |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`chan ObjectMultipartInfo`  | _chan ObjectMultipartInfo_  |emits multipart objects of the format listed below: |

__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`multiPartObjInfo.Key`  | _string_  |name of the incomplete object. |
|`multiPartObjInfo.UploadID` | _string_ |upload ID of the incomplete object.|
|`multiPartObjInfo.Size` | _int64_ |size of the incompletely uploaded object.|

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
### GetObject(bucketName string, objectName string) (*Object, error)

Downloads an object.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |


__Return Value__


|Param   |Type   |Description   |
|:---|:---| :---|
|`object`  | _*minio.Object_ |_minio.Object_ represents object reader  |


__Example__


```go

object, err := minioClient.GetObject("mybucket", "photo.jpg")
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
### FGetObject(bucketName string, objectName string, filePath string) error
 Downloads and saves the object as a file in the local filesystem.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |
|`filePath` | _string_  |path to which the object data will be written to.   |


__Example__


```go

err := minioClient.FGetObject("mybucket", "photo.jpg", "/tmp/photo.jpg")
if err != nil {
    fmt.Println(err)
    return
}

```

<a name="PutObject"></a>
### PutObject(bucketName string, objectName string, reader io.Reader, contentType string) (n int, err error) 

Uploads an object.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |
|`reader` | _io.Reader_  |Any golang object implementing io.Reader.   |
|`contentType` | _string_  |content type of the object.  |


__Example__


Uploads objects that are less than 5MiB in a single PUT operation. For objects that are greater than the 5MiB in size, PutObject seamlessly uploads the object in chunks of 5MiB or more depending on the actual file size. The max upload size for an object is 5TB.

In the event that PutObject fails to upload an object, the user may attempt to re-upload the same object. If the same object is being uploaded, PutObject API examines the previous partial attempt to upload this object and resumes automatically from where it left off.


```go

file, err := os.Open("my-testfile")
if err != nil {
    fmt.Println(err)
    return
}
defer file.Close()

n, err := minioClient.PutObject("mybucket", "myobject", file, "application/octet-stream")
if err != nil {
    fmt.Println(err)
    return
}

```


<a name="CopyObject"></a>
### CopyObject(bucketName string, objectName string, objectSource string, conditions CopyConditions) error

Copy a source object into a new object with the provided name in the provided bucket.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |
|`objectSource` | _string_  |name of the object source.  |
|`conditions` | _CopyConditions_  |Collection of supported CopyObject conditions. [`x-amz-copy-source`, `x-amz-copy-source-if-match`, `x-amz-copy-source-if-none-match`, `x-amz-copy-source-if-unmodified-since`, `x-amz-copy-source-if-modified-since`].|


__Example__


```go

// All following conditions are allowed and can be combined together.

// Set copy conditions.
var copyConds = minio.NewCopyConditions()
// Set modified condition, copy object modified since 2014 April.
copyConds.SetModified(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))

// Set unmodified condition, copy object unmodified since 2014 April.
// copyConds.SetUnmodified(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))

// Set matching ETag condition, copy object which matches the following ETag.
// copyConds.SetMatchETag("31624deb84149d2f8ef9c385918b653a")

// Set matching ETag except condition, copy object which does not match the following ETag.
// copyConds.SetMatchETagExcept("31624deb84149d2f8ef9c385918b653a")

err := minioClient.CopyObject("mybucket", "myobject", "/my-sourcebucketname/my-sourceobjectname", copyConds)
if err != nil {
    fmt.Println(err)
    return
}

```

<a name="FPutObject"></a>
### FPutObject(bucketName string, objectName string, filePath string, contentType string) error

Uploads contents from a file to objectName. 


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |
|`filePath` | _string_  |file path of the file to be uploaded. |
|`contentType` | _string_  |content type of the object.  |


__Example__


FPutObject uploads objects that are less than 5MiB in a single PUT operation. For objects that are greater than the 5MiB in size, FPutObject seamlessly uploads the object in chunks of 5MiB or more depending on the actual file size. The max upload size for an object is 5TB.

In the event that FPutObject fails to upload an object, the user may attempt to re-upload the same object. If the same object is being uploaded, FPutObject API examines the previous partial attempt to upload this object and resumes automatically from where it left off.

```go

n, err := minioClient.FPutObject("mybucket", "myobject.csv", "/tmp/otherobject.csv", "application/csv")
if err != nil {
    fmt.Println(err)
    return
}

```

<a name="StatObject"></a>
### StatObject(bucketName string, objectName string) (ObjectInfo, error)

Gets metadata of an object.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |


__Return Value__

|Param   |Type   |Description   |
|:---|:---| :---|
|`objInfo`  | _ObjectInfo_  |object stat info for format listed below: |


|Param   |Type   |Description   |
|:---|:---| :---|
|`objInfo.LastModified`  | _time.Time_  |modified time stamp. |
|`objInfo.ETag` | _string_ |etag of the object.|
|`objInfo.ContentType` | _string_ |Content-Type of the object.|
|`objInfo.Size` | _int64_ |size of the object.|


  __Example__

  
```go

objInfo, err := minioClient.StatObject("mybucket", "photo.jpg")
if err != nil {
    fmt.Println(err)
    return
}
fmt.Println(objInfo)

```

<a name="RemoveObject"></a>
### RemoveObject(bucketName string, objectName string) error

Removes an object.


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |


```go

err := minioClient.RemoveObject("mybucket", "photo.jpg")
if err != nil {
    fmt.Println(err)
    return
}

```
<a name="RemoveObjects"></a>
### RemoveObjects(bucketName string, objectsCh chan string) errorCh chan minio.RemoveObjectError

Removes a list of objects obtained from an input channel. The call internally buffers up `1000` at
a time and initiates a delete request to the server. Upon any error is sent through the error channel.

__Parameters__

|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectsCh` | _chan string_  | write prefixes of objects to be removed   |


__Return Values__

|Param   |Type   |Description   |
|:---|:---| :---|
|`errorCh` | _chan minio.RemoveObjectError  | read objects deletion errors  |



```go

errorCh := minioClient.RemoveObjects("mybucket", objectsCh)
for e := range errorCh {
    fmt.Println("Error detected during deletion: " + e.Err.Error())
}

```



<a name="RemoveIncompleteUpload"></a>
### RemoveIncompleteUpload(bucketName string, objectName string) error

Removes a partially uploaded object.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |

__Example__


```go

err := minioClient.RemoveIncompleteUpload("mybucket", "photo.jpg")
if err != nil {
    fmt.Println(err)
    return
}

```

## 4. Presigned operations


<a name="PresignedGetObject"></a>
### PresignedGetObject(bucketName string, objectName string, expiry time.Duration, reqParams url.Values) (*url.URL, error)

Generates a presigned URL for HTTP GET operations. Browsers/Mobile clients may point to this URL to directly download objects even if the bucket is private. This presigned URL can have an associated expiration time in seconds after which it is no longer operational. The default expiry is set to 7 days.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |
|`expiry` | _time.Duration_  |expiry in seconds.   |
|`reqParams` | _url.Values_  |additional response header overrides supports _response-expires_, _response-content-type_, _response-cache-control_, _response-content-disposition_.  |


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

```

<a name="PresignedPutObject"></a>
### PresignedPutObject(bucketName string, objectName string, expiry time.Duration) (*url.URL, error)

Generates a presigned URL for HTTP PUT operations. Browsers/Mobile clients may point to this URL to upload objects directly to a bucket even if it is private. This presigned URL can have an associated expiration time in seconds after which it is no longer operational. The default expiry is set to 7 days.

NOTE: you can upload to S3 only with specified object name.
 


__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectName` | _string_  |name of the object.   |
|`expiry` | _time.Duration_  |expiry in seconds.   |


__Example__


```go

// Generates a url which expires in a day.
expiry := time.Second * 24 * 60 * 60 // 1 day.
presignedURL, err := minioClient.PresignedPutObject("mybucket", "myobject", expiry)
if err != nil {
    fmt.Println(err)
    return
}
    fmt.Println(presignedURL)

```

<a name="PresignedPostPolicy"></a>
### PresignedPostPolicy(PostPolicy) (*url.URL, map[string]string, error)

Allows setting policy conditions to a presigned URL for POST operations. Policies such as bucket name to receive object uploads, key name prefixes, expiry policy may be set.

Create policy :


```go

policy := minio.NewPostPolicy()

```

Apply upload policy restrictions:


```go

policy.SetBucket("mybucket")
policy.SetKey("myobject")
policy.SetExpires(time.Now().UTC().AddDate(0, 0, 10)) // expires in 10 days

// Only allow 'png' images.
policy.SetContentType("image/png")

// Only allow content size in range 1KB to 1MB.
policy.SetContentLengthRange(1024, 1024*1024)

// Get the POST form key/value object:

url, formData, err := minioClient.PresignedPostPolicy(policy)
if err != nil {
    fmt.Println(err)
    return
}

```


POST your content from the command line using `curl`:


```go
fmt.Printf("curl ")
for k, v := range formData {
    fmt.Printf("-F %s=%s ", k, v)
}
fmt.Printf("-F file=@/etc/bash.bashrc ")
fmt.Printf("%s\n", url)
```

## 5. Bucket policy/notification operations

<a name="SetBucketPolicy"></a>
### SetBucketPolicy(bucketname string, objectPrefix string, policy policy.BucketPolicy) error

Set access permissions on bucket or an object prefix.

Importing `github.com/minio/minio-go/pkg/policy` package is needed.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName` | _string_  |name of the bucket.|
|`objectPrefix` | _string_  |name of the object prefix.|
|`policy` | _policy.BucketPolicy_  |policy can be:|
||  |policy.BucketPolicyNone|
| |  |policy.BucketPolicyReadOnly|
||   |policy.BucketPolicyReadWrite|
| | |policy.BucketPolicyWriteOnly|


__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`err` | _error_  |standard error   |


__Example__


```go

err := minioClient.SetBucketPolicy("mybucket", "myprefix", policy.BucketPolicyReadWrite)
if err != nil {
    fmt.Println(err)
    return
}

```

<a name="GetBucketPolicy"></a>
### GetBucketPolicy(bucketName string, objectPrefix string) (policy.BucketPolicy, error)

Get access permissions on a bucket or a prefix.

Importing `github.com/minio/minio-go/pkg/policy` package is needed.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectPrefix` | _string_  |name of the object prefix   |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketPolicy`  | _policy.BucketPolicy_ |string that contains: `none`, `readonly`, `readwrite`, or `writeonly`   |
|`err` | _error_  |standard error  |

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
### ListBucketPolicies(bucketName string, objectPrefix string) (map[string]BucketPolicy, error)

Get access permissions rules associated to the specified bucket and prefix.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`objectPrefix` | _string_  |name of the object prefix   |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketPolicies`  | _map[string]BucketPolicy_ |map that contains object resources paths with their associated permissions  |
|`err` | _error_  |standard error  |

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

Get all notification configurations related to the specified bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketNotification`  | _BucketNotification_ |structure which holds all notification configurations|
|`err` | _error_  |standard error  |

__Example__


```go
bucketNotification, err := minioClient.GetBucketNotification("mybucket")
if err != nil {
    for _, topicConfig := range bucketNotification.TopicConfigs {
	for _, e := range topicConfig.Events {
	    fmt.Println(e + " event is enabled")
	}
    }
}
```

<a name="SetBucketNotification"></a>
### SetBucketNotification(bucketName string, bucketNotification BucketNotification) error

Set a new bucket notification on a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |
|`bucketNotification`  | _BucketNotification_  |bucket notification.   |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`err` | _error_  |standard error  |

__Example__


```go
topicArn := NewArn("aws", "sns", "us-east-1", "804605494417", "PhotoUpdate")

topicConfig := NewNotificationConfig(topicArn)
topicConfig.AddEvents(minio.ObjectCreatedAll, minio.ObjectRemovedAll)
lambdaConfig.AddFilterPrefix("photos/")
lambdaConfig.AddFilterSuffix(".jpg")

bucketNotification := BucketNotification{}
bucketNotification.AddTopic(topicConfig)
err := c.SetBucketNotification(bucketName, bucketNotification)
if err != nil {
	fmt.Println("Cannot set the bucket notification: " + err)
}
```

<a name="RemoveAllBucketNotification"></a>
### RemoveAllBucketNotification(bucketName string) error

Remove all configured bucket notifications on a bucket.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  |name of the bucket.   |

__Return Values__


|Param   |Type   |Description   |
|:---|:---| :---|
|`err` | _error_  |standard error  |

__Example__


```go
err := c.RemoveAllBucketNotification(bucketName)
if err != nil {
	fmt.Println("Cannot remove bucket notifications.")
}
```

<a name="ListenBucketNotification"></a>
### ListenBucketNotification(bucketName, prefix, suffix string, events []string, doneCh <-chan struct{}) <-chan NotificationInfo

ListenBucketNotification API receives bucket notification events through the
notification channel. The returned notification channel has two fields
'Records' and 'Err'.

- 'Records' holds the notifications received from the server.
- 'Err' indicates any error while processing the received notifications.

NOTE: Notification channel is closed at the first occurrence of an error.

__Parameters__


|Param   |Type   |Description   |
|:---|:---| :---|
|`bucketName`  | _string_  | Bucket to listen notifications from.   |
|`prefix`  | _string_ | Object key prefix to filter notifications for.  |
|`suffix`  | _string_ | Object key suffix to filter notifications for.  |
|`events`  | _[]string_| Enables notifications for specific event types. |
|`doneCh`  | _chan struct{}_ | A message on this channel ends the ListenBucketNotification loop.  |

__Return Values__

|Param   |Type   |Description   |
|:---|:---| :---|
|`chan NotificationInfo` | _chan_ | Read channel for all notificatons on bucket. |
|`NotificationInfo` | _object_ | Notification object represents events info. |
|`notificationInfo.Records` | _[]NotificationEvent_ | Collection of notification events. |
|`notificationInfo.Err` | _error_ | Carries any error occurred during the operation. |


__Example__


```go

// Create a done channel to control 'ListenBucketNotification' go routine.
doneCh := make(chan struct{})

// Indicate a background go-routine to exit cleanly upon return.
defer close(doneCh)

// Listen for bucket notifications on "mybucket" filtered by prefix, suffix and events.
for notificationInfo := range minioClient.ListenBucketNotification("YOUR-BUCKET", "PREFIX", "SUFFIX", []string{
	"s3:ObjectCreated:*",
	"s3:ObjectRemoved:*",
}, doneCh) {
	if notificationInfo.Err != nil {
		log.Fatalln(notificationInfo.Err)
	}
	log.Println(notificationInfo)
}
```

## 6. Explore Further

- [Build your own Go Music Player App example](https://docs.minio.io/docs/go-music-player-app)

