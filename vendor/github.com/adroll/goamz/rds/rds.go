package rds

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httputil"
	"strconv"
	"time"

	"github.com/AdRoll/goamz/aws"
)

const debug = false

const (
	ServiceName = "rds"
	ApiVersion  = "2013-09-09"
)

// The RDS type encapsulates operations within a specific EC2 region.
type RDS struct {
	Service aws.AWSService
	Auth    aws.Auth
	Region  aws.Region
}

// New creates a new RDS Client.
func New(auth aws.Auth, region aws.Region) (*RDS, error) {
	service, err := aws.NewService(auth, region.RDSEndpoint)
	if err != nil {
		return nil, err
	}
	return &RDS{
		Service: service,
		Auth:    auth,
		Region:  region,
	}, nil
}

// ----------------------------------------------------------------------------
// Request dispatching logic.

// query dispatches a request to the RDS API signed with a version 2 signature
func (rds *RDS) query(method, path string, params map[string]string, resp interface{}) error {
	// Add basic RDS param
	params["Version"] = ApiVersion

	r, err := rds.Service.Query(method, path, params)
	if err != nil {
		return err
	}
	defer r.Body.Close()

	if debug {
		dump, _ := httputil.DumpResponse(r, true)
		log.Printf("response:\n")
		log.Printf("%v\n}\n", string(dump))
	}

	if r.StatusCode != 200 {
		return rds.Service.BuildError(r)
	}
	err = xml.NewDecoder(r.Body).Decode(resp)
	return err
}

// ----------------------------------------------------------------------------
// API methods and corresponding response types.

// Response to a DescribeDBInstances request
//
// See http://goo.gl/KSPlAl for more details.
type DescribeDBInstancesResponse struct {
	DBInstances []DBInstance `xml:"DescribeDBInstancesResult>DBInstances>DBInstance"` // The list of database instances
	Marker      string       `xml:"DescribeDBInstancesResult>Marker"`                 // An optional pagination token provided by a previous request
	RequestId   string       `xml:"ResponseMetadata>RequestId"`
}

// DescribeDBInstances - Returns a description of each Database Instance
// Supports pagination by using the "Marker" parameter, and "maxRecords" for subsequent calls
// Unfortunately RDS does not currently support filtering
//
// See http://goo.gl/lzZMyz for more details.
func (rds *RDS) DescribeDBInstances(id string, maxRecords int, marker string) (*DescribeDBInstancesResponse, error) {

	params := aws.MakeParams("DescribeDBInstances")

	if id != "" {
		params["DBInstanceIdentifier"] = id
	}

	if maxRecords != 0 {
		params["MaxRecords"] = strconv.Itoa(maxRecords)
	}
	if marker != "" {
		params["Marker"] = marker
	}

	resp := &DescribeDBInstancesResponse{}
	err := rds.query("POST", "/", params, resp)
	return resp, err
}

type DownloadDBLogFilePortionResponse struct {
	Marker                string `xml:"DownloadDBLogFilePortionResult>Marker"`
	LogFileData           string `xml:"DownloadDBLogFilePortionResult>LogFileData"`
	AdditionalDataPending string `xml:"DownloadDBLogFilePortionResult>AdditionalDataPending"`
	RequestId             string `xml:"ResponseMetadata>RequestId"`
}

// DownloadDBLogFilePortion - Downloads all or a portion of the specified log file
//
// See http://goo.gl/Gfpz9l for more details.
func (rds *RDS) DownloadDBLogFilePortion(id, filename, marker string, numberOfLines int) (*DownloadDBLogFilePortionResponse, error) {

	params := aws.MakeParams("DownloadDBLogFilePortion")

	params["DBInstanceIdentifier"] = id
	params["LogFileName"] = filename

	if marker != "" {
		params["Marker"] = marker
	}
	if numberOfLines != 0 {
		params["NumberOfLines"] = strconv.Itoa(numberOfLines)
	}

	resp := &DownloadDBLogFilePortionResponse{}
	err := rds.query("POST", "/", params, resp)
	return resp, err
}

// DownloadCompleteDBLogFile - Downloads the contents of the specified database log file
//
// See http://goo.gl/plC66B for more details.

func (rds *RDS) DownloadCompleteDBLogFile(id, filename string) (io.ReadCloser, error) {
	url := fmt.Sprintf(
		"%s/v13/downloadCompleteLogFile/%s/%s",
		rds.Region.RDSEndpoint.Endpoint,
		id,
		filename,
	)
	hreq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		if debug {
			log.Printf("Error http.NewRequest GET %s", url)
		}
		return nil, err
	}
	token := rds.Auth.Token()
	if token != "" {
		hreq.Header.Set("X-Amz-Security-Token", token)
	}
	hreq.Header.Set("X-Amz-Date", time.Now().UTC().Format(aws.ISO8601BasicFormat))
	signer := aws.NewV4Signer(rds.Auth, "rds", rds.Region)
	signer.Sign(hreq)
	resp, err := http.DefaultClient.Do(hreq)
	if err != nil {
		if debug {
			log.Print("Error calling Amazon")
		}
		return nil, err
	}
	if resp.StatusCode == 200 {
		return resp.Body, nil
	} else {
		defer resp.Body.Close()
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			if debug {
				log.Printf("Could not read response body")
			}
			return nil, err
		}
		msg := fmt.Sprintf(
			"Responce:\n\tStatusCode: %d\n\tBody: %s\n",
			resp.StatusCode,
			string(body),
		)
		if debug {
			log.Printf(msg)
		}
		err = errors.New(msg)
		return nil, err
	}
}
