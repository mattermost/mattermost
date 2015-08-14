// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var config = {

    // Loggly configs
    LogglyWriteKey: "",
    LogglyConsoleErrors: true,

    // Segment configs
    SegmentWriteKey: "",

    // Feature switches
    AllowPublicLink: true,
    AllowInviteNames: true,
    RequireInviteNames: false,
    AllowSignupDomainsWizard: false,
    AllowTextFormatting: true,

    // Google Developer Key (for Youtube API links)
    // Leave blank to disable
    GoogleDeveloperKey: "",

    // Privacy switches
    ShowEmail: true,

    // Links
    TermsLink: "/static/help/configure_links.html",
    PrivacyLink: "/static/help/configure_links.html",
    AboutLink: "/static/help/configure_links.html",
    HelpLink: "/static/help/configure_links.html",
    ReportProblemLink: "/static/help/configure_links.html",
    HomeLink: "",

    // Toggle whether or not users are shown a message about agreeing to the Terms of Service during the signup process
    ShowTermsDuringSignup: false,

    ThemeColors: ["#2389d7", "#008a17", "#dc4fad", "#ac193d", "#0072c6", "#d24726", "#ff8f32", "#82ba00", "#03b3b2", "#008299", "#4617b4", "#8c0095", "#004b8b", "#004b8b", "#570000", "#380000", "#585858", "#000000"]
};

// Flavor strings
var strings = {
    Team: "team",
    TeamPlural: "teams",
    Company: "company",
    CompanyPlural: "companies"
};
