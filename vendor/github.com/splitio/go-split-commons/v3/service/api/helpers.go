package api

import "github.com/splitio/go-split-commons/v3/dtos"

const (
	splitSDKVersion     = "SplitSDKVersion"
	splitSDKMachineName = "SplitSDKMachineName"
	splitSDKMachineIP   = "SplitSDKMachineIP"
	splitSDKClientKey   = "SplitSDKClientKey"

	unknown = "unknown"
	na      = "NA"
)

// AddMetadataToHeaders adds metadata in headers
func AddMetadataToHeaders(metadata dtos.Metadata, extraHeaders map[string]string, clientKey *string) map[string]string {
	headers := make(map[string]string)
	headers[splitSDKVersion] = metadata.SDKVersion
	if metadata.MachineName != na && metadata.MachineName != unknown {
		headers[splitSDKMachineName] = metadata.MachineName
	}
	if metadata.MachineIP != na && metadata.MachineIP != unknown {
		headers[splitSDKMachineIP] = metadata.MachineIP
	}
	for header, value := range extraHeaders {
		headers[header] = value
	}
	if clientKey != nil {
		headers[splitSDKClientKey] = *clientKey
	}
	return headers
}
