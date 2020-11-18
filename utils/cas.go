package utils

import (
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
)

// CasServerURL holds the CAS server URL
// const CasServerURL string = "http://10.151.190.200/sso" // 51
// const CasServerURL string = "http://192.168.31.102/sso" // 51test
const CasServerURL string = "https://www.youshengyun.com/sso"

/*
CheckIfUserIsAuthenticated 判断当前访问是否已认证
*/
func CheckIfUserIsAuthenticated(w http.ResponseWriter, r *http.Request) (bool, string, string, string) {
	if !hasTicket(r) {
		// redirectToCasServer(w, r)
		return false, "", "", ""
	}

	ticketIsValid, userName, nickName, email := verifyTicket(r)
	fmt.Println("verifyTicket: ", ticketIsValid, userName)
	if !ticketIsValid {
		// redirectToCasServer(w, r)
		return false, "", "", ""
	}
	return ticketIsValid, userName, nickName, email
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
func verifyTicket(r *http.Request) (bool, string, string, string) {

	casAuthCenterURL := CasServerURL + "/p3/serviceValidate?" + r.URL.RawQuery

	res, err := http.Get(casAuthCenterURL)
	if err != nil {
		return false, "", "", ""
	}
	defer res.Body.Close()

	data, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return false, "", "", ""
	}

	dataStr := string(data)
	fmt.Println("ticket verification results: ", dataStr)
	if !strings.Contains(dataStr, "cas:authenticationSuccess") {
		return false, "", "", ""
	}
	userName := extractUserName(dataStr)
	nickName := extractNickName(dataStr)
	email := extractEmail(dataStr)
	return true, userName, nickName, email
}

// function extractUserName is use to extract the user name from xml response
// it presumes that it is a success response
func extractUserName(xmlResponse string) string {

	type Response struct {
		XMLName  xml.Name `xml:"serviceResponse"`
		UserName string   `xml:"authenticationSuccess>user"`
		PersonId string   `xml:"authenticationSuccess>attributes>personID"`
	}

	// replace all substring 'cas:' with blank string
	// or it won't be able to be parsed properly
	var data = []byte(strings.ReplaceAll(xmlResponse, "cas:", ""))
	var res Response
	xml.Unmarshal(data, &res)

	return res.PersonId
}

// function extractUserName is use to extract the user name from xml response
// it presumes that it is a success response
func extractNickName(xmlResponse string) string {

	type Response struct {
		XMLName  xml.Name `xml:"serviceResponse"`
		PersonId string   `xml:"authenticationSuccess>attributes>personID"`
		NickName string   `xml:"authenticationSuccess>attributes>name"`
	}

	// replace all substring 'cas:' with blank string
	// or it won't be able to be parsed properly
	var data = []byte(strings.ReplaceAll(xmlResponse, "cas:", ""))
	var res Response
	xml.Unmarshal(data, &res)

	return res.NickName
}

func extractEmail(xmlResponse string) string {

	type Response struct {
		XMLName  xml.Name `xml:"serviceResponse"`
		PersonId string   `xml:"authenticationSuccess>attributes>personID"`
		Email    string   `xml:"authenticationSuccess>attributes>Email"`
	}

	// replace all substring 'cas:' with blank string
	// or it won't be able to be parsed properly
	var data = []byte(strings.ReplaceAll(xmlResponse, "cas:", ""))
	var res Response
	xml.Unmarshal(data, &res)

	if len(res.Email) == 0 {
		return res.PersonId + "@risesoft.net"
	} else {
		return res.Email
	}
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
