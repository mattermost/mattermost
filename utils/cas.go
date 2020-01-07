package utils

import (
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
)

// CasServerURL holds the CAS server URL
const CasServerURL string = "https://www.youshengyun.com/sso"

/*
CheckIfUserIsAuthenticated 判断当前访问是否已认证
*/
func CheckIfUserIsAuthenticated(w http.ResponseWriter, r *http.Request) (bool, string) {
	var ticketIsValid bool = false
	var userName string
	if !hasTicket(r) {
		// redirectToCasServer(w, r)
		return ticketIsValid, userName
	}
	ticketIsValid, userName = verifyTicket(r)
    fmt.Println("verifyTicket: ", ticketIsValid, userName)
	if !ticketIsValid {
		// redirectToCasServer(w, r)
		return false, userName
	}
	return ticketIsValid, userName
}

/*
重定向到CAS认证中心
*/
func redirectToCasServer(w http.ResponseWriter, r *http.Request) {
	var casAuthCenterURL string = CasServerURL + "/login?service=" + getLocalURL(r)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	http.Redirect(w, r, casAuthCenterURL, http.StatusFound)
}

/*
验证访问路径中的ticket是否有效
*/
func verifyTicket(r *http.Request) (bool, string) {
	var userName string
	var casAuthCenterURL string = CasServerURL + "/serviceValidate?" + r.URL.RawQuery
	res, err := http.Get(casAuthCenterURL)
	if err != nil {
		return false, userName
	}
	defer res.Body.Close()

	data, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return false, userName
	}

	dataStr := string(data)
	fmt.Println("ticket verification results: ", dataStr)
	if !strings.Contains(dataStr, "cas:authenticationSuccess") {
		return false, userName
	}
	userName = extractUserName(dataStr)
	return true, userName
}

// function extractUserName is use to extract the user name from xml response
// it presumes that it is a success response
func extractUserName(xmlResponse string) string {

	type Response struct {
		XMLName  xml.Name `xml:"serviceResponse"`
		UserName string   `xml:"authenticationSuccess>user"`
	}

	// replace all substring 'cas:' with blank string
	// or it won't be able to be parsed properly
	var data = []byte(strings.ReplaceAll(xmlResponse, "cas:", ""))
	var res Response
	xml.Unmarshal(data, &res)

	return res.UserName
}

/*
从请求中获取访问路径
*/
func getLocalURL(r *http.Request) string {
	scheme := "http://"
	if r.TLS != nil {
		scheme = "https://"
	}
	url := strings.Join([]string{scheme, r.Host, r.RequestURI}, "")
	slice := strings.Split(url, "?")
	if len(slice) > 1 {
		localURL := slice[0]
		urlParamStr := ensureOneTicketParam(slice[1])
		url = localURL + "?" + urlParamStr
	}
	return url
}

/*
处理并确保路径中只有一个ticket参数
*/
func ensureOneTicketParam(urlParams string) string {
	if len(urlParams) == 0 || !strings.Contains(urlParams, "ticket") {
		return urlParams
	}

	sep := "&"
	params := strings.Split(urlParams, sep)

	newParams := ""
	ticket := ""
	for _, value := range params {
		if strings.Contains(value, "ticket") {
			ticket = value
			continue
		}

		if len(newParams) == 0 {
			newParams = value
		} else {
			newParams = newParams + sep + value
		}

	}
	newParams = newParams + sep + ticket
	return newParams
}

/*
获取ticket
*/
func getTicket(r *http.Request) string {
	return r.FormValue("ticket")
}

/*
判断是否有ticket
*/
func hasTicket(r *http.Request) bool {
	t := getTicket(r)
	return len(t) != 0
}
