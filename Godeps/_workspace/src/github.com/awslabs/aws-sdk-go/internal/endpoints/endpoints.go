package endpoints

//go:generate go run ../model/cli/gen-endpoints/main.go endpoints.json endpoints_map.go

import "strings"

func EndpointForRegion(svcName, region string) string {
	derivedKeys := []string{
		region + "/" + svcName,
		region + "/*",
		"*/" + svcName,
		"*/*",
	}

	for _, key := range derivedKeys {
		if val, ok := endpointsMap.Endpoints[key]; ok {
			ep := val.Endpoint
			ep = strings.Replace(ep, "{region}", region, -1)
			ep = strings.Replace(ep, "{service}", svcName, -1)
			return ep
		}
	}
	return ""
}
