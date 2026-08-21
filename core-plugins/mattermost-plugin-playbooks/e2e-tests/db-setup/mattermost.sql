--
-- Just add the system admin.
--

COPY public.users (id, createat, updateat, deleteat, username, password, authdata, authservice, email, emailverified, nickname, firstname, lastname, "position", roles, allowmarketing, props, notifyprops, lastpasswordupdate, lastpictureupdate, failedattempts, locale, timezone, mfaactive, mfasecret, remoteid) FROM stdin;
qanmxu8aafgdipxiibkuos1uaw	1634316565952	1634316566065	0	sysadmin	$2a$10$FF7zZzLYW80liKKJaKGVFOc6xCsKU2OZfwCvGBmF4xACuwstyPFN.	\N		sysadmin@sample.mattermost.com	t		Kenneth	Moreno	Software Test Engineer III	system_admin system_user	f	{}	{"push": "mention", "email": "true", "channel": "true", "desktop": "mention", "comments": "never", "first_name": "false", "push_status": "away", "mention_keys": "", "push_threads": "all", "desktop_sound": "true", "email_threads": "all", "desktop_threads": "all"}	1634316565952	0	0	en	{"manualTimezone": "", "automaticTimezone": "", "useAutomaticTimezone": "true"}	f		\N
\.
