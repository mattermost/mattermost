package plugin

import "regexp"

var webAppFeaturePatterns = map[string]*regexp.Regexp{
	// Detect various versions of mattermost-redux by looking for values first defined in a certain release. They need
	// to be values that are likely to not be removed by tree shaking.

	// This constant was added to mattermost-redux around the time of 5.33, the last release before mattermost-redux
	// was moved into mattermost-webapp
	"mattermost-redux >= 5.33": regexp.MustCompile(`\bCATEGORY_CUSTOM_STATUS\b`),

	// This method was added after mattermost-redux was moved into mattermost-webapp in 5.34
	"mattermost-redux >= 5.34": regexp.MustCompile(`\bFIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED\b`),

	// The method was added to mattermost-redux in 7.10, the last release before the server monorepo
	"mattermost-redux >= 7.10": regexp.MustCompile(`\baddPostReminder\b`),

	// This method was added to mattermost-redux in 9.6
	"mattermost-redux >= 9.6": regexp.MustCompile(`\bgetIsUserStatusesConfigEnabled\b`),

	// window methods
	"PostUtils.formatText":                    regexp.MustCompile(`\bformatText\b`),
	"PostUtils.messageHtmlToComponent":        regexp.MustCompile(`\bmessageHtmlToComponent\b`),
	"openInteractiveDialog":                   regexp.MustCompile(`\bopenInteractiveDialog\b`),
	"useNotifyAdmin":                          regexp.MustCompile(`\buseNotifyAdmin\b`),
	"WebappUtils.modal.openModal":             regexp.MustCompile(`\bopenModal\(\B`),
	"WebappUtils.modal.ModalIdentifiers":      regexp.MustCompile(`\bModalIdentifiers\b`),
	"WebappUtils.notificationSounds":          regexp.MustCompile(`\bnotificationSounds\b`),
	"WebappUtils.sendDesktopNotificationToMe": regexp.MustCompile(`\bsendDesktopNotificationToMe\b`),
	"browserHistory":                          regexp.MustCompile(`\bbrowserHistory\b`),
	"registerPlugin":                          regexp.MustCompile(`\bregisterPlugin\b`),
	"openPricingModal":                        regexp.MustCompile(`\bopenPricingModal\b`),

	// window Libraries
	"React":            regexp.MustCompile(`\B=React\b`),
	"ReactDOM":         regexp.MustCompile(`\B=ReactDOM\b`),
	"ReactIntl":        regexp.MustCompile(`\B=ReactIntl\b`),
	"Redux":            regexp.MustCompile(`\B=Redux\b`),
	"ReactRedux":       regexp.MustCompile(`\B=ReactRedux\b`),
	"ReactBootstrap":   regexp.MustCompile(`\B=ReactBootstrap\b`),
	"ReactRouterDom":   regexp.MustCompile(`\B=ReactRouterDom\b`),
	"PropTypes":        regexp.MustCompile(`\B=PropTypes\b`),
	"Luxon":            regexp.MustCompile(`\B=Luxon\b`),
	"StyledComponents": regexp.MustCompile(`\B=StyledComponents\b`),

	// window.Components
	"Components.Textbox":             regexp.MustCompile(`\bTextbox\b`),
	"Components.Timestamp":           regexp.MustCompile(`\bTimestamp\b`),
	"Components.ChannelInviteModal":  regexp.MustCompile(`\bChannelInviteModal\b`),
	"Components.ChannelMembersModal": regexp.MustCompile(`\bChannelMembersModal\b`),
	"Components.Avatar":              regexp.MustCompile(`\bAvatar\b`),
	"Components.imageURLForUser":     regexp.MustCompile(`\bimageURLForUser\b`),
	"Components.BotBadge":            regexp.MustCompile(`\bBotBadge\b`),
	"Components.StartTrialFormModal": regexp.MustCompile(`\bStartTrialFormModal\b`),
	"Components.ThreadViewer":        regexp.MustCompile(`\bThreadViewer\b`),
	"Components.CreatePost":          regexp.MustCompile(`\bCreatePost\b`),
	"Components.PostMessagePreview":  regexp.MustCompile(`\bPostMessagePreview\b`),

	// window.ProductApi
	"ProductApi.useWebSocket":         regexp.MustCompile(`\buseWebSocket\b`),
	"ProductApi.useWebSocketClient":   regexp.MustCompile(`\buseWebSocketClient\b`),
	"ProductApi.WebSocketProvider":    regexp.MustCompile(`\bWebSocketProvider\b`),
	"ProductApi.closeRhs":             regexp.MustCompile(`\bcloseRhs\b`),
	"ProductApi.selectRhsPost":        regexp.MustCompile(`\bselectRhsPost\b`),
	"ProductApi.getRhsSelectedPostId": regexp.MustCompile(`\bgetRhsSelectedPostId\b`),
	"ProductApi.getIsRhsOpen":         regexp.MustCompile(`\bgetIsRhsOpen\b`),

	// window.DesktopApp
	"DesktopApp": regexp.MustCompile(`\bDesktopApp\b`),

	// TODO detect plugin registry method usage

	// TODO use plugin registry method usage to detect when plugins register routes to defer plugin load later
}

func detectWebAppFeatureUsage(pluginSource []byte) map[string]bool {
	featureUsage := make(map[string]bool)

	for feature, pattern := range webAppFeaturePatterns {
		featureUsage[feature] = pattern.Match(pluginSource)
	}

	return featureUsage
}
