/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2015, 2016 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package minio

import (
	"bytes"
	"crypto/md5"
	"crypto/sha256"
	"fmt"
	"hash"
	"io"
	"io/ioutil"
	"sort"
)

// uploadedPartRes - the response received from a part upload.
type uploadedPartRes struct {
	Error   error // Any error encountered while uploading the part.
	PartNum int   // Number of the part uploaded.
	Size    int64 // Size of the part uploaded.
}

// shouldUploadPartReadAt - verify if part should be uploaded.
func shouldUploadPartReadAt(objPart objectPart, objectParts map[int]objectPart) bool {
	// If part not found part should be uploaded.
	uploadedPart, found := objectParts[objPart.PartNumber]
	if !found {
		return true
	}
	// if size mismatches part should be uploaded.
	if uploadedPart.Size != objPart.Size {
		return true
	}
	return false
}

// putObjectMultipartFromReadAt - Uploads files bigger than 5MiB. Supports reader
// of type which implements io.ReaderAt interface (ReadAt method).
//
// NOTE: This function is meant to be used for all readers which
// implement io.ReaderAt which allows us for resuming multipart
// uploads but reading at an offset, which would avoid re-read the
// data which was already uploaded. Internally this function uses
// temporary files for staging all the data, these temporary files are
// cleaned automatically when the caller i.e http client closes the
// stream after uploading all the contents successfully.
func (c Client) putObjectMultipartFromReadAt(bucketName, objectName string, reader io.ReaderAt, size int64, contentType string, progress io.Reader) (n int64, err error) {
	// Input validation.
	if err := isValidBucketName(bucketName); err != nil {
		return 0, err
	}
	if err := isValidObjectName(objectName); err != nil {
		return 0, err
	}

	// Get upload id for an object, initiates a new multipart request
	// if it cannot find any previously partially uploaded object.
	uploadID, isNew, err := c.getUploadID(bucketName, objectName, contentType)
	if err != nil {
		return 0, err
	}

	// Total data read and written to server. should be equal to 'size' at the end of the call.
	var totalUploadedSize int64

	// Complete multipart upload.
	var complMultipartUpload completeMultipartUpload

	// A map of all uploaded parts.
	var partsInfo = make(map[int]objectPart)

	// Fetch all parts info previously uploaded.
	if !isNew {
		partsInfo, err = c.listObjectParts(bucketName, objectName, uploadID)
		if err != nil {
			return 0, err
		}
	}

	// Calculate the optimal parts info for a given size.
	totalPartsCount, partSize, lastPartSize, err := optimalPartInfo(size)
	if err != nil {
		return 0, err
	}

	// Used for readability, lastPartNumber is always totalPartsCount.
	lastPartNumber := totalPartsCount

	// Declare a channel that sends the next part number to be uploaded.
	// Buffered to 10000 because thats the maximum number of parts allowed
	// by S3.
	uploadPartsCh := make(chan int, 10000)

	// Declare a channel that sends back the response of a part upload.
	// Buffered to 10000 because thats the maximum number of parts allowed
	// by S3.
	uploadedPartsCh := make(chan uploadedPartRes, 10000)

	// Send each part number to the channel to be processed.
	for p := 1; p <= totalPartsCount; p++ {
		uploadPartsCh <- p
	}
	close(uploadPartsCh)

	// Receive each part number from the channel allowing three parallel uploads.
	for w := 1; w <= 3; w++ {
		go func() {
			// Read defaults to reading at 5MiB buffer.
			readAtBuffer := make([]byte, optimalReadBufferSize)

			// Each worker will draw from the part channel and upload in parallel.
			for partNumber := range uploadPartsCh {
				// Declare a  new tmpBuffer.
				tmpBuffer := new(bytes.Buffer)

				// Verify object if its uploaded.
				verifyObjPart := objectPart{
					PartNumber: partNumber,
					Size:       partSize,
				}
				// Special case if we see a last part number, save last part
				// size as the proper part size.
				if partNumber == lastPartNumber {
					verifyObjPart.Size = lastPartSize
				}

				// Only upload the necessary parts. Otherwise return size through channel
				// to update any progress bar.
				if shouldUploadPartReadAt(verifyObjPart, partsInfo) {
					// If partNumber was not uploaded we calculate the missing
					// part offset and size. For all other part numbers we
					// calculate offset based on multiples of partSize.
					readOffset := int64(partNumber-1) * partSize
					missingPartSize := partSize

					// As a special case if partNumber is lastPartNumber, we
					// calculate the offset based on the last part size.
					if partNumber == lastPartNumber {
						readOffset = (size - lastPartSize)
						missingPartSize = lastPartSize
					}

					// Get a section reader on a particular offset.
					sectionReader := io.NewSectionReader(reader, readOffset, missingPartSize)

					// Choose the needed hash algorithms to be calculated by hashCopyBuffer.
					// Sha256 is avoided in non-v4 signature requests or HTTPS connections
					hashSums := make(map[string][]byte)
					hashAlgos := make(map[string]hash.Hash)
					hashAlgos["md5"] = md5.New()
					if c.signature.isV4() && !c.secure {
						hashAlgos["sha256"] = sha256.New()
					}

					var prtSize int64
					prtSize, err = hashCopyBuffer(hashAlgos, hashSums, tmpBuffer, sectionReader, readAtBuffer)
					if err != nil {
						// Send the error back through the channel.
						uploadedPartsCh <- uploadedPartRes{
							Size:  0,
							Error: err,
						}
						// Exit the goroutine.
						return
					}

					// Proceed to upload the part.
					var objPart objectPart
					objPart, err = c.uploadPart(bucketName, objectName, uploadID, tmpBuffer, partNumber, hashSums["md5"], hashSums["sha256"], prtSize)
					if err != nil {
						uploadedPartsCh <- uploadedPartRes{
							Size:  0,
							Error: err,
						}
						// Exit the goroutine.
						return
					}
					// Save successfully uploaded part metadata.
					partsInfo[partNumber] = objPart
				}
				// Send successful part info through the channel.
				uploadedPartsCh <- uploadedPartRes{
					Size:    verifyObjPart.Size,
					PartNum: partNumber,
					Error:   nil,
				}
			}
		}()
	}

	// Gather the responses as they occur and update any
	// progress bar.
	for u := 1; u <= totalPartsCount; u++ {
		uploadRes := <-uploadedPartsCh
		if uploadRes.Error != nil {
			return totalUploadedSize, uploadRes.Error
		}
		// Retrieve each uploaded part and store it to be completed.
		part, ok := partsInfo[uploadRes.PartNum]
		if !ok {
			return 0, ErrInvalidArgument(fmt.Sprintf("Missing part number %d", uploadRes.PartNum))
		}
		// Update the totalUploadedSize.
		totalUploadedSize += uploadRes.Size
		// Update the progress bar if there is one.
		if progress != nil {
			if _, err = io.CopyN(ioutil.Discard, progress, uploadRes.Size); err != nil {
				return totalUploadedSize, err
			}
		}
		// Store the parts to be completed in order.
		complMultipartUpload.Parts = append(complMultipartUpload.Parts, completePart{
			ETag:       part.ETag,
			PartNumber: part.PartNumber,
		})
	}

	// Verify if we uploaded all the data.
	if totalUploadedSize != size {
		return totalUploadedSize, ErrUnexpectedEOF(totalUploadedSize, size, bucketName, objectName)
	}

	// Sort all completed parts.
	sort.Sort(completedParts(complMultipartUpload.Parts))
	_, err = c.completeMultipartUpload(bucketName, objectName, uploadID, complMultipartUpload)
	if err != nil {
		return totalUploadedSize, err
	}

	// Return final size.
	return totalUploadedSize, nil
}
