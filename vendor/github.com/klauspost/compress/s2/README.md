# S2 Compression

S2 is an extension of [Snappy](https://github.com/google/snappy).

S2 is aimed for high throughput, which is why it features concurrent compression for bigger payloads.

Decoding is compatible with Snappy compressed content, but content compressed with S2 cannot be decompressed by Snappy.
This means that S2 can seamlessly replace Snappy without converting compressed content.

S2 can produce Snappy compatible output, faster and better than Snappy.
If you want full benefit of the changes you should use s2 without Snappy compatibility. 

S2 is designed to have high throughput on content that cannot be compressed.
This is important, so you don't have to worry about spending CPU cycles on already compressed data. 

## Benefits over Snappy

* Better compression
* Adjustable compression (3 levels) 
* Concurrent stream compression
* Faster decompression, even for Snappy compatible content
* Ability to quickly skip forward in compressed stream
* Random seeking with indexes
* Compatible with reading Snappy compressed content
* Smaller block size overhead on incompressible blocks
* Block concatenation
* Uncompressed stream mode
* Automatic stream size padding
* Snappy compatible block compression

## Drawbacks over Snappy

* Not optimized for 32 bit systems
* Streams use slightly more memory due to larger blocks and concurrency (configurable)

# Usage

Installation: `go get -u github.com/klauspost/compress/s2`

Full package documentation:
 
[![godoc][1]][2]

[1]: https://godoc.org/github.com/klauspost/compress?status.svg
[2]: https://godoc.org/github.com/klauspost/compress/s2

## Compression

```Go
func EncodeStream(src io.Reader, dst io.Writer) error {
    enc := s2.NewWriter(dst)
    _, err := io.Copy(enc, src)
    if err != nil {
        enc.Close()
        return err
    }
    // Blocks until compression is done.
    return enc.Close() 
}
```

You should always call `enc.Close()`, otherwise you will leak resources and your encode will be incomplete.

For the best throughput, you should attempt to reuse the `Writer` using the `Reset()` method.

The Writer in S2 is always buffered, therefore `NewBufferedWriter` in Snappy can be replaced with `NewWriter` in S2.
It is possible to flush any buffered data using the `Flush()` method. 
This will block until all data sent to the encoder has been written to the output.

S2 also supports the `io.ReaderFrom` interface, which will consume all input from a reader.

As a final method to compress data, if you have a single block of data you would like to have encoded as a stream,
a slightly more efficient method is to use the `EncodeBuffer` method.
This will take ownership of the buffer until the stream is closed.

```Go
func EncodeStream(src []byte, dst io.Writer) error {
    enc := s2.NewWriter(dst)
    // The encoder owns the buffer until Flush or Close is called.
    err := enc.EncodeBuffer(buf)
    if err != nil {
        enc.Close()
        return err
    }
    // Blocks until compression is done.
    return enc.Close()
}
```

Each call to `EncodeBuffer` will result in discrete blocks being created without buffering, 
so it should only be used a single time per stream.
If you need to write several blocks, you should use the regular io.Writer interface.


## Decompression

```Go
func DecodeStream(src io.Reader, dst io.Writer) error {
    dec := s2.NewReader(src)
    _, err := io.Copy(dst, dec)
    return err
}
```

Similar to the Writer, a Reader can be reused using the `Reset` method.

For the best possible throughput, there is a `EncodeBuffer(buf []byte)` function available.
However, it requires that the provided buffer isn't used after it is handed over to S2 and until the stream is flushed or closed.  

For smaller data blocks, there is also a non-streaming interface: `Encode()`, `EncodeBetter()` and `Decode()`.
Do however note that these functions (similar to Snappy) does not provide validation of data, 
so data corruption may be undetected. Stream encoding provides CRC checks of data.

It is possible to efficiently skip forward in a compressed stream using the `Skip()` method. 
For big skips the decompressor is able to skip blocks without decompressing them.

## Single Blocks

Similar to Snappy S2 offers single block compression. 
Blocks do not offer the same flexibility and safety as streams,
but may be preferable for very small payloads, less than 100K.

Using a simple `dst := s2.Encode(nil, src)` will compress `src` and return the compressed result. 
It is possible to provide a destination buffer. 
If the buffer has a capacity of `s2.MaxEncodedLen(len(src))` it will be used. 
If not a new will be allocated. 

Alternatively `EncodeBetter`/`EncodeBest` can also be used for better, but slightly slower compression.

Similarly to decompress a block you can use `dst, err := s2.Decode(nil, src)`. 
Again an optional destination buffer can be supplied. 
The `s2.DecodedLen(src)` can be used to get the minimum capacity needed. 
If that is not satisfied a new buffer will be allocated.

Block function always operate on a single goroutine since it should only be used for small payloads.

# Commandline tools

Some very simply commandline tools are provided; `s2c` for compression and `s2d` for decompression.

Binaries can be downloaded on the [Releases Page](https://github.com/klauspost/compress/releases).

Installing then requires Go to be installed. To install them, use:

`go install github.com/klauspost/compress/s2/cmd/s2c@latest && go install github.com/klauspost/compress/s2/cmd/s2d@latest`

To build binaries to the current folder use:

`go build github.com/klauspost/compress/s2/cmd/s2c && go build github.com/klauspost/compress/s2/cmd/s2d`


## s2c

```
Usage: s2c [options] file1 file2

Compresses all files supplied as input separately.
Output files are written as 'filename.ext.s2' or 'filename.ext.snappy'.
By default output files will be overwritten.
Use - as the only file name to read from stdin and write to stdout.

Wildcards are accepted: testdir/*.txt will compress all files in testdir ending with .txt
Directories can be wildcards as well. testdir/*/*.txt will match testdir/subdir/b.txt

File names beginning with 'http://' and 'https://' will be downloaded and compressed.
Only http response code 200 is accepted.

Options:
  -bench int
    	Run benchmark n times. No output will be written
  -blocksize string
    	Max  block size. Examples: 64K, 256K, 1M, 4M. Must be power of two and <= 4MB (default "4M")
  -c	Write all output to stdout. Multiple input files will be concatenated
  -cpu int
    	Compress using this amount of threads (default 32)
  -faster
    	Compress faster, but with a minor compression loss
  -help
    	Display help
  -index
        Add seek index (default true)    	
  -o string
        Write output to another file. Single input file only
  -pad string
    	Pad size to a multiple of this value, Examples: 500, 64K, 256K, 1M, 4M, etc (default "1")
  -q	Don't write any output to terminal, except errors
  -rm
    	Delete source file(s) after successful compression
  -safe
    	Do not overwrite output files
  -slower
    	Compress more, but a lot slower
  -snappy
        Generate Snappy compatible output stream
  -verify
    	Verify written files  

```

## s2d

```
Usage: s2d [options] file1 file2

Decompresses all files supplied as input. Input files must end with '.s2' or '.snappy'.
Output file names have the extension removed. By default output files will be overwritten.
Use - as the only file name to read from stdin and write to stdout.

Wildcards are accepted: testdir/*.txt will compress all files in testdir ending with .txt
Directories can be wildcards as well. testdir/*/*.txt will match testdir/subdir/b.txt

File names beginning with 'http://' and 'https://' will be downloaded and decompressed.
Extensions on downloaded files are ignored. Only http response code 200 is accepted.

Options:
  -bench int
    	Run benchmark n times. No output will be written
  -c	Write all output to stdout. Multiple input files will be concatenated
  -help
    	Display help
  -o string
        Write output to another file. Single input file only
  -offset string
        Start at offset. Examples: 92, 64K, 256K, 1M, 4M. Requires Index
  -q    Don't write any output to terminal, except errors
  -rm
        Delete source file(s) after successful decompression
  -safe
        Do not overwrite output files
  -tail string
        Return last of compressed file. Examples: 92, 64K, 256K, 1M, 4M. Requires Index
  -verify
    	Verify files, but do not write output                                      
```

## s2sx: self-extracting archives

s2sx allows creating self-extracting archives with no dependencies.

By default, executables are created for the same platforms as the host os, 
but this can be overridden with `-os` and `-arch` parameters.

Extracted files have 0666 permissions, except when untar option used.

```
Usage: s2sx [options] file1 file2

Compresses all files supplied as input separately.
If files have '.s2' extension they are assumed to be compressed already.
Output files are written as 'filename.s2sx' and with '.exe' for windows targets.
If output is big, an additional file with ".more" is written. This must be included as well.
By default output files will be overwritten.

Wildcards are accepted: testdir/*.txt will compress all files in testdir ending with .txt
Directories can be wildcards as well. testdir/*/*.txt will match testdir/subdir/b.txt

Options:
  -arch string
        Destination architecture (default "amd64")
  -c    Write all output to stdout. Multiple input files will be concatenated
  -cpu int
        Compress using this amount of threads (default 32)
  -help
        Display help
  -max string
        Maximum executable size. Rest will be written to another file. (default "1G")
  -os string
        Destination operating system (default "windows")
  -q    Don't write any output to terminal, except errors
  -rm
        Delete source file(s) after successful compression
  -safe
        Do not overwrite output files
  -untar
        Untar on destination
```

Available platforms are:

 * darwin-amd64
 * darwin-arm64
 * linux-amd64
 * linux-arm
 * linux-arm64
 * linux-mips64
 * linux-ppc64le
 * windows-386
 * windows-amd64                                                                             

By default, there is a size limit of 1GB for the output executable.

When this is exceeded the remaining file content is written to a file called
output+`.more`. This file must be included for a successful extraction and 
placed alongside the executable for a successful extraction.

This file *must* have the same name as the executable, so if the executable is renamed, 
so must the `.more` file. 

This functionality is disabled with stdin/stdout. 

### Self-extracting TAR files

If you wrap a TAR file you can specify `-untar` to make it untar on the destination host.

Files are extracted to the current folder with the path specified in the tar file.

Note that tar files are not validated before they are wrapped.

For security reasons files that move below the root folder are not allowed.

# Performance

This section will focus on comparisons to Snappy. 
This package is solely aimed at replacing Snappy as a high speed compression package.
If you are mainly looking for better compression [zstandard](https://github.com/klauspost/compress/tree/master/zstd#zstd)
gives better compression, but typically at speeds slightly below "better" mode in this package.

Compression is increased compared to Snappy, mostly around 5-20% and the throughput is typically 25-40% increased (single threaded) compared to the Snappy Go implementation.

Streams are concurrently compressed. The stream will be distributed among all available CPU cores for the best possible throughput.

A "better" compression mode is also available. This allows to trade a bit of speed for a minor compression gain.
The content compressed in this mode is fully compatible with the standard decoder.

Snappy vs S2 **compression** speed on 16 core (32 thread) computer, using all threads and a single thread (1 CPU):

| File                                                                                                | S2 speed | S2 Throughput | S2 % smaller | S2 "better" | "better" throughput | "better" % smaller |
|-----------------------------------------------------------------------------------------------------|----------|---------------|--------------|-------------|---------------------|--------------------|
| [rawstudio-mint14.tar](https://files.klauspost.com/compress/rawstudio-mint14.7z)                    | 12.70x   | 10556 MB/s    | 7.35%        | 4.15x       | 3455 MB/s           | 12.79%             |
| (1 CPU)                                                                                             | 1.14x    | 948 MB/s      | -            | 0.42x       | 349 MB/s            | -                  |
| [github-june-2days-2019.json](https://files.klauspost.com/compress/github-june-2days-2019.json.zst) | 17.13x   | 14484 MB/s    | 31.60%       | 10.09x      | 8533 MB/s           | 37.71%             |
| (1 CPU)                                                                                             | 1.33x    | 1127 MB/s     | -            | 0.70x       | 589 MB/s            | -                  |
| [github-ranks-backup.bin](https://files.klauspost.com/compress/github-ranks-backup.bin.zst)         | 15.14x   | 12000 MB/s    | -5.79%       | 6.59x       | 5223 MB/s           | 5.80%              |
| (1 CPU)                                                                                             | 1.11x    | 877 MB/s      | -            | 0.47x       | 370 MB/s            | -                  |
| [consensus.db.10gb](https://files.klauspost.com/compress/consensus.db.10gb.zst)                     | 14.62x   | 12116 MB/s    | 15.90%       | 5.35x       | 4430 MB/s           | 16.08%             |
| (1 CPU)                                                                                             | 1.38x    | 1146 MB/s     | -            | 0.38x       | 312 MB/s            | -                  |
| [adresser.json](https://files.klauspost.com/compress/adresser.json.zst)                             | 8.83x    | 17579 MB/s    | 43.86%       | 6.54x       | 13011 MB/s          | 47.23%             |
| (1 CPU)                                                                                             | 1.14x    | 2259 MB/s     | -            | 0.74x       | 1475 MB/s           | -                  |
| [gob-stream](https://files.klauspost.com/compress/gob-stream.7z)                                    | 16.72x   | 14019 MB/s    | 24.02%       | 10.11x      | 8477 MB/s           | 30.48%             |
| (1 CPU)                                                                                             | 1.24x    | 1043 MB/s     | -            | 0.70x       | 586 MB/s            | -                  |
| [10gb.tar](http://mattmahoney.net/dc/10gb.html)                                                     | 13.33x   | 9254 MB/s     | 1.84%        | 6.75x       | 4686 MB/s           | 6.72%              |
| (1 CPU)                                                                                             | 0.97x    | 672 MB/s      | -            | 0.53x       | 366 MB/s            | -                  |
| sharnd.out.2gb                                                                                      | 2.11x    | 12639 MB/s    | 0.01%        | 1.98x       | 11833 MB/s          | 0.01%              |
| (1 CPU)                                                                                             | 0.93x    | 5594 MB/s     | -            | 1.34x       | 8030 MB/s           | -                  |
| [enwik9](http://mattmahoney.net/dc/textdata.html)                                                   | 19.34x   | 8220 MB/s     | 3.98%        | 7.87x       | 3345 MB/s           | 15.82%             |
| (1 CPU)                                                                                             | 1.06x    | 452 MB/s      | -            | 0.50x       | 213 MB/s            | -                  |
| [silesia.tar](http://sun.aei.polsl.pl/~sdeor/corpus/silesia.zip)                                    | 10.48x   | 6124 MB/s     | 5.67%        | 3.76x       | 2197 MB/s           | 12.60%             |
| (1 CPU)                                                                                             | 0.97x    | 568 MB/s      | -            | 0.46x       | 271 MB/s            | -                  |
| [enwik10](https://encode.su/threads/3315-enwik10-benchmark-results)                                 | 21.07x   | 9020 MB/s     | 6.36%        | 6.91x       | 2959 MB/s           | 16.95%             |
| (1 CPU)                                                                                             | 1.07x    | 460 MB/s      | -            | 0.51x       | 220 MB/s            | -                  |

### Legend

* `S2 speed`: Speed of S2 compared to Snappy, using 16 cores and 1 core.
* `S2 throughput`: Throughput of S2 in MB/s. 
* `S2 % smaller`: How many percent of the Snappy output size is S2 better.
* `S2 "better"`: Speed when enabling "better" compression mode in S2 compared to Snappy. 
* `"better" throughput`: Speed when enabling "better" compression mode in S2 compared to Snappy. 
* `"better" % smaller`: How many percent of the Snappy output size is S2 better when using "better" compression.

There is a good speedup across the board when using a single thread and a significant speedup when using multiple threads.

Machine generated data gets by far the biggest compression boost, with size being being reduced by up to 45% of Snappy size.

The "better" compression mode sees a good improvement in all cases, but usually at a performance cost.

Incompressible content (`sharnd.out.2gb`, 2GB random data) sees the smallest speedup. 
This is likely dominated by synchronization overhead, which is confirmed by the fact that single threaded performance is higher (see above). 

## Decompression

S2 attempts to create content that is also fast to decompress, except in "better" mode where the smallest representation is used.

S2 vs Snappy **decompression** speed. Both operating on single core:

| File                                                                                                | S2 Throughput | vs. Snappy | Better Throughput | vs. Snappy |
|-----------------------------------------------------------------------------------------------------|---------------|------------|-------------------|------------|
| [rawstudio-mint14.tar](https://files.klauspost.com/compress/rawstudio-mint14.7z)                    | 2117 MB/s     | 1.14x      | 1738 MB/s         | 0.94x      |
| [github-june-2days-2019.json](https://files.klauspost.com/compress/github-june-2days-2019.json.zst) | 2401 MB/s     | 1.25x      | 2307 MB/s         | 1.20x      |
| [github-ranks-backup.bin](https://files.klauspost.com/compress/github-ranks-backup.bin.zst)         | 2075 MB/s     | 0.98x      | 1764 MB/s         | 0.83x      |
| [consensus.db.10gb](https://files.klauspost.com/compress/consensus.db.10gb.zst)                     | 2967 MB/s     | 1.05x      | 2885 MB/s         | 1.02x      |
| [adresser.json](https://files.klauspost.com/compress/adresser.json.zst)                             | 4141 MB/s     | 1.07x      | 4184 MB/s         | 1.08x      |
| [gob-stream](https://files.klauspost.com/compress/gob-stream.7z)                                    | 2264 MB/s     | 1.12x      | 2185 MB/s         | 1.08x      |
| [10gb.tar](http://mattmahoney.net/dc/10gb.html)                                                     | 1525 MB/s     | 1.03x      | 1347 MB/s         | 0.91x      |
| sharnd.out.2gb                                                                                      | 3813 MB/s     | 0.79x      | 3900 MB/s         | 0.81x      |
| [enwik9](http://mattmahoney.net/dc/textdata.html)                                                   | 1246 MB/s     | 1.29x      | 967 MB/s          | 1.00x      |
| [silesia.tar](http://sun.aei.polsl.pl/~sdeor/corpus/silesia.zip)                                    | 1433 MB/s     | 1.12x      | 1203 MB/s         | 0.94x      |
| [enwik10](https://encode.su/threads/3315-enwik10-benchmark-results)                                 | 1284 MB/s     | 1.32x      | 1010 MB/s         | 1.04x      |

### Legend

* `S2 Throughput`: Decompression speed of S2 encoded content.
* `Better Throughput`: Decompression speed of S2 "better" encoded content.
* `vs Snappy`: Decompression speed of S2 "better" mode compared to Snappy and absolute speed.


While the decompression code hasn't changed, there is a significant speedup in decompression speed. 
S2 prefers longer matches and will typically only find matches that are 6 bytes or longer. 
While this reduces compression a bit, it improves decompression speed.

The "better" compression mode will actively look for shorter matches, which is why it has a decompression speed quite similar to Snappy.   

Without assembly decompression is also very fast; single goroutine decompression speed. No assembly:

| File                           | S2 Throughput | S2 throughput |
|--------------------------------|--------------|---------------|
| consensus.db.10gb.s2           | 1.84x        | 2289.8 MB/s   |
| 10gb.tar.s2                    | 1.30x        | 867.07 MB/s   |
| rawstudio-mint14.tar.s2        | 1.66x        | 1329.65 MB/s  |
| github-june-2days-2019.json.s2 | 2.36x        | 1831.59 MB/s  |
| github-ranks-backup.bin.s2     | 1.73x        | 1390.7 MB/s   |
| enwik9.s2                      | 1.67x        | 681.53 MB/s   |
| adresser.json.s2               | 3.41x        | 4230.53 MB/s  |
| silesia.tar.s2                 | 1.52x        | 811.58        |

Even though S2 typically compresses better than Snappy, decompression speed is always better. 

## Block compression


When compressing blocks no concurrent compression is performed just as Snappy. 
This is because blocks are for smaller payloads and generally will not benefit from concurrent compression.

An important change is that incompressible blocks will not be more than at most 10 bytes bigger than the input.
In rare, worst case scenario Snappy blocks could be significantly bigger than the input.  

### Mixed content blocks

The most reliable is a wide dataset. 
For this we use [`webdevdata.org-2015-01-07-subset`](https://files.klauspost.com/compress/webdevdata.org-2015-01-07-4GB-subset.7z),
53927 files, total input size: 4,014,735,833 bytes. Single goroutine used.

| *                 | Input      | Output     | Reduction | MB/s   |
|-------------------|------------|------------|-----------|--------|
| S2                | 4014735833 | 1059723369 | 73.60%    | **934.34** |
| S2 Better         | 4014735833 | 969670507  | 75.85%    | 532.70 |
| S2 Best           | 4014735833 | 906625668  | **77.85%** | 46.84 |
| Snappy            | 4014735833 | 1128706759 | 71.89%    | 762.59 |
| S2, Snappy Output | 4014735833 | 1093821420 | 72.75%    | 908.60 |
| LZ4               | 4014735833 | 1079259294 | 73.12%    | 526.94 |

S2 delivers both the best single threaded throughput with regular mode and the best compression rate with "best".
"Better" mode provides the same compression speed as LZ4 with better compression ratio. 

When outputting Snappy compatible output it still delivers better throughput (150MB/s more) and better compression.

As can be seen from the other benchmarks decompression should also be easier on the S2 generated output.

Though they cannot be compared due to different decompression speeds here are the speed/size comparisons for
other Go compressors:

| *                 | Input      | Output     | Reduction | MB/s   |
|-------------------|------------|------------|-----------|--------|
| Zstd Fastest (Go) | 4014735833 | 794608518  | 80.21%    | 236.04 |
| Zstd Best (Go)    | 4014735833 | 704603356  | 82.45%    | 35.63  |
| Deflate (Go) l1   | 4014735833 | 871294239  | 78.30%    | 214.04 |
| Deflate (Go) l9   | 4014735833 | 730389060  | 81.81%    | 41.17  |

### Standard block compression

Benchmarking single block performance is subject to a lot more variation since it only tests a limited number of file patterns.
So individual benchmarks should only be seen as a guideline and the overall picture is more important.

These micro-benchmarks are with data in cache and trained branch predictors. For a more realistic benchmark see the mixed content above. 

Block compression. Parallel benchmark running on 16 cores, 16 goroutines.

AMD64 assembly is use for both S2 and Snappy.

| Absolute Perf         | Snappy size | S2 Size | Snappy Speed | S2 Speed    | Snappy dec  | S2 dec      |
|-----------------------|-------------|---------|--------------|-------------|-------------|-------------|
| html                  | 22843       | 21111   | 16246 MB/s   | 17438 MB/s  | 40972 MB/s  | 49263 MB/s  |
| urls.10K              | 335492      | 287326  | 7943 MB/s    | 9693 MB/s   | 22523 MB/s  | 26484 MB/s  |
| fireworks.jpeg        | 123034      | 123100  | 349544 MB/s  | 273889 MB/s | 718321 MB/s | 827552 MB/s |
| fireworks.jpeg (200B) | 146         | 155     | 8869 MB/s    | 17773 MB/s  | 33691 MB/s  | 52421 MB/s  |
| paper-100k.pdf        | 85304       | 84459   | 167546 MB/s  | 101263 MB/s | 326905 MB/s | 291944 MB/s |
| html_x_4              | 92234       | 21113   | 15194 MB/s   | 50670 MB/s  | 30843 MB/s  | 32217 MB/s  |
| alice29.txt           | 88034       | 85975   | 5936 MB/s    | 6139 MB/s   | 12882 MB/s  | 20044 MB/s  |
| asyoulik.txt          | 77503       | 79650   | 5517 MB/s    | 6366 MB/s   | 12735 MB/s  | 22806 MB/s  |
| lcet10.txt            | 234661      | 220670  | 6235 MB/s    | 6067 MB/s   | 14519 MB/s  | 18697 MB/s  |
| plrabn12.txt          | 319267      | 317985  | 5159 MB/s    | 5726 MB/s   | 11923 MB/s  | 19901 MB/s  |
| geo.protodata         | 23335       | 18690   | 21220 MB/s   | 26529 MB/s  | 56271 MB/s  | 62540 MB/s  |
| kppkn.gtb             | 69526       | 65312   | 9732 MB/s    | 8559 MB/s   | 18491 MB/s  | 18969 MB/s  |
| alice29.txt (128B)    | 80          | 82      | 6691 MB/s    | 15489 MB/s  | 31883 MB/s  | 38874 MB/s  |
| alice29.txt (1000B)   | 774         | 774     | 12204 MB/s   | 13000 MB/s  | 48056 MB/s  | 52341 MB/s  |
| alice29.txt (10000B)  | 6648        | 6933    | 10044 MB/s   | 12806 MB/s  | 32378 MB/s  | 46322 MB/s  |
| alice29.txt (20000B)  | 12686       | 13574   | 7733 MB/s    | 11210 MB/s  | 30566 MB/s  | 58969 MB/s  |


| Relative Perf         | Snappy size | S2 size improved | S2 Speed | S2 Dec Speed |
|-----------------------|-------------|------------------|----------|--------------|
| html                  | 22.31%      | 7.58%            | 1.07x    | 1.20x        |
| urls.10K              | 47.78%      | 14.36%           | 1.22x    | 1.18x        |
| fireworks.jpeg        | 99.95%      | -0.05%           | 0.78x    | 1.15x        |
| fireworks.jpeg (200B) | 73.00%      | -6.16%           | 2.00x    | 1.56x        |
| paper-100k.pdf        | 83.30%      | 0.99%            | 0.60x    | 0.89x        |
| html_x_4              | 22.52%      | 77.11%           | 3.33x    | 1.04x        |
| alice29.txt           | 57.88%      | 2.34%            | 1.03x    | 1.56x        |
| asyoulik.txt          | 61.91%      | -2.77%           | 1.15x    | 1.79x        |
| lcet10.txt            | 54.99%      | 5.96%            | 0.97x    | 1.29x        |
| plrabn12.txt          | 66.26%      | 0.40%            | 1.11x    | 1.67x        |
| geo.protodata         | 19.68%      | 19.91%           | 1.25x    | 1.11x        |
| kppkn.gtb             | 37.72%      | 6.06%            | 0.88x    | 1.03x        |
| alice29.txt (128B)    | 62.50%      | -2.50%           | 2.31x    | 1.22x        |
| alice29.txt (1000B)   | 77.40%      | 0.00%            | 1.07x    | 1.09x        |
| alice29.txt (10000B)  | 66.48%      | -4.29%           | 1.27x    | 1.43x        |
| alice29.txt (20000B)  | 63.43%      | -7.00%           | 1.45x    | 1.93x        |

Speed is generally at or above Snappy. Small blocks gets a significant speedup, although at the expense of size. 

Decompression speed is better than Snappy, except in one case. 

Since payloads are very small the variance in terms of size is rather big, so they should only be seen as a general guideline.

Size is on average around Snappy, but varies on content type. 
In cases where compression is worse, it usually is compensated by a speed boost. 


### Better compression

Benchmarking single block performance is subject to a lot more variation since it only tests a limited number of file patterns.
So individual benchmarks should only be seen as a guideline and the overall picture is more important.

| Absolute Perf         | Snappy size | Better Size | Snappy Speed | Better Speed | Snappy dec  | Better dec  |
|-----------------------|-------------|-------------|--------------|--------------|-------------|-------------|
| html                  | 22843       | 19833       | 16246 MB/s   | 7731 MB/s    | 40972 MB/s  | 40292 MB/s  |
| urls.10K              | 335492      | 253529      | 7943 MB/s    | 3980 MB/s    | 22523 MB/s  | 20981 MB/s  |
| fireworks.jpeg        | 123034      | 123100      | 349544 MB/s  | 9760 MB/s    | 718321 MB/s | 823698 MB/s |
| fireworks.jpeg (200B) | 146         | 142         | 8869 MB/s    | 594 MB/s     | 33691 MB/s  | 30101 MB/s  |
| paper-100k.pdf        | 85304       | 82915       | 167546 MB/s  | 7470 MB/s    | 326905 MB/s | 198869 MB/s |
| html_x_4              | 92234       | 19841       | 15194 MB/s   | 23403 MB/s   | 30843 MB/s  | 30937 MB/s  |
| alice29.txt           | 88034       | 73218       | 5936 MB/s    | 2945 MB/s    | 12882 MB/s  | 16611 MB/s  |
| asyoulik.txt          | 77503       | 66844       | 5517 MB/s    | 2739 MB/s    | 12735 MB/s  | 14975 MB/s  |
| lcet10.txt            | 234661      | 190589      | 6235 MB/s    | 3099 MB/s    | 14519 MB/s  | 16634 MB/s  |
| plrabn12.txt          | 319267      | 270828      | 5159 MB/s    | 2600 MB/s    | 11923 MB/s  | 13382 MB/s  |
| geo.protodata         | 23335       | 18278       | 21220 MB/s   | 11208 MB/s   | 56271 MB/s  | 57961 MB/s  |
| kppkn.gtb             | 69526       | 61851       | 9732 MB/s    | 4556 MB/s    | 18491 MB/s  | 16524 MB/s  |
| alice29.txt (128B)    | 80          | 81          | 6691 MB/s    | 529 MB/s     | 31883 MB/s  | 34225 MB/s  |
| alice29.txt (1000B)   | 774         | 748         | 12204 MB/s   | 1943 MB/s    | 48056 MB/s  | 42068 MB/s  |
| alice29.txt (10000B)  | 6648        | 6234        | 10044 MB/s   | 2949 MB/s    | 32378 MB/s  | 28813 MB/s  |
| alice29.txt (20000B)  | 12686       | 11584       | 7733 MB/s    | 2822 MB/s    | 30566 MB/s  | 27315 MB/s  |


| Relative Perf         | Snappy size | Better size | Better Speed | Better dec |
|-----------------------|-------------|-------------|--------------|------------|
| html                  | 22.31%      | 13.18%      | 0.48x        | 0.98x      |
| urls.10K              | 47.78%      | 24.43%      | 0.50x        | 0.93x      |
| fireworks.jpeg        | 99.95%      | -0.05%      | 0.03x        | 1.15x      |
| fireworks.jpeg (200B) | 73.00%      | 2.74%       | 0.07x        | 0.89x      |
| paper-100k.pdf        | 83.30%      | 2.80%       | 0.07x        | 0.61x      |
| html_x_4              | 22.52%      | 78.49%      | 0.04x        | 1.00x      |
| alice29.txt           | 57.88%      | 16.83%      | 1.54x        | 1.29x      |
| asyoulik.txt          | 61.91%      | 13.75%      | 0.50x        | 1.18x      |
| lcet10.txt            | 54.99%      | 18.78%      | 0.50x        | 1.15x      |
| plrabn12.txt          | 66.26%      | 15.17%      | 0.50x        | 1.12x      |
| geo.protodata         | 19.68%      | 21.67%      | 0.50x        | 1.03x      |
| kppkn.gtb             | 37.72%      | 11.04%      | 0.53x        | 0.89x      |
| alice29.txt (128B)    | 62.50%      | -1.25%      | 0.47x        | 1.07x      |
| alice29.txt (1000B)   | 77.40%      | 3.36%       | 0.08x        | 0.88x      |
| alice29.txt (10000B)  | 66.48%      | 6.23%       | 0.16x        | 0.89x      |
| alice29.txt (20000B)  | 63.43%      | 8.69%       | 0.29x        | 0.89x      |

Except for the mostly incompressible JPEG image compression is better and usually in the 
double digits in terms of percentage reduction over Snappy.

The PDF sample shows a significant slowdown compared to Snappy, as this mode tries harder 
to compress the data. Very small blocks are also not favorable for better compression, so throughput is way down.

This mode aims to provide better compression at the expense of performance and achieves that 
without a huge performance penalty, except on very small blocks. 

Decompression speed suffers a little compared to the regular S2 mode, 
but still manages to be close to Snappy in spite of increased compression.  
 
# Best compression mode

S2 offers a "best" compression mode. 

This will compress as much as possible with little regard to CPU usage.

Mainly for offline compression, but where decompression speed should still
be high and compatible with other S2 compressed data.

Some examples compared on 16 core CPU, amd64 assembly used:

```
* enwik10
Default... 10000000000 -> 4761467548 [47.61%]; 1.098s, 8685.6MB/s
Better...  10000000000 -> 4219438251 [42.19%]; 1.925s, 4954.2MB/s
Best...    10000000000 -> 3627364337 [36.27%]; 43.051s, 221.5MB/s

* github-june-2days-2019.json
Default... 6273951764 -> 1043196283 [16.63%]; 431ms, 13882.3MB/s
Better...  6273951764 -> 949146808 [15.13%]; 547ms, 10938.4MB/s
Best...    6273951764 -> 832855506 [13.27%]; 9.455s, 632.8MB/s

* nyc-taxi-data-10M.csv
Default... 3325605752 -> 1095998837 [32.96%]; 324ms, 9788.7MB/s
Better...  3325605752 -> 954776589 [28.71%]; 491ms, 6459.4MB/s
Best...    3325605752 -> 779098746 [23.43%]; 8.29s, 382.6MB/s

* 10gb.tar
Default... 10065157632 -> 5916578242 [58.78%]; 1.028s, 9337.4MB/s
Better...  10065157632 -> 5649207485 [56.13%]; 1.597s, 6010.6MB/s
Best...    10065157632 -> 5208719802 [51.75%]; 32.78s, 292.8MB/

* consensus.db.10gb
Default... 10737418240 -> 4562648848 [42.49%]; 882ms, 11610.0MB/s
Better...  10737418240 -> 4542428129 [42.30%]; 1.533s, 6679.7MB/s
Best...    10737418240 -> 4244773384 [39.53%]; 42.96s, 238.4MB/s
```

Decompression speed should be around the same as using the 'better' compression mode. 

# Snappy Compatibility

S2 now offers full compatibility with Snappy.

This means that the efficient encoders of S2 can be used to generate fully Snappy compatible output.

There is a [snappy](https://github.com/klauspost/compress/tree/master/snappy) package that can be used by
simply changing imports from `github.com/golang/snappy` to `github.com/klauspost/compress/snappy`.
This uses "better" mode for all operations.
If you would like more control, you can use the s2 package as described below: 

## Blocks

Snappy compatible blocks can be generated with the S2 encoder. 
Compression and speed is typically a bit better `MaxEncodedLen` is also smaller for smaller memory usage. Replace 

| Snappy                     | S2 replacement          |
|----------------------------|-------------------------|
| snappy.Encode(...)         | s2.EncodeSnappy(...)   |
| snappy.MaxEncodedLen(...)  | s2.MaxEncodedLen(...)   |

`s2.EncodeSnappy` can be replaced with `s2.EncodeSnappyBetter` or `s2.EncodeSnappyBest` to get more efficiently compressed snappy compatible output. 

`s2.ConcatBlocks` is compatible with snappy blocks.

Comparison of [`webdevdata.org-2015-01-07-subset`](https://files.klauspost.com/compress/webdevdata.org-2015-01-07-4GB-subset.7z),
53927 files, total input size: 4,014,735,833 bytes. amd64, single goroutine used:

| Encoder               | Size       | MB/s       | Reduction |
|-----------------------|------------|------------|------------
| snappy.Encode         | 1128706759 | 725.59     | 71.89%    |
| s2.EncodeSnappy       | 1093823291 | **899.16** | 72.75%    |
| s2.EncodeSnappyBetter | 1001158548 | 578.49     | 75.06%    |
| s2.EncodeSnappyBest   | 944507998  | 66.00      | **76.47%**|

## Streams

For streams, replace `enc = snappy.NewBufferedWriter(w)` with `enc = s2.NewWriter(w, s2.WriterSnappyCompat())`.
All other options are available, but note that block size limit is different for snappy.

Comparison of different streams, AMD Ryzen 3950x, 16 cores. Size and throughput: 

| File                        | snappy.NewWriter         | S2 Snappy                 | S2 Snappy, Better        | S2 Snappy, Best         |
|-----------------------------|--------------------------|---------------------------|--------------------------|-------------------------|
| nyc-taxi-data-10M.csv       | 1316042016 - 539.47MB/s  | 1307003093 - 10132.73MB/s | 1174534014 - 5002.44MB/s | 1115904679 - 177.97MB/s |
| enwik10 (xml)               | 5088294643 - 451.13MB/s  | 5175840939 -  9440.69MB/s | 4560784526 - 4487.21MB/s | 4340299103 - 158.92MB/s |
| 10gb.tar (mixed)            | 6056946612 - 729.73MB/s  | 6208571995 -  9978.05MB/s | 5741646126 - 4919.98MB/s | 5548973895 - 180.44MB/s |
| github-june-2days-2019.json | 1525176492 - 933.00MB/s  | 1476519054 - 13150.12MB/s | 1400547532 - 5803.40MB/s | 1321887137 - 204.29MB/s |
| consensus.db.10gb (db)      | 5412897703 - 1102.14MB/s | 5354073487 - 13562.91MB/s | 5335069899 - 5294.73MB/s | 5201000954 - 175.72MB/s |

# Decompression

All decompression functions map directly to equivalent s2 functions.

| Snappy                 | S2 replacement     |
|------------------------|--------------------|
| snappy.Decode(...)     | s2.Decode(...)     |
| snappy.DecodedLen(...) | s2.DecodedLen(...) |
| snappy.NewReader(...)  | s2.NewReader(...)  |

Features like [quick forward skipping without decompression](https://pkg.go.dev/github.com/klauspost/compress/s2#Reader.Skip)
are also available for Snappy streams.

If you know you are only decompressing snappy streams, setting [`ReaderMaxBlockSize(64<<10)`](https://pkg.go.dev/github.com/klauspost/compress/s2#ReaderMaxBlockSize)
on your Reader will reduce memory consumption.

# Concatenating blocks and streams.

Concatenating streams will concatenate the output of both without recompressing them. 
While this is inefficient in terms of compression it might be usable in certain scenarios. 
The 10 byte 'stream identifier' of the second stream can optionally be stripped, but it is not a requirement.

Blocks can be concatenated using the `ConcatBlocks` function.

Snappy blocks/streams can safely be concatenated with S2 blocks and streams.
Streams with indexes (see below) will currently not work on concatenated streams.

# Stream Seek Index

S2 and Snappy streams can have indexes. These indexes will allow random seeking within the compressed data.

The index can either be appended to the stream as a skippable block or returned for separate storage.

When the index is appended to a stream it will be skipped by regular decoders, 
so the output remains compatible with other decoders. 

## Creating an Index

To automatically add an index to a stream, add `WriterAddIndex()` option to your writer.
Then the index will be added to the stream when `Close()` is called.

```
	// Add Index to stream...
	enc := s2.NewWriter(w, s2.WriterAddIndex())
	io.Copy(enc, r)
	enc.Close()
```

If you want to store the index separately, you can use `CloseIndex()` instead of the regular `Close()`.
This will return the index. Note that `CloseIndex()` should only be called once, and you shouldn't call `Close()`.

```
	// Get index for separate storage... 
	enc := s2.NewWriter(w)
	io.Copy(enc, r)
	index, err := enc.CloseIndex()
```

The `index` can then be used needing to read from the stream. 
This means the index can be used without needing to seek to the end of the stream 
or for manually forwarding streams. See below.

Finally, an existing S2/Snappy stream can be indexed using the `s2.IndexStream(r io.Reader)` function.

## Using Indexes

To use indexes there is a `ReadSeeker(random bool, index []byte) (*ReadSeeker, error)` function available.

Calling ReadSeeker will return an [io.ReadSeeker](https://pkg.go.dev/io#ReadSeeker) compatible version of the reader.

If 'random' is specified the returned io.Seeker can be used for random seeking, otherwise only forward seeking is supported.
Enabling random seeking requires the original input to support the [io.Seeker](https://pkg.go.dev/io#Seeker) interface.

```
	dec := s2.NewReader(r)
	rs, err := dec.ReadSeeker(false, nil)
	rs.Seek(wantOffset, io.SeekStart)	
```

Get a seeker to seek forward. Since no index is provided, the index is read from the stream.
This requires that an index was added and that `r` supports the [io.Seeker](https://pkg.go.dev/io#Seeker) interface.

A custom index can be specified which will be used if supplied.
When using a custom index, it will not be read from the input stream.

```
	dec := s2.NewReader(r)
	rs, err := dec.ReadSeeker(false, index)
	rs.Seek(wantOffset, io.SeekStart)	
```

This will read the index from `index`. Since we specify non-random (forward only) seeking `r` does not have to be an io.Seeker

```
	dec := s2.NewReader(r)
	rs, err := dec.ReadSeeker(true, index)
	rs.Seek(wantOffset, io.SeekStart)	
```

Finally, since we specify that we want to do random seeking `r` must be an io.Seeker. 

The returned [ReadSeeker](https://pkg.go.dev/github.com/klauspost/compress/s2#ReadSeeker) contains a shallow reference to the existing Reader,
meaning changes performed to one is reflected in the other.

To check if a stream contains an index at the end, the `(*Index).LoadStream(rs io.ReadSeeker) error` can be used.

## Manually Forwarding Streams

Indexes can also be read outside the decoder using the [Index](https://pkg.go.dev/github.com/klauspost/compress/s2#Index) type.
This can be used for parsing indexes, either separate or in streams.

In some cases it may not be possible to serve a seekable stream.
This can for instance be an HTTP stream, where the Range request 
is sent at the start of the stream. 

With a little bit of extra code it is still possible to use indexes
to forward to specific offset with a single forward skip. 

It is possible to load the index manually like this: 
```
	var index s2.Index
	_, err = index.Load(idxBytes)
```

This can be used to figure out how much to offset the compressed stream:

```
	compressedOffset, uncompressedOffset, err := index.Find(wantOffset)
```

The `compressedOffset` is the number of bytes that should be skipped 
from the beginning of the compressed file.

The `uncompressedOffset` will then be offset of the uncompressed bytes returned
when decoding from that position. This will always be <= wantOffset.

When creating a decoder it must be specified that it should *not* expect a stream identifier
at the beginning of the stream. Assuming the io.Reader `r` has been forwarded to `compressedOffset`
we create the decoder like this:

```
	dec := s2.NewReader(r, s2.ReaderIgnoreStreamIdentifier())
```

We are not completely done. We still need to forward the stream the uncompressed bytes we didn't want.
This is done using the regular "Skip" function:

```
	err = dec.Skip(wantOffset - uncompressedOffset)
```

This will ensure that we are at exactly the offset we want, and reading from `dec` will start at the requested offset.

## Index Format:

Each block is structured as a snappy skippable block, with the chunk ID 0x99.

The block can be read from the front, but contains information so it can be read from the back as well.

Numbers are stored as fixed size little endian values or [zigzag encoded](https://developers.google.com/protocol-buffers/docs/encoding#signed_integers) [base 128 varints](https://developers.google.com/protocol-buffers/docs/encoding), 
with un-encoded value length of 64 bits, unless other limits are specified. 

| Content                                                                   | Format                                                                                                                      |
|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| ID, `[1]byte`                                                           | Always 0x99.                                                                                                                  |
| Data Length, `[3]byte`                                                  | 3 byte little-endian length of the chunk in bytes, following this.                                                            |
| Header `[6]byte`                                                        | Header, must be `[115, 50, 105, 100, 120, 0]` or in text: "s2idx\x00".                                                        |
| UncompressedSize, Varint                                                | Total Uncompressed size.                                                                                                      |
| CompressedSize, Varint                                                  | Total Compressed size if known. Should be -1 if unknown.                                                                      |
| EstBlockSize, Varint                                                    | Block Size, used for guessing uncompressed offsets. Must be >= 0.                                                             |
| Entries, Varint                                                         | Number of Entries in index, must be < 65536 and >=0.                                                                          |
| HasUncompressedOffsets `byte`                                           | 0 if no uncompressed offsets are present, 1 if present. Other values are invalid.                                             |
| UncompressedOffsets, [Entries]VarInt                                    | Uncompressed offsets. See below how to decode.                                                                                |
| CompressedOffsets, [Entries]VarInt                                      | Compressed offsets. See below how to decode.                                                                                  |
| Block Size, `[4]byte`                                                   | Little Endian total encoded size (including header and trailer). Can be used for searching backwards to start of block.       |
| Trailer `[6]byte`                                                       | Trailer, must be `[0, 120, 100, 105, 50, 115]` or in text: "\x00xdi2s". Can be used for identifying block from end of stream. |

For regular streams the uncompressed offsets are fully predictable,
so `HasUncompressedOffsets` allows to specify that compressed blocks all have 
exactly `EstBlockSize` bytes of uncompressed content.

Entries *must* be in order, starting with the lowest offset, 
and there *must* be no uncompressed offset duplicates.  
Entries *may* point to the start of a skippable block, 
but it is then not allowed to also have an entry for the next block since 
that would give an uncompressed offset duplicate.

There is no requirement for all blocks to be represented in the index. 
In fact there is a maximum of 65536 block entries in an index.

The writer can use any method to reduce the number of entries.
An implicit block start at 0,0 can be assumed.

### Decoding entries:

```
// Read Uncompressed entries.
// Each assumes EstBlockSize delta from previous.
for each entry {
    uOff = 0
    if HasUncompressedOffsets == 1 {
        uOff = ReadVarInt // Read value from stream
    }
   
    // Except for the first entry, use previous values.
    if entryNum == 0 {
        entry[entryNum].UncompressedOffset = uOff
        continue
    }
    
    // Uncompressed uses previous offset and adds EstBlockSize
    entry[entryNum].UncompressedOffset = entry[entryNum-1].UncompressedOffset + EstBlockSize
}


// Guess that the first block will be 50% of uncompressed size.
// Integer truncating division must be used.
CompressGuess := EstBlockSize / 2

// Read Compressed entries.
// Each assumes CompressGuess delta from previous.
// CompressGuess is adjusted for each value.
for each entry {
    cOff = ReadVarInt // Read value from stream
    
    // Except for the first entry, use previous values.
    if entryNum == 0 {
        entry[entryNum].CompressedOffset = cOff
        continue
    }
    
    // Compressed uses previous and our estimate.
    entry[entryNum].CompressedOffset = entry[entryNum-1].CompressedOffset + CompressGuess + cOff
        
     // Adjust compressed offset for next loop, integer truncating division must be used. 
     CompressGuess += cOff/2               
}
```

# Format Extensions

* Frame [Stream identifier](https://github.com/google/snappy/blob/master/framing_format.txt#L68) changed from `sNaPpY` to `S2sTwO`.
* [Framed compressed blocks](https://github.com/google/snappy/blob/master/format_description.txt) can be up to 4MB (up from 64KB).
* Compressed blocks can have an offset of `0`, which indicates to repeat the last seen offset.

Repeat offsets must be encoded as a [2.2.1. Copy with 1-byte offset (01)](https://github.com/google/snappy/blob/master/format_description.txt#L89), where the offset is 0.

The length is specified by reading the 3-bit length specified in the tag and decode using this table:

| Length | Actual Length        |
|--------|----------------------|
| 0      | 4                    |
| 1      | 5                    |
| 2      | 6                    |
| 3      | 7                    |
| 4      | 8                    |
| 5      | 8 + read 1 byte      |
| 6      | 260 + read 2 bytes   |
| 7      | 65540 + read 3 bytes |

This allows any repeat offset + length to be represented by 2 to 5 bytes.

Lengths are stored as little endian values.

The first copy of a block cannot be a repeat offset and the offset is not carried across blocks in streams.

Default streaming block size is 1MB.

# LICENSE

This code is based on the [Snappy-Go](https://github.com/golang/snappy) implementation.

Use of this source code is governed by a BSD-style license that can be found in the LICENSE file.
