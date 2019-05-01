# imageproxy

[![GoDoc](https://godoc.org/willnorris.com/go/imageproxy?status.svg)](https://godoc.org/willnorris.com/go/imageproxy)
[![Build Status](https://travis-ci.org/willnorris/imageproxy.svg?branch=master)](https://travis-ci.org/willnorris/imageproxy)
[![Test Coverage](https://codecov.io/gh/willnorris/imageproxy/branch/master/graph/badge.svg)](https://codecov.io/gh/willnorris/imageproxy)

imageproxy is a caching image proxy server written in go.  It features:

 - basic image adjustments like resizing, cropping, and rotation
 - access control using allowed hosts list or request signing (HMAC-SHA256)
 - support for jpeg, png, webp (decode only), tiff, and gif image formats
   (including animated gifs)
 - caching in-memory, on disk, or with Amazon S3, Google Cloud Storage, Azure
   Storage, or Redis
 - easy deployment, since it's pure go

Personally, I use it primarily to dynamically resize images hosted on my own
site (read more in [this post][]).  But you can also enable request signing and
use it as an SSL proxy for remote images, similar to [atmos/camo][] but with
additional image adjustment options.

[this post]: https://willnorris.com/2014/01/a-self-hosted-alternative-to-jetpacks-photon-service
[atmos/camo]: https://github.com/atmos/camo


## URL Structure ##

imageproxy URLs are of the form `http://localhost/{options}/{remote_url}`.

### Options ###

Options are available for cropping, resizing, rotation, flipping, and digital
signatures among a few others.  Options for are specified as a comma delimited
list of parameters, which can be supplied in any order.  Duplicate parameters
overwrite previous values.

See the full list of available options at
<https://godoc.org/willnorris.com/go/imageproxy#ParseOptions>.

### Remote URL ###

The URL of the original image to load is specified as the remainder of the
path, without any encoding.  For example,
`http://localhost/200/https://willnorris.com/logo.jpg`.

In order to [optimize caching][], it is recommended that URLs not contain query
strings.

[optimize caching]: http://www.stevesouders.com/blog/2008/08/23/revving-filenames-dont-use-querystring/

### Examples ###

The following live examples demonstrate setting different options on [this
source image][small-things], which measures 1024 by 678 pixels.

[small-things]: https://willnorris.com/2013/12/small-things.jpg

Options | Meaning                                  | Image
--------|------------------------------------------|------
200x    | 200px wide, proportional height          | <a href="https://willnorris.com/api/imageproxy/200x/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/200x/https://willnorris.com/2013/12/small-things.jpg" alt="200x"></a>
x0.15   | 15% original height, proportional width  | <a href="https://willnorris.com/api/imageproxy/x0.15/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/x0.15/https://willnorris.com/2013/12/small-things.jpg" alt="x0.15"></a>
100x150 | 100 by 150 pixels, cropping as needed    | <a href="https://willnorris.com/api/imageproxy/100x150/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/100x150/https://willnorris.com/2013/12/small-things.jpg" alt="100x150"></a>
100     | 100px square, cropping as needed         | <a href="https://willnorris.com/api/imageproxy/100/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/100/https://willnorris.com/2013/12/small-things.jpg" alt="100"></a>
150,fit | scale to fit 150px square, no cropping   | <a href="https://willnorris.com/api/imageproxy/150,fit/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/150,fit/https://willnorris.com/2013/12/small-things.jpg" alt="150,fit"></a>
100,r90 | 100px square, rotated 90 degrees         | <a href="https://willnorris.com/api/imageproxy/100,r90/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/100,r90/https://willnorris.com/2013/12/small-things.jpg" alt="100,r90"></a>
100,fv,fh | 100px square, flipped horizontal and vertical | <a href="https://willnorris.com/api/imageproxy/100,fv,fh/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/100,fv,fh/https://willnorris.com/2013/12/small-things.jpg" alt="100,fv,fh"></a>
200x,q60 | 200px wide, proportional height, 60% quality | <a href="https://willnorris.com/api/imageproxy/200x,q60/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/200x,q60/https://willnorris.com/2013/12/small-things.jpg" alt="200x,q60"></a>
200x,png | 200px wide, converted to PNG format | <a href="https://willnorris.com/api/imageproxy/200x,png/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/200x,png/https://willnorris.com/2013/12/small-things.jpg" alt="200x,png"></a>
cx175,cw400,ch300,100x | crop to 400x300px starting at (175,0), scale to 100px wide | <a href="https://willnorris.com/api/imageproxy/cx175,cw400,ch300,100x/https://willnorris.com/2013/12/small-things.jpg"><img src="https://willnorris.com/api/imageproxy/cx175,cw400,ch300,100x/https://willnorris.com/2013/12/small-things.jpg" alt="cx175,cw400,ch300,100x"></a>

The [smart crop feature](https://godoc.org/willnorris.com/go/imageproxy#hdr-Smart_Crop)
can best be seen by comparing crops of [this source image][judah-sheets], with
and without smart crop enabled.

Options | Meaning                                  | Image
--------|------------------------------------------|------
150x300 | 150x300px, standard crop | <a href="https://willnorris.com/api/imageproxy/150x300/https://judahnorris.com/images/judah-sheets.jpg"><img src="https://willnorris.com/api/imageproxy/150x300/https://judahnorris.com/images/judah-sheets.jpg" alt="200x400,sc"></a>
150x300,sc | 150x300px, smart crop          | <a href="https://willnorris.com/api/imageproxy/150x300,sc/https://judahnorris.com/images/judah-sheets.jpg"><img src="https://willnorris.com/api/imageproxy/150x300,sc/https://judahnorris.com/images/judah-sheets.jpg" alt="200x400"></a>

[judah-sheets]: https://judahnorris.com/images/judah-sheets.jpg

Transformation also works on animated gifs.  Here is [this source
image][material-animation] resized to 200px square and rotated 270 degrees:

[material-animation]: https://willnorris.com/2015/05/material-animations.gif

<a href="https://willnorris.com/api/imageproxy/200,r270/https://willnorris.com/2015/05/material-animations.gif"><img src="https://willnorris.com/api/imageproxy/200,r270/https://willnorris.com/2015/05/material-animations.gif" alt="200,r270"></a>

## Getting Started ##

Install the package using:

    go get willnorris.com/go/imageproxy/cmd/imageproxy

Once installed, ensure `$GOPATH/bin` is in your `$PATH`, then run the proxy
using:

    imageproxy

This will start the proxy on port 8080, without any caching and with no allowed
host list (meaning any remote URL can be proxied).  Test this by navigating to
<http://localhost:8080/500/https://octodex.github.com/images/codercat.jpg> and
you should see a 500px square coder octocat.

### Cache ###

By default, the imageproxy command does not cache responses, but caching can be
enabled using the `-cache` flag.  It supports the following values:

 - `memory` - uses an in-memory LRU cache.  By default, this is limited to
   100mb. To customize the size of the cache or the max age for cached items,
   use the format `memory:size:age` where size is measured in mb and age is a
   duration.  For example, `memory:200:4h` will create a 200mb cache that will
   cache items no longer than 4 hours.
 - directory on local disk (e.g. `/tmp/imageproxy`) - will cache images
   on disk

 - s3 URL (e.g. `s3://region/bucket-name/optional-path-prefix`) - will cache
   images on Amazon S3.  This requires either an IAM role and instance profile
   with access to your your bucket or `AWS_ACCESS_KEY_ID` and `AWS_SECRET_KEY`
   environmental variables be set. (Additional methods of loading credentials
   are documented in the [aws-sdk-go session
   package](https://docs.aws.amazon.com/sdk-for-go/api/aws/session/)).

   Additional configuration options ([further documented here][aws-options])
   may be specified as URL query string parameters, which are mostly useful
   when working with s3-compatible services:
   - "endpoint" - specify an alternate API endpoint
   - "disableSSL" - set to "1" to disable SSL when calling the API
   - "s3ForcePathStyle" - set to "1" to force the request to use path-style addressing

   For example, when working with [minio](https://minio.io), which doesn't use
   regions, provide a dummy region value and custom endpoint value:

       s3://fake-region/bucket/folder?endpoint=minio:9000&disableSSL=1&s3ForcePathStyle=1

   [aws-options]: https://docs.aws.amazon.com/sdk-for-go/api/aws/#Config

 - gcs URL (e.g. `gcs://bucket-name/optional-path-prefix`) - will cache images
   on Google Cloud Storage. Authentication is documented in Google's
   [Application Default Credentials
   docs](https://cloud.google.com/docs/authentication/production#providing_credentials_to_your_application).
 - azure URL (e.g. `azure://container-name/`) - will cache images on
   Azure Storage.  This requires `AZURESTORAGE_ACCOUNT_NAME` and
   `AZURESTORAGE_ACCESS_KEY` environment variables to bet set.
 - redis URL (e.g. `redis://hostname/`) - will cache images on
   the specified redis host. The full URL syntax is defined by the [redis URI
   registration](https://www.iana.org/assignments/uri-schemes/prov/redis).
   Rather than specify password in the URI, use the `REDIS_PASSWORD`
   environment variable.

For example, to cache files on disk in the `/tmp/imageproxy` directory:

    imageproxy -cache /tmp/imageproxy

Reload the [codercat URL][], and then inspect the contents of
`/tmp/imageproxy`.  Within the subdirectories, there should be two files, one
for the original full-size codercat image, and one for the resized 500px
version.

[codercat URL]: http://localhost:8080/500/https://octodex.github.com/images/codercat.jpg

If the `-cache` flag is specified multiple times, multiple caches will be
created in a [tiered fashion][]. Typically this is used to put a smaller and
faster in-memory cache in front of a larger but slower on-disk cache.  For
example, the following will first check an in-memory cache for an image,
followed by a gcs bucket:

    imageproxy -cache memory -cache gcs://my-bucket/

[tiered fashion]: https://godoc.org/github.com/die-net/lrucache/twotier

### Allowed Referrer List ###

You can limit images to only be accessible for certain hosts in the HTTP
referrer header, which can help prevent others from hotlinking to images. It can
be enabled by running:

    imageproxy  -referrers example.com


Reload the [codercat URL][], and you should now get an error message.  You can
specify multiple hosts as a comma separated list, or prefix a host value with
`*.` to allow all sub-domains as well.

### Allowed and Denied Hosts List ###

You can limit the remote hosts that the proxy will fetch images from using the
`allowHosts` and `denyHosts` flags.  This is useful, for example, for locking
the proxy down to your own hosts to prevent others from abusing it.  Of course
if you want to support fetching from any host, leave off these flags.

Try it out by running:

    imageproxy -allowHosts example.com

Reload the [codercat URL][], and you should now get an error message.
Alternately, try running:

    imageproxy -denyHosts octodex.github.com

Reloading the [codercat URL][] will still return an error message.

You can specify multiple hosts as a comma separated list to either flag, or
prefix a host value with `*.` to allow or deny all sub-domains as well.

If a host matches both an allowed an a denied host, the request will be denied.

### Allowed Content-Type List ###

You can limit what content types can be proxied by using the `contentTypes`
flag. By default, this is set to `image/*`, meaning that imageproxy will
process any image types. You can specify multiple content types as a comma
separated list, and suffix values with `*` to perform a wildcard match. Set the
flag to an empty string to proxy all requests, regardless of content type.

### Signed Requests ###

Instead of an allowed host list, you can require that requests be signed.  This
is useful in preventing abuse when you don't have just a static list of hosts
you want to allow.  Signatures are generated using HMAC-SHA256 against the
remote URL, and url-safe base64 encoding the result:

    base64urlencode(hmac.New(sha256, <key>).digest(<remote_url>))

The HMAC key is specified using the `signatureKey` flag.  If this flag
begins with an "@", the remainder of the value is interpreted as a file on disk
which contains the HMAC key.

Try it out by running:

    imageproxy -signatureKey "secret key"

Reload the [codercat URL][], and you should see an error message.  Now load a
[signed codercat URL][] (which contains the [signature option][]) and verify
that it loads properly.

[signed codercat URL]: http://localhost:8080/500,sXyMwWKIC5JPCtlYOQ2f4yMBTqpjtUsfI67Sp7huXIYY=/https://octodex.github.com/images/codercat.jpg
[signature option]: https://godoc.org/willnorris.com/go/imageproxy#hdr-Signature

Some simple code samples for generating signatures in various languages can be
found in [docs/url-signing.md](/docs/url-signing.md).

If both a whiltelist and signatureKey are specified, requests can match either.
In other words, requests that match one of the allowed hosts don't necessarily
need to be signed, though they can be.

### Default Base URL ###

Typically, remote images to be proxied are specified as absolute URLs.
However, if you commonly proxy images from a single source, you can provide a
base URL and then specify remote images relative to that base.  Try it out by
running:

    imageproxy -baseURL https://octodex.github.com/

Then load the codercat image, specified as a URL relative to that base:
<http://localhost:8080/500/images/codercat.jpg>.  Note that this is not an
effective method to mask the true source of the images being proxied; it is
trivial to discover the base URL being used.  Even when a base URL is
specified, you can always provide the absolute URL of the image to be proxied.

### Scaling beyond original size ###

By default, the imageproxy won't scale images beyond their original size.
However, you can use the `scaleUp` command-line flag to allow this to happen:

    imageproxy -scaleUp true

### WebP and TIFF support ###

Imageproxy can proxy remote webp images, but they will be served in either jpeg
or png format (this is because the golang webp library only supports webp
decoding) if any transformation is requested.  If no format is specified,
imageproxy will use jpeg by default.  If no transformation is requested (for
example, if you are just using imageproxy as an SSL proxy) then the original
webp image will be served as-is without any format conversion.

Because so few browsers support tiff images, they will be converted to jpeg by
default if any transformation is requested. To force encoding as tiff, pass the
"tiff" option. Like webp, tiff images will be served as-is without any format
conversion if no transformation is requested.


Run `imageproxy -help` for a complete list of flags the command accepts.  If
you want to use a different caching implementation, it's probably easiest to
just make a copy of `cmd/imageproxy/main.go` and customize it to fit your
needs... it's a very simple command.

## Deploying ##

In most cases, you can follow the normal procedure for building a deploying any
go application.  For example, I build it directly on my production debian server
using:

 - `go build willnorris.com/go/imageproxy/cmd/imageproxy`
 - copy resulting binary to `/usr/local/bin`
 - copy [`etc/imageproxy.service`](etc/imageproxy.service) to
   `/lib/systemd/system` and enable using `systemctl`.

Instructions have been contributed below for running on other platforms, but I
don't have much experience with them personally.

### Heroku ###

It's easy to vendorize the dependencies with `Godep` and deploy to Heroku. Take
a look at [this GitHub repo](https://github.com/oreillymedia/prototype-imageproxy)

### Docker ###

A docker image is available at [`willnorris/imageproxy`](https://registry.hub.docker.com/u/willnorris/imageproxy/dockerfile/).

You can run it by
```
docker run -p 8080:8080 willnorris/imageproxy -addr 0.0.0.0:8080
```

Or in your Dockerfile:

```
ENTRYPOINT ["/go/bin/imageproxy", "-addr 0.0.0.0:8080"]
```

### nginx ###

You can use follow config to prevent URL overwritting:

```
  location ~ ^/api/imageproxy/ {
    # pattern match to capture the original URL to prevent URL
    # canonicalization, which would strip double slashes
    if ($request_uri ~ "/api/imageproxy/(.+)") {
      set $path $1;
      rewrite .* /$path break;
    }
    proxy_pass http://localhost:8080;
  }
```

## License ##

imageproxy is copyright Google, but is not an official Google product.  It is
available under the [Apache 2.0 License](./LICENSE).
