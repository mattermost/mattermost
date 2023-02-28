INSERT INTO focalboard_users
(id, username, props)
VALUES
('user-id', 'johndoe', '{"focalboard_welcomePageViewed": true, "hiddenBoardIDs": ["board1", "board2"], "focalboard_tourCategory": "onboarding", "focalboard_onboardingTourStep": 1, "focalboard_onboardingTourStarted": false, "focalboard_version72MessageCanceled": true, "focalboard_lastWelcomeVersion": 7}');

INSERT INTO focalboard_preferences
(UserId, Category, Name, Value)
VALUES
('user-id', 'focalboard', 'onboardingTourStarted', true);
