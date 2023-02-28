package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v6/boards/api"
	"github.com/mattermost/mattermost-server/v6/boards/model"

	mm_model "github.com/mattermost/mattermost-server/v6/model"
)

const (
	APIURLSuffix = "/api/v2"
)

type RequestReaderError struct {
	buf []byte
}

func (rre RequestReaderError) Error() string {
	return "payload: " + string(rre.buf)
}

type Response struct {
	StatusCode int
	Error      error
	Header     http.Header
}

func BuildResponse(r *http.Response) *Response {
	return &Response{
		StatusCode: r.StatusCode,
		Header:     r.Header,
	}
}

func BuildErrorResponse(r *http.Response, err error) *Response {
	statusCode := 0
	header := make(http.Header)
	if r != nil {
		statusCode = r.StatusCode
		header = r.Header
	}

	return &Response{
		StatusCode: statusCode,
		Error:      err,
		Header:     header,
	}
}

func closeBody(r *http.Response) {
	if r.Body != nil {
		_, _ = io.Copy(io.Discard, r.Body)
		_ = r.Body.Close()
	}
}

func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

type Client struct {
	URL        string
	APIURL     string
	HTTPClient *http.Client
	HTTPHeader map[string]string
	// Token if token is empty indicate client is not login yet
	Token string
}

func NewClient(url, sessionToken string) *Client {
	url = strings.TrimRight(url, "/")

	headers := map[string]string{
		"X-Requested-With": "XMLHttpRequest",
	}

	return &Client{url, url + APIURLSuffix, &http.Client{}, headers, sessionToken}
}

func (c *Client) DoAPIGet(url, etag string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodGet, c.APIURL+url, "", etag)
}

func (c *Client) DoAPIPost(url, data string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodPost, c.APIURL+url, data, "")
}

func (c *Client) DoAPIPatch(url, data string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodPatch, c.APIURL+url, data, "")
}

func (c *Client) DoAPIPut(url, data string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodPut, c.APIURL+url, data, "")
}

func (c *Client) DoAPIDelete(url string, data string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodDelete, c.APIURL+url, data, "")
}

func (c *Client) DoAPIRequest(method, url, data, etag string) (*http.Response, error) {
	return c.doAPIRequestReader(method, url, strings.NewReader(data), etag)
}

type requestOption func(r *http.Request)

func (c *Client) doAPIRequestReader(method, url string, data io.Reader, _ /* etag */ string, opts ...requestOption) (*http.Response, error) {
	rq, err := http.NewRequest(method, url, data)
	if err != nil {
		return nil, err
	}

	for _, opt := range opts {
		opt(rq)
	}

	if c.HTTPHeader != nil && len(c.HTTPHeader) > 0 {
		for k, v := range c.HTTPHeader {
			rq.Header.Set(k, v)
		}
	}

	if c.Token != "" {
		rq.Header.Set("Authorization", "Bearer "+c.Token)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil || rp == nil {
		return nil, err
	}

	if rp.StatusCode == http.StatusNotModified {
		return rp, nil
	}

	if rp.StatusCode >= http.StatusMultipleChoices {
		defer closeBody(rp)
		b, err := io.ReadAll(rp.Body)
		if err != nil {
			return rp, fmt.Errorf("error when parsing response with code %d: %w", rp.StatusCode, err)
		}
		return rp, RequestReaderError{b}
	}

	return rp, nil
}

func (c *Client) GetTeamRoute(teamID string) string {
	return fmt.Sprintf("%s/%s", c.GetTeamsRoute(), teamID)
}

func (c *Client) GetTeamsRoute() string {
	return "/teams"
}

func (c *Client) GetBlockRoute(boardID, blockID string) string {
	return fmt.Sprintf("%s/%s", c.GetBlocksRoute(boardID), blockID)
}

func (c *Client) GetBoardsRoute() string {
	return "/boards"
}

func (c *Client) GetBoardRoute(boardID string) string {
	return fmt.Sprintf("%s/%s", c.GetBoardsRoute(), boardID)
}

func (c *Client) GetBoardMetadataRoute(boardID string) string {
	return fmt.Sprintf("%s/%s/metadata", c.GetBoardsRoute(), boardID)
}

func (c *Client) GetJoinBoardRoute(boardID string) string {
	return fmt.Sprintf("%s/%s/join", c.GetBoardsRoute(), boardID)
}

func (c *Client) GetLeaveBoardRoute(boardID string) string {
	return fmt.Sprintf("%s/%s/join", c.GetBoardsRoute(), boardID)
}

func (c *Client) GetBlocksRoute(boardID string) string {
	return fmt.Sprintf("%s/blocks", c.GetBoardRoute(boardID))
}

func (c *Client) GetAllBlocksRoute(boardID string) string {
	return fmt.Sprintf("%s/blocks?all=true", c.GetBoardRoute(boardID))
}

func (c *Client) GetBoardsAndBlocksRoute() string {
	return "/boards-and-blocks"
}

func (c *Client) GetCardsRoute() string {
	return "/cards"
}

func (c *Client) GetCardRoute(cardID string) string {
	return fmt.Sprintf("%s/%s", c.GetCardsRoute(), cardID)
}

func (c *Client) GetTeam(teamID string) (*model.Team, *Response) {
	r, err := c.DoAPIGet(c.GetTeamRoute(teamID), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.TeamFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) GetTeamBoardsInsights(teamID string, userID string, timeRange string, page int, perPage int) (*model.BoardInsightsList, *Response) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)
	r, err := c.DoAPIGet(c.GetTeamRoute(teamID)+"/boards/insights"+query, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var boardInsightsList *model.BoardInsightsList
	if jsonErr := json.NewDecoder(r.Body).Decode(&boardInsightsList); jsonErr != nil {
		return nil, BuildErrorResponse(r, jsonErr)
	}
	return boardInsightsList, BuildResponse(r)
}

func (c *Client) GetUserBoardsInsights(teamID string, userID string, timeRange string, page int, perPage int) (*model.BoardInsightsList, *Response) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v&team_id=%v", timeRange, page, perPage, teamID)
	r, err := c.DoAPIGet(c.GetMeRoute()+"/boards/insights"+query, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var boardInsightsList *model.BoardInsightsList
	if jsonErr := json.NewDecoder(r.Body).Decode(&boardInsightsList); jsonErr != nil {
		return nil, BuildErrorResponse(r, jsonErr)
	}
	return boardInsightsList, BuildResponse(r)
}

func (c *Client) GetBlocksForBoard(boardID string) ([]*model.Block, *Response) {
	r, err := c.DoAPIGet(c.GetBlocksRoute(boardID), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BlocksFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) GetAllBlocksForBoard(boardID string) ([]*model.Block, *Response) {
	r, err := c.DoAPIGet(c.GetAllBlocksRoute(boardID), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BlocksFromJSON(r.Body), BuildResponse(r)
}

const disableNotifyQueryParam = "disable_notify=true"

func (c *Client) PatchBlock(boardID, blockID string, blockPatch *model.BlockPatch, disableNotify bool) (bool, *Response) {
	var queryParams string
	if disableNotify {
		queryParams = "?" + disableNotifyQueryParam
	}
	r, err := c.DoAPIPatch(c.GetBlockRoute(boardID, blockID)+queryParams, toJSON(blockPatch))
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) DuplicateBoard(boardID string, asTemplate bool, teamID string) (*model.BoardsAndBlocks, *Response) {
	queryParams := "?asTemplate=false&"
	if asTemplate {
		queryParams = "?asTemplate=true"
	}
	if len(teamID) > 0 {
		queryParams = queryParams + "&toTeam=" + teamID
	}
	r, err := c.DoAPIPost(c.GetBoardRoute(boardID)+"/duplicate"+queryParams, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardsAndBlocksFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) DuplicateBlock(boardID, blockID string, asTemplate bool) (bool, *Response) {
	queryParams := "?asTemplate=false"
	if asTemplate {
		queryParams = "?asTemplate=true"
	}
	r, err := c.DoAPIPost(c.GetBlockRoute(boardID, blockID)+"/duplicate"+queryParams, "")
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) UndeleteBlock(boardID, blockID string) (bool, *Response) {
	r, err := c.DoAPIPost(c.GetBlockRoute(boardID, blockID)+"/undelete", "")
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) InsertBlocks(boardID string, blocks []*model.Block, disableNotify bool) ([]*model.Block, *Response) {
	var queryParams string
	if disableNotify {
		queryParams = "?" + disableNotifyQueryParam
	}
	r, err := c.DoAPIPost(c.GetBlocksRoute(boardID)+queryParams, toJSON(blocks))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BlocksFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) DeleteBlock(boardID, blockID string, disableNotify bool) (bool, *Response) {
	var queryParams string
	if disableNotify {
		queryParams = "?" + disableNotifyQueryParam
	}
	r, err := c.DoAPIDelete(c.GetBlockRoute(boardID, blockID)+queryParams, "")
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

//
// Cards
//

func (c *Client) CreateCard(boardID string, card *model.Card, disableNotify bool) (*model.Card, *Response) {
	var queryParams string
	if disableNotify {
		queryParams = "?" + disableNotifyQueryParam
	}
	r, err := c.DoAPIPost(c.GetBoardRoute(boardID)+"/cards"+queryParams, toJSON(card))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var cardNew *model.Card
	if err := json.NewDecoder(r.Body).Decode(&cardNew); err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return cardNew, BuildResponse(r)
}

func (c *Client) GetCards(boardID string, page int, perPage int) ([]*model.Card, *Response) {
	url := fmt.Sprintf("%s/cards?page=%d&per_page=%d", c.GetBoardRoute(boardID), page, perPage)
	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	var cards []*model.Card
	if err := json.NewDecoder(r.Body).Decode(&cards); err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return cards, BuildResponse(r)
}

func (c *Client) PatchCard(cardID string, cardPatch *model.CardPatch, disableNotify bool) (*model.Card, *Response) {
	var queryParams string
	if disableNotify {
		queryParams = "?" + disableNotifyQueryParam
	}
	r, err := c.DoAPIPatch(c.GetCardRoute(cardID)+queryParams, toJSON(cardPatch))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	var cardNew *model.Card
	if err := json.NewDecoder(r.Body).Decode(&cardNew); err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return cardNew, BuildResponse(r)
}

func (c *Client) GetCard(cardID string) (*model.Card, *Response) {
	r, err := c.DoAPIGet(c.GetCardRoute(cardID), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	var card *model.Card
	if err := json.NewDecoder(r.Body).Decode(&card); err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return card, BuildResponse(r)
}

//
// Boards and blocks.
//

func (c *Client) CreateBoardsAndBlocks(bab *model.BoardsAndBlocks) (*model.BoardsAndBlocks, *Response) {
	r, err := c.DoAPIPost(c.GetBoardsAndBlocksRoute(), toJSON(bab))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardsAndBlocksFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) CreateCategory(category model.Category) (*model.Category, *Response) {
	r, err := c.DoAPIPost(c.GetTeamRoute(category.TeamID)+"/categories", toJSON(category))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.CategoryFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) DeleteCategory(teamID, categoryID string) *Response {
	r, err := c.DoAPIDelete(c.GetTeamRoute(teamID)+"/categories/"+categoryID, "")
	if err != nil {
		return BuildErrorResponse(r, err)
	}

	return BuildResponse(r)
}

func (c *Client) UpdateCategoryBoard(teamID, categoryID, boardID string) *Response {
	r, err := c.DoAPIPost(fmt.Sprintf("%s/categories/%s/boards/%s", c.GetTeamRoute(teamID), categoryID, boardID), "")
	if err != nil {
		return BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return BuildResponse(r)
}

func (c *Client) GetUserCategoryBoards(teamID string) ([]model.CategoryBoards, *Response) {
	r, err := c.DoAPIGet(c.GetTeamRoute(teamID)+"/categories", "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var categoryBoards []model.CategoryBoards
	_ = json.NewDecoder(r.Body).Decode(&categoryBoards)
	return categoryBoards, BuildResponse(r)
}

func (c *Client) ReorderCategories(teamID string, newOrder []string) ([]string, *Response) {
	r, err := c.DoAPIPut(c.GetTeamRoute(teamID)+"/categories/reorder", toJSON(newOrder))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var updatedCategoryOrder []string
	_ = json.NewDecoder(r.Body).Decode(&updatedCategoryOrder)
	return updatedCategoryOrder, BuildResponse(r)
}

func (c *Client) ReorderCategoryBoards(teamID, categoryID string, newOrder []string) ([]string, *Response) {
	r, err := c.DoAPIPut(c.GetTeamRoute(teamID)+"/categories/"+categoryID+"/reorder", toJSON(newOrder))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var updatedBoardsOrder []string
	_ = json.NewDecoder(r.Body).Decode(&updatedBoardsOrder)
	return updatedBoardsOrder, BuildResponse(r)
}

func (c *Client) PatchBoardsAndBlocks(pbab *model.PatchBoardsAndBlocks) (*model.BoardsAndBlocks, *Response) {
	r, err := c.DoAPIPatch(c.GetBoardsAndBlocksRoute(), toJSON(pbab))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardsAndBlocksFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) DeleteBoardsAndBlocks(dbab *model.DeleteBoardsAndBlocks) (bool, *Response) {
	r, err := c.DoAPIDelete(c.GetBoardsAndBlocksRoute(), toJSON(dbab))
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

// Sharing

func (c *Client) GetSharingRoute(boardID string) string {
	return fmt.Sprintf("%s/sharing", c.GetBoardRoute(boardID))
}

func (c *Client) GetSharing(boardID string) (*model.Sharing, *Response) {
	r, err := c.DoAPIGet(c.GetSharingRoute(boardID), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	sharing := model.SharingFromJSON(r.Body)
	return &sharing, BuildResponse(r)
}

func (c *Client) PostSharing(sharing *model.Sharing) (bool, *Response) {
	r, err := c.DoAPIPost(c.GetSharingRoute(sharing.ID), toJSON(sharing))
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) GetRegisterRoute() string {
	return "/register"
}

func (c *Client) Register(request *model.RegisterRequest) (bool, *Response) {
	r, err := c.DoAPIPost(c.GetRegisterRoute(), toJSON(&request))
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) GetLoginRoute() string {
	return "/login"
}

func (c *Client) Login(request *model.LoginRequest) (*model.LoginResponse, *Response) {
	r, err := c.DoAPIPost(c.GetLoginRoute(), toJSON(&request))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	data, err := model.LoginResponseFromJSON(r.Body)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	if data.Token != "" {
		c.Token = data.Token
	}

	return data, BuildResponse(r)
}

func (c *Client) GetMeRoute() string {
	return "/users/me"
}

func (c *Client) GetMe() (*model.User, *Response) {
	r, err := c.DoAPIGet(c.GetMeRoute(), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	me, err := model.UserFromJSON(r.Body)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	return me, BuildResponse(r)
}

func (c *Client) GetUserID() string {
	me, _ := c.GetMe()
	if me == nil {
		return ""
	}
	return me.ID
}

func (c *Client) GetUserRoute(id string) string {
	return fmt.Sprintf("/users/%s", id)
}

func (c *Client) GetUser(id string) (*model.User, *Response) {
	r, err := c.DoAPIGet(c.GetUserRoute(id), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	user, err := model.UserFromJSON(r.Body)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	return user, BuildResponse(r)
}

func (c *Client) GetUserChangePasswordRoute(id string) string {
	return fmt.Sprintf("/users/%s/changepassword", id)
}

func (c *Client) UserChangePassword(id string, data *model.ChangePasswordRequest) (bool, *Response) {
	r, err := c.DoAPIPost(c.GetUserChangePasswordRoute(id), toJSON(&data))
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) CreateBoard(board *model.Board) (*model.Board, *Response) {
	r, err := c.DoAPIPost(c.GetBoardsRoute(), toJSON(board))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) PatchBoard(boardID string, patch *model.BoardPatch) (*model.Board, *Response) {
	r, err := c.DoAPIPatch(c.GetBoardRoute(boardID), toJSON(patch))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) DeleteBoard(boardID string) (bool, *Response) {
	r, err := c.DoAPIDelete(c.GetBoardRoute(boardID), "")
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) UndeleteBoard(boardID string) (bool, *Response) {
	r, err := c.DoAPIPost(c.GetBoardRoute(boardID)+"/undelete", "")
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) GetBoard(boardID, readToken string) (*model.Board, *Response) {
	url := c.GetBoardRoute(boardID)
	if readToken != "" {
		url += fmt.Sprintf("?read_token=%s", readToken)
	}

	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) GetBoardMetadata(boardID, readToken string) (*model.BoardMetadata, *Response) {
	url := c.GetBoardMetadataRoute(boardID)
	if readToken != "" {
		url += fmt.Sprintf("?read_token=%s", readToken)
	}

	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardMetadataFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) GetBoardsForTeam(teamID string) ([]*model.Board, *Response) {
	r, err := c.DoAPIGet(c.GetTeamRoute(teamID)+"/boards", "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardsFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) SearchBoardsForUser(teamID, term string, field model.BoardSearchField) ([]*model.Board, *Response) {
	query := fmt.Sprintf("q=%s&field=%s", term, field)
	r, err := c.DoAPIGet(c.GetTeamRoute(teamID)+"/boards/search?"+query, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardsFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) SearchBoardsForTeam(teamID, term string) ([]*model.Board, *Response) {
	r, err := c.DoAPIGet(c.GetTeamRoute(teamID)+"/boards/search?q="+term, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardsFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) GetMembersForBoard(boardID string) ([]*model.BoardMember, *Response) {
	r, err := c.DoAPIGet(c.GetBoardRoute(boardID)+"/members", "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardMembersFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) AddMemberToBoard(member *model.BoardMember) (*model.BoardMember, *Response) {
	r, err := c.DoAPIPost(c.GetBoardRoute(member.BoardID)+"/members", toJSON(member))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardMemberFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) JoinBoard(boardID string) (*model.BoardMember, *Response) {
	r, err := c.DoAPIPost(c.GetJoinBoardRoute(boardID), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardMemberFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) LeaveBoard(boardID string) (*model.BoardMember, *Response) {
	r, err := c.DoAPIPost(c.GetLeaveBoardRoute(boardID), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardMemberFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) UpdateBoardMember(member *model.BoardMember) (*model.BoardMember, *Response) {
	r, err := c.DoAPIPut(c.GetBoardRoute(member.BoardID)+"/members/"+member.UserID, toJSON(member))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardMemberFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) DeleteBoardMember(member *model.BoardMember) (bool, *Response) {
	r, err := c.DoAPIDelete(c.GetBoardRoute(member.BoardID)+"/members/"+member.UserID, "")
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) GetTeamUploadFileRoute(teamID, boardID string) string {
	return fmt.Sprintf("%s/%s/files", c.GetTeamRoute(teamID), boardID)
}

func (c *Client) TeamUploadFile(teamID, boardID string, data io.Reader) (*api.FileUploadResponse, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(api.UploadFormFileKey, "file")
	if err != nil {
		return nil, &Response{Error: err}
	}
	if _, err = io.Copy(part, data); err != nil {
		return nil, &Response{Error: err}
	}
	writer.Close()

	opt := func(r *http.Request) {
		r.Header.Add("Content-Type", writer.FormDataContentType())
	}

	r, err := c.doAPIRequestReader(http.MethodPost, c.APIURL+c.GetTeamUploadFileRoute(teamID, boardID), body, "", opt)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	fileUploadResponse, err := api.FileUploadResponseFromJSON(r.Body)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return fileUploadResponse, BuildResponse(r)
}

func (c *Client) TeamUploadFileInfo(teamID, boardID string, fileName string) (*mm_model.FileInfo, *Response) {
	r, err := c.DoAPIGet(fmt.Sprintf("/files/teams/%s/%s/%s/info", teamID, boardID, fileName), "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)
	fileInfoResponse, error := api.FileInfoResponseFromJSON(r.Body)
	if error != nil {
		return nil, BuildErrorResponse(r, error)
	}
	return fileInfoResponse, BuildResponse(r)
}

func (c *Client) GetSubscriptionsRoute() string {
	return "/subscriptions"
}

func (c *Client) CreateSubscription(sub *model.Subscription) (*model.Subscription, *Response) {
	r, err := c.DoAPIPost(c.GetSubscriptionsRoute(), toJSON(&sub))
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	subNew, err := model.SubscriptionFromJSON(r.Body)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	return subNew, BuildResponse(r)
}

func (c *Client) DeleteSubscription(blockID string, subscriberID string) *Response {
	url := fmt.Sprintf("%s/%s/%s", c.GetSubscriptionsRoute(), blockID, subscriberID)

	r, err := c.DoAPIDelete(url, "")
	if err != nil {
		return BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return BuildResponse(r)
}

func (c *Client) GetSubscriptions(subscriberID string) ([]*model.Subscription, *Response) {
	url := fmt.Sprintf("%s/%s", c.GetSubscriptionsRoute(), subscriberID)

	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var subs []*model.Subscription
	err = json.NewDecoder(r.Body).Decode(&subs)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return subs, BuildResponse(r)
}

func (c *Client) GetTemplatesForTeam(teamID string) ([]*model.Board, *Response) {
	r, err := c.DoAPIGet(c.GetTeamRoute(teamID)+"/templates", "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return model.BoardsFromJSON(r.Body), BuildResponse(r)
}

func (c *Client) ExportBoardArchive(boardID string) ([]byte, *Response) {
	r, err := c.DoAPIGet(c.GetBoardRoute(boardID)+"/archive/export", "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	buf, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	return buf, BuildResponse(r)
}

func (c *Client) ImportArchive(teamID string, data io.Reader) *Response {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(api.UploadFormFileKey, "file")
	if err != nil {
		return &Response{Error: err}
	}
	if _, err = io.Copy(part, data); err != nil {
		return &Response{Error: err}
	}
	writer.Close()

	opt := func(r *http.Request) {
		r.Header.Add("Content-Type", writer.FormDataContentType())
	}

	r, err := c.doAPIRequestReader(http.MethodPost, c.APIURL+c.GetTeamRoute(teamID)+"/archive/import", body, "", opt)
	if err != nil {
		return BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return BuildResponse(r)
}

func (c *Client) GetLimits() (*model.BoardsCloudLimits, *Response) {
	r, err := c.DoAPIGet("/limits", "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var limits *model.BoardsCloudLimits
	err = json.NewDecoder(r.Body).Decode(&limits)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return limits, BuildResponse(r)
}

func (c *Client) MoveContentBlock(srcBlockID string, dstBlockID string, where string, userID string) (bool, *Response) {
	r, err := c.DoAPIPost("/content-blocks/"+srcBlockID+"/moveto/"+where+"/"+dstBlockID, "")
	if err != nil {
		return false, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	return true, BuildResponse(r)
}

func (c *Client) GetStatistics() (*model.BoardsStatistics, *Response) {
	r, err := c.DoAPIGet("/statistics", "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var stats *model.BoardsStatistics
	err = json.NewDecoder(r.Body).Decode(&stats)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return stats, BuildResponse(r)
}

func (c *Client) GetBoardsForCompliance(teamID string, page, perPage int) (*model.BoardsComplianceResponse, *Response) {
	query := fmt.Sprintf("?team_id=%s&page=%d&per_page=%d", teamID, page, perPage)
	r, err := c.DoAPIGet("/admin/boards"+query, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var res *model.BoardsComplianceResponse
	err = json.NewDecoder(r.Body).Decode(&res)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return res, BuildResponse(r)
}

func (c *Client) GetBoardsComplianceHistory(
	modifiedSince int64, includeDeleted bool, teamID string, page, perPage int) (*model.BoardsComplianceHistoryResponse, *Response) {
	query := fmt.Sprintf("?modified_since=%d&include_deleted=%t&team_id=%s&page=%d&per_page=%d",
		modifiedSince, includeDeleted, teamID, page, perPage)
	r, err := c.DoAPIGet("/admin/boards_history"+query, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var res *model.BoardsComplianceHistoryResponse
	err = json.NewDecoder(r.Body).Decode(&res)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return res, BuildResponse(r)
}

func (c *Client) GetBlocksComplianceHistory(
	modifiedSince int64, includeDeleted bool, teamID, boardID string, page, perPage int) (*model.BlocksComplianceHistoryResponse, *Response) {
	query := fmt.Sprintf("?modified_since=%d&include_deleted=%t&team_id=%s&board_id=%s&page=%d&per_page=%d",
		modifiedSince, includeDeleted, teamID, boardID, page, perPage)
	r, err := c.DoAPIGet("/admin/blocks_history"+query, "")
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}
	defer closeBody(r)

	var res *model.BlocksComplianceHistoryResponse
	err = json.NewDecoder(r.Body).Decode(&res)
	if err != nil {
		return nil, BuildErrorResponse(r, err)
	}

	return res, BuildResponse(r)
}

func (c *Client) HideBoard(teamID, categoryID, boardID string) *Response {
	r, err := c.DoAPIPut(c.GetTeamRoute(teamID)+"/categories/"+categoryID+"/boards/"+boardID+"/hide", "")
	if err != nil {
		return BuildErrorResponse(r, err)
	}

	return BuildResponse(r)
}

func (c *Client) UnhideBoard(teamID, categoryID, boardID string) *Response {
	r, err := c.DoAPIPut(c.GetTeamRoute(teamID)+"/categories/"+categoryID+"/boards/"+boardID+"/unhide", "")
	if err != nil {
		return BuildErrorResponse(r, err)
	}

	return BuildResponse(r)
}
