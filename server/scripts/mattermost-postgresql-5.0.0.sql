--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner:
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: audits; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.audits (
    id character varying(26) NOT NULL,
    createat bigint,
    userid character varying(26),
    action character varying(512),
    extrainfo character varying(1024),
    ipaddress character varying(64),
    sessionid character varying(26)
);


ALTER TABLE public.audits OWNER TO mmuser;

--
-- Name: channelmemberhistory; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.channelmemberhistory (
    channelid character varying(26) NOT NULL,
    userid character varying(26) NOT NULL,
    jointime bigint NOT NULL,
    leavetime bigint
);


ALTER TABLE public.channelmemberhistory OWNER TO mmuser;

--
-- Name: channelmembers; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.channelmembers (
    channelid character varying(26) NOT NULL,
    userid character varying(26) NOT NULL,
    roles character varying(64),
    lastviewedat bigint,
    msgcount bigint,
    mentioncount bigint,
    notifyprops character varying(2000),
    lastupdateat bigint,
    schemeuser boolean,
    schemeadmin boolean
);


ALTER TABLE public.channelmembers OWNER TO mmuser;

--
-- Name: channels; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.channels (
    id character varying(26) NOT NULL,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    teamid character varying(26),
    type character varying(1),
    displayname character varying(64),
    name character varying(64),
    header character varying(1024),
    purpose character varying(250),
    lastpostat bigint,
    totalmsgcount bigint,
    extraupdateat bigint,
    creatorid character varying(26),
    schemeid character varying(26)
);


ALTER TABLE public.channels OWNER TO mmuser;

--
-- Name: clusterdiscovery; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.clusterdiscovery (
    id character varying(26) NOT NULL,
    type character varying(64),
    clustername character varying(64),
    hostname character varying(512),
    gossipport integer,
    port integer,
    createat bigint,
    lastpingat bigint
);


ALTER TABLE public.clusterdiscovery OWNER TO mmuser;

--
-- Name: commands; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.commands (
    id character varying(26) NOT NULL,
    token character varying(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid character varying(26),
    teamid character varying(26),
    trigger character varying(128),
    method character varying(1),
    username character varying(64),
    iconurl character varying(1024),
    autocomplete boolean,
    autocompletedesc character varying(1024),
    autocompletehint character varying(1024),
    displayname character varying(64),
    description character varying(128),
    url character varying(1024)
);


ALTER TABLE public.commands OWNER TO mmuser;

--
-- Name: commandwebhooks; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.commandwebhooks (
    id character varying(26) NOT NULL,
    createat bigint,
    commandid character varying(26),
    userid character varying(26),
    channelid character varying(26),
    rootid character varying(26),
    parentid character varying(26),
    usecount integer
);


ALTER TABLE public.commandwebhooks OWNER TO mmuser;

--
-- Name: compliances; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.compliances (
    id character varying(26) NOT NULL,
    createat bigint,
    userid character varying(26),
    status character varying(64),
    count integer,
    "desc" character varying(512),
    type character varying(64),
    startat bigint,
    endat bigint,
    keywords character varying(512),
    emails character varying(1024)
);


ALTER TABLE public.compliances OWNER TO mmuser;

--
-- Name: emoji; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.emoji (
    id character varying(26) NOT NULL,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid character varying(26),
    name character varying(64)
);


ALTER TABLE public.emoji OWNER TO mmuser;

--
-- Name: fileinfo; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.fileinfo (
    id character varying(26) NOT NULL,
    creatorid character varying(26),
    postid character varying(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    path character varying(512),
    thumbnailpath character varying(512),
    previewpath character varying(512),
    name character varying(256),
    extension character varying(64),
    size bigint,
    mimetype character varying(256),
    width integer,
    height integer,
    haspreviewimage boolean
);


ALTER TABLE public.fileinfo OWNER TO mmuser;

--
-- Name: incomingwebhooks; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.incomingwebhooks (
    id character varying(26) NOT NULL,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    userid character varying(26),
    channelid character varying(26),
    teamid character varying(26),
    displayname character varying(64),
    description character varying(500),
    username character varying(255),
    iconurl character varying(1024),
    channellocked boolean DEFAULT false
);


ALTER TABLE public.incomingwebhooks OWNER TO mmuser;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.jobs (
    id character varying(26) NOT NULL,
    type character varying(32),
    priority bigint,
    createat bigint,
    startat bigint,
    lastactivityat bigint,
    status character varying(32),
    progress bigint,
    data character varying(1024)
);


ALTER TABLE public.jobs OWNER TO mmuser;

--
-- Name: licenses; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.licenses (
    id character varying(26) NOT NULL,
    createat bigint,
    bytes character varying(10000)
);


ALTER TABLE public.licenses OWNER TO mmuser;

--
-- Name: oauthaccessdata; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.oauthaccessdata (
    token character varying(26) NOT NULL,
    refreshtoken character varying(26),
    redirecturi character varying(256),
    clientid character varying(26) DEFAULT ''::character varying,
    userid character varying(26) DEFAULT ''::character varying,
    expiresat bigint DEFAULT 0,
    scope character varying(128) DEFAULT 'user'::character varying
);


ALTER TABLE public.oauthaccessdata OWNER TO mmuser;

--
-- Name: oauthapps; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.oauthapps (
    id character varying(26) NOT NULL,
    creatorid character varying(26),
    createat bigint,
    updateat bigint,
    clientsecret character varying(128),
    name character varying(64),
    description character varying(512),
    callbackurls character varying(1024),
    homepage character varying(256),
    istrusted boolean DEFAULT false,
    iconurl character varying(512) DEFAULT ''::character varying
);


ALTER TABLE public.oauthapps OWNER TO mmuser;

--
-- Name: oauthauthdata; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.oauthauthdata (
    clientid character varying(26),
    userid character varying(26),
    code character varying(128) NOT NULL,
    expiresin integer,
    createat bigint,
    redirecturi character varying(256),
    state character varying(1024),
    scope character varying(128)
);


ALTER TABLE public.oauthauthdata OWNER TO mmuser;

--
-- Name: outgoingwebhooks; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.outgoingwebhooks (
    id character varying(26) NOT NULL,
    token character varying(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid character varying(26),
    channelid character varying(26),
    teamid character varying(26),
    triggerwords character varying(1024),
    callbackurls character varying(1024),
    displayname character varying(64),
    contenttype character varying(128),
    triggerwhen integer DEFAULT 0,
    username character varying(64),
    iconurl character varying(1024),
    description character varying(500),
);


ALTER TABLE public.outgoingwebhooks OWNER TO mmuser;

--
-- Name: pluginkeyvaluestore; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.pluginkeyvaluestore (
    pluginid character varying(190) NOT NULL,
    pkey character varying(50) NOT NULL,
    pvalue bytea
);


ALTER TABLE public.pluginkeyvaluestore OWNER TO mmuser;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.posts (
    id character varying(26) NOT NULL,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    userid character varying(26),
    channelid character varying(26),
    rootid character varying(26),
    parentid character varying(26),
    originalid character varying(26),
    message character varying(65535),
    type character varying(26),
    props character varying(8000),
    hashtags character varying(1000),
    filenames character varying(4000),
    fileids character varying(300) DEFAULT '[]'::character varying,
    hasreactions boolean DEFAULT false,
    editat bigint DEFAULT 0,
    ispinned boolean DEFAULT false
);


ALTER TABLE public.posts OWNER TO mmuser;

--
-- Name: preferences; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.preferences (
    userid character varying(26) NOT NULL,
    category character varying(32) NOT NULL,
    name character varying(32) NOT NULL,
    value character varying(2000)
);


ALTER TABLE public.preferences OWNER TO mmuser;

--
-- Name: reactions; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.reactions (
    userid character varying(26) NOT NULL,
    postid character varying(26) NOT NULL,
    emojiname character varying(64) NOT NULL,
    createat bigint
);


ALTER TABLE public.reactions OWNER TO mmuser;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.roles (
    id character varying(26) NOT NULL,
    name character varying(64),
    displayname character varying(128),
    description character varying(1024),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    permissions text,
    schememanaged boolean,
    builtin boolean DEFAULT false
);


ALTER TABLE public.roles OWNER TO mmuser;

--
-- Name: schemes; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.schemes (
    id character varying(26) NOT NULL,
    name character varying(64),
    displayname character varying(128),
    description character varying(1024),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    scope character varying(32),
    defaultteamadminrole character varying(64),
    defaultteamuserrole character varying(64),
    defaultchanneladminrole character varying(64),
    defaultchanneluserrole character varying(64)
);


ALTER TABLE public.schemes OWNER TO mmuser;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.sessions (
    id character varying(26) NOT NULL,
    token character varying(26),
    createat bigint,
    expiresat bigint,
    lastactivityat bigint,
    userid character varying(26),
    deviceid character varying(512),
    roles character varying(64),
    isoauth boolean,
    expirednotify boolean,
    props character varying(1000),
);


ALTER TABLE public.sessions OWNER TO mmuser;

--
-- Name: status; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.status (
    userid character varying(26) NOT NULL,
    status character varying(32),
    lastactivityat bigint,
    manual boolean DEFAULT false
);


ALTER TABLE public.status OWNER TO mmuser;

--
-- Name: systems; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.systems (
    name character varying(64) NOT NULL,
    value character varying(1024)
);


ALTER TABLE public.systems OWNER TO mmuser;

--
-- Name: teammembers; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.teammembers (
    teamid character varying(26) NOT NULL,
    userid character varying(26) NOT NULL,
    roles character varying(64),
    deleteat bigint,
    schemeuser boolean,
    schemeadmin boolean
);


ALTER TABLE public.teammembers OWNER TO mmuser;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.teams (
    id character varying(26) NOT NULL,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    displayname character varying(64),
    name character varying(64),
    description character varying(255),
    email character varying(128),
    type text,
    companyname character varying(64),
    alloweddomains character varying(500),
    inviteid character varying(32),
    schemeid text,
    allowopeninvite boolean,
    lastteamiconupdate bigint
);


ALTER TABLE public.teams OWNER TO mmuser;

--
-- Name: tokens; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.tokens (
    token character varying(64) NOT NULL,
    createat bigint,
    type character varying(64),
    extra character varying(128)
);


ALTER TABLE public.tokens OWNER TO mmuser;

--
-- Name: useraccesstokens; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.useraccesstokens (
    id character varying(26) NOT NULL,
    token character varying(26),
    userid character varying(26),
    description character varying(512),
    isactive boolean DEFAULT true
);


ALTER TABLE public.useraccesstokens OWNER TO mmuser;

--
-- Name: users; Type: TABLE; Schema: public; Owner: mmuser; Tablespace:
--

CREATE TABLE public.users (
    id character varying(26) NOT NULL,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    username character varying(64),
    password character varying(128),
    authdata character varying(128),
    authservice character varying(32),
    email character varying(128),
    emailverified boolean,
    nickname character varying(64),
    firstname character varying(64),
    lastname character varying(64),
    roles character varying(256),
    allowmarketing boolean,
    props character varying(4000),
    notifyprops character varying(2000),
    lastpasswordupdate bigint,
    lastpictureupdate bigint,
    failedattempts integer,
    locale character varying(5),
    mfaactive boolean,
    mfasecret character varying(128),
    "position" character varying(128),
    timezone character varying(256) DEFAULT '{"automaticTimezone":"","manualTimezone":"","useAutomaticTimezone":"true"}'::character varying
);


ALTER TABLE public.users OWNER TO mmuser;

--
-- Data for Name: audits; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.audits (id, createat, userid, action, extrainfo, ipaddress, sessionid) FROM stdin;
\.


--
-- Data for Name: channelmemberhistory; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.channelmemberhistory (channelid, userid, jointime, leavetime) FROM stdin;
\.


--
-- Data for Name: channelmembers; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.channelmembers (channelid, userid, roles, lastviewedat, msgcount, mentioncount, notifyprops, lastupdateat, schemeuser, schemeadmin) FROM stdin;
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.channels (id, createat, updateat, deleteat, teamid, type, displayname, name, header, purpose, lastpostat, totalmsgcount, extraupdateat, creatorid, schemeid) FROM stdin;
\.


--
-- Data for Name: clusterdiscovery; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.clusterdiscovery (id, type, clustername, hostname, gossipport, port, createat, lastpingat) FROM stdin;
\.


--
-- Data for Name: commands; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.commands (id, token, createat, updateat, deleteat, creatorid, teamid, trigger, method, username, iconurl, autocomplete, autocompletedesc, autocompletehint, displayname, description, url) FROM stdin;
\.


--
-- Data for Name: commandwebhooks; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.commandwebhooks (id, createat, commandid, userid, channelid, rootid, parentid, usecount) FROM stdin;
\.


--
-- Data for Name: compliances; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.compliances (id, createat, userid, status, count, "desc", type, startat, endat, keywords, emails) FROM stdin;
\.


--
-- Data for Name: emoji; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.emoji (id, createat, updateat, deleteat, creatorid, name) FROM stdin;
\.


--
-- Data for Name: fileinfo; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.fileinfo (id, creatorid, postid, createat, updateat, deleteat, path, thumbnailpath, previewpath, name, extension, size, mimetype, width, height, haspreviewimage) FROM stdin;
\.


--
-- Data for Name: incomingwebhooks; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.incomingwebhooks (id, createat, updateat, deleteat, userid, channelid, teamid, displayname, description, username, iconurl, channellocked) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.jobs (id, type, priority, createat, startat, lastactivityat, status, progress, data) FROM stdin;
\.


--
-- Data for Name: licenses; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.licenses (id, createat, bytes) FROM stdin;
\.


--
-- Data for Name: oauthaccessdata; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.oauthaccessdata (clientid, userid, token, refreshtoken, redirecturi, expiresat, scope) FROM stdin;
\.


--
-- Data for Name: oauthapps; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.oauthapps (id, creatorid, createat, updateat, clientsecret, name, description, iconurl, callbackurls, homepage, istrusted) FROM stdin;
\.


--
-- Data for Name: oauthauthdata; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.oauthauthdata (clientid, userid, code, expiresin, createat, redirecturi, state, scope) FROM stdin;
\.


--
-- Data for Name: outgoingwebhooks; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.outgoingwebhooks (id, token, createat, updateat, deleteat, creatorid, channelid, teamid, triggerwords, triggerwhen, callbackurls, displayname, description, contenttype) FROM stdin;
\.


--
-- Data for Name: pluginkeyvaluestore; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.pluginkeyvaluestore (pluginid, pkey, pvalue) FROM stdin;
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.posts (id, createat, updateat, editat, deleteat, ispinned, userid, channelid, rootid, parentid, originalid, message, type, props, hashtags, filenames, fileids, hasreactions) FROM stdin;
\.


--
-- Data for Name: preferences; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.preferences (userid, category, name, value) FROM stdin;
\.


--
-- Data for Name: reactions; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.reactions (userid, postid, emojiname, createat) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.roles (id, name, displayname, description, createat, updateat, deleteat, permissions, schememanaged, builtin) FROM stdin;
aap88jdt37dgdgkek1c7dq69ua	team_post_all	authentication.roles.team_post_all.name	authentication.roles.team_post_all.description	1552912816230	1552912816230	0	 create_post	f	t
masesduwobn95dqoyba5xmtz5o	team_post_all_public	authentication.roles.team_post_all_public.name	authentication.roles.team_post_all_public.description	1552912816258	1552912816258	0	 create_post_public	f	t
ufy3o8h1y3g4bgqeyw7yb6hrwe	system_post_all	authentication.roles.system_post_all.name	authentication.roles.system_post_all.description	1552912816269	1552912816269	0	 create_post	f	t
7ptq38iy4br59q8y4zt9mm3zwy	system_post_all_public	authentication.roles.system_post_all_public.name	authentication.roles.system_post_all_public.description	1552912816288	1552912816288	0	 create_post_public	f	t
wpxrpuiyo3bgdf34u7t65gcota	system_user_access_token	authentication.roles.system_user_access_token.name	authentication.roles.system_user_access_token.description	1552912816404	1552912816404	0	 create_user_access_token read_user_access_token revoke_user_access_token	f	t
fomn851ie3gmz8zwr87szazm6w	channel_user	authentication.roles.channel_user.name	authentication.roles.channel_user.description	1552912816614	1552912816614	0	 read_channel add_reaction remove_reaction manage_public_channel_members upload_file get_public_link create_post use_slash_commands manage_private_channel_members delete_post edit_post	t	t
xjxw3p6ect8bjfre7wc5jhwbqr	channel_admin	authentication.roles.channel_admin.name	authentication.roles.channel_admin.description	1552912816669	1552912816669	0	 manage_channel_roles	t	t
q5qjsjsn3py5mfodcirqjkhsjy	team_user	authentication.roles.team_user.name	authentication.roles.team_user.description	1552912816680	1552912816680	0	 list_team_channels join_public_channels read_public_channel view_team create_public_channel manage_public_channel_properties delete_public_channel create_private_channel manage_private_channel_properties delete_private_channel invite_user add_user_to_team	t	t
ntqm5c1rbjb9mrh69zagibxoxa	team_admin	authentication.roles.team_admin.name	authentication.roles.team_admin.description	1552912816746	1552912816746	0	 edit_others_posts remove_user_from_team manage_team import_team manage_team_roles manage_channel_roles manage_others_webhooks manage_slash_commands manage_others_slash_commands manage_webhooks delete_post delete_others_posts	t	t
ts6aqp9p6jy97jwyf6wh4f5qaa	system_user	authentication.roles.global_user.name	authentication.roles.global_user.description	1552912816757	1552912816913	0	 create_direct_channel create_group_channel permanent_delete_user create_team manage_emojis	t	t
twatrmjz8i8spfdyus18bm4nth	system_admin	authentication.roles.global_admin.name	authentication.roles.global_admin.description	1552912816481	1552912816923	0	 assign_system_admin_role manage_system manage_roles manage_public_channel_properties manage_public_channel_members manage_private_channel_members delete_public_channel create_public_channel manage_private_channel_properties delete_private_channel create_private_channel manage_system_wide_oauth manage_others_webhooks edit_other_users manage_oauth invite_user delete_post delete_others_posts create_team add_user_to_team list_users_without_team manage_jobs create_post_public create_post_ephemeral create_user_access_token read_user_access_token revoke_user_access_token remove_others_reactions list_team_channels join_public_channels read_public_channel view_team read_channel add_reaction remove_reaction upload_file get_public_link create_post use_slash_commands edit_others_posts remove_user_from_team manage_team import_team manage_team_roles manage_channel_roles manage_slash_commands manage_others_slash_commands manage_webhooks edit_post manage_emojis manage_others_emojis	t	t
\.


--
-- Data for Name: schemes; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.schemes (id, name, displayname, description, createat, updateat, deleteat, scope, defaultteamadminrole, defaultteamuserrole, defaultchanneladminrole, defaultchanneluserrole) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.sessions (id, token, createat, expiresat, lastactivityat, userid, deviceid, roles, isoauth, expirednotify, props) FROM stdin;
\.


--
-- Data for Name: status; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.status (userid, status, manual, lastactivityat) FROM stdin;
\.


--
-- Data for Name: systems; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.systems (name, value) FROM stdin;
Version	5.0.0
AsymmetricSigningKey	{"ecdsa_key":{"curve":"P-256","x":50494983991025284560870211683226455202411615657166048251398890171377825517363,"y":113694733845764674468191147267904180878076486503487433150108745296643202957034,"d":85042364128488616037616885822024419913274924562562115600648814391088417875310}}
AdvancedPermissionsMigrationComplete	true
EmojisPermissionsMigrationComplete	true
DiagnosticId	up3o75jkjbbs8dbawiwypzwrmc
LastSecurityTime	1552912819442
\.


--
-- Data for Name: teammembers; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.teammembers (teamid, userid, roles, deleteat, schemeuser, schemeadmin) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.teams (id, createat, updateat, deleteat, displayname, name, description, email, type, companyname, alloweddomains, inviteid, allowopeninvite, lastteamiconupdate, schemeid) FROM stdin;
\.


--
-- Data for Name: tokens; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.tokens (token, createat, type, extra) FROM stdin;
\.


--
-- Data for Name: useraccesstokens; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.useraccesstokens (id, token, userid, description, isactive) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: mmuser
--

COPY public.users (id, createat, updateat, deleteat, username, password, authdata, authservice, email, emailverified, nickname, firstname, lastname, "position", roles, allowmarketing, props, notifyprops, lastpasswordupdate, lastpictureupdate, failedattempts, locale, timezone, mfaactive, mfasecret) FROM stdin;
\.


--
-- Name: audits_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.audits
    ADD CONSTRAINT audits_pkey PRIMARY KEY (id);


--
-- Name: channelmemberhistory_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.channelmemberhistory
    ADD CONSTRAINT channelmemberhistory_pkey PRIMARY KEY (channelid, userid, jointime);


--
-- Name: channelmembers_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.channelmembers
    ADD CONSTRAINT channelmembers_pkey PRIMARY KEY (channelid, userid);


--
-- Name: channels_name_teamid_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_name_teamid_key UNIQUE (name, teamid);


--
-- Name: channels_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: clusterdiscovery_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.clusterdiscovery
    ADD CONSTRAINT clusterdiscovery_pkey PRIMARY KEY (id);


--
-- Name: commands_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.commands
    ADD CONSTRAINT commands_pkey PRIMARY KEY (id);


--
-- Name: commandwebhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.commandwebhooks
    ADD CONSTRAINT commandwebhooks_pkey PRIMARY KEY (id);


--
-- Name: compliances_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.compliances
    ADD CONSTRAINT compliances_pkey PRIMARY KEY (id);


--
-- Name: emoji_name_deleteat_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.emoji
    ADD CONSTRAINT emoji_name_deleteat_key UNIQUE (name, deleteat);


--
-- Name: emoji_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.emoji
    ADD CONSTRAINT emoji_pkey PRIMARY KEY (id);


--
-- Name: fileinfo_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.fileinfo
    ADD CONSTRAINT fileinfo_pkey PRIMARY KEY (id);


--
-- Name: incomingwebhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.incomingwebhooks
    ADD CONSTRAINT incomingwebhooks_pkey PRIMARY KEY (id);


--
-- Name: jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: oauthaccessdata_clientid_userid_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.oauthaccessdata
    ADD CONSTRAINT oauthaccessdata_clientid_userid_key UNIQUE (clientid, userid);


--
-- Name: oauthaccessdata_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.oauthaccessdata
    ADD CONSTRAINT oauthaccessdata_pkey PRIMARY KEY (token);


--
-- Name: oauthapps_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.oauthapps
    ADD CONSTRAINT oauthapps_pkey PRIMARY KEY (id);


--
-- Name: oauthauthdata_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.oauthauthdata
    ADD CONSTRAINT oauthauthdata_pkey PRIMARY KEY (code);


--
-- Name: outgoingwebhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.outgoingwebhooks
    ADD CONSTRAINT outgoingwebhooks_pkey PRIMARY KEY (id);


--
-- Name: pluginkeyvaluestore_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.pluginkeyvaluestore
    ADD CONSTRAINT pluginkeyvaluestore_pkey PRIMARY KEY (pluginid, pkey);


--
-- Name: posts_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (userid, category, name);


--
-- Name: reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (postid, userid, emojiname);


--
-- Name: roles_name_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schemes_name_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.schemes
    ADD CONSTRAINT schemes_name_key UNIQUE (name);


--
-- Name: schemes_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.schemes
    ADD CONSTRAINT schemes_pkey PRIMARY KEY (id);


--
-- Name: sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: status_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (userid);


--
-- Name: systems_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_pkey PRIMARY KEY (name);


--
-- Name: teammembers_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.teammembers
    ADD CONSTRAINT teammembers_pkey PRIMARY KEY (teamid, userid);


--
-- Name: teams_name_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_key UNIQUE (name);


--
-- Name: teams_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (token);


--
-- Name: useraccesstokens_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.useraccesstokens
    ADD CONSTRAINT useraccesstokens_pkey PRIMARY KEY (id);


--
-- Name: useraccesstokens_token_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.useraccesstokens
    ADD CONSTRAINT useraccesstokens_token_key UNIQUE (token);


--
-- Name: users_authdata_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_authdata_key UNIQUE (authdata);


--
-- Name: users_email_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users_pkey; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users_username_key; Type: CONSTRAINT; Schema: public; Owner: mmuser; Tablespace:
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_audits_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_audits_user_id ON public.audits USING btree (userid);


--
-- Name: idx_channelmembers_channel_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channelmembers_channel_id ON public.channelmembers USING btree (channelid);


--
-- Name: idx_channelmembers_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channelmembers_user_id ON public.channelmembers USING btree (userid);


--
-- Name: idx_channels_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_create_at ON public.channels USING btree (createat);


--
-- Name: idx_channels_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_delete_at ON public.channels USING btree (deleteat);


--
-- Name: idx_channels_displayname_lower; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_displayname_lower ON public.channels USING btree (lower((displayname)::text));


--
-- Name: idx_channels_name; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_name ON public.channels USING btree (name);


--
-- Name: idx_channels_name_lower; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_name_lower ON public.channels USING btree (lower((name)::text));


--
-- Name: idx_channels_team_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_team_id ON public.channels USING btree (teamid);


--
-- Name: idx_channels_txt; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_txt ON public.channels USING gin (to_tsvector('english'::regconfig, (((name)::text || ' '::text) || (displayname)::text)));


--
-- Name: idx_channels_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_channels_update_at ON public.channels USING btree (updateat);


--
-- Name: idx_command_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_command_create_at ON public.commands USING btree (createat);


--
-- Name: idx_command_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_command_delete_at ON public.commands USING btree (deleteat);


--
-- Name: idx_command_team_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_command_team_id ON public.commands USING btree (teamid);


--
-- Name: idx_command_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_command_update_at ON public.commands USING btree (updateat);


--
-- Name: idx_command_webhook_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_command_webhook_create_at ON public.commandwebhooks USING btree (createat);


--
-- Name: idx_emoji_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_emoji_create_at ON public.emoji USING btree (createat);


--
-- Name: idx_emoji_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_emoji_delete_at ON public.emoji USING btree (deleteat);


--
-- Name: idx_emoji_name; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_emoji_name ON public.emoji USING btree (name);


--
-- Name: idx_emoji_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_emoji_update_at ON public.emoji USING btree (updateat);


--
-- Name: idx_fileinfo_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_fileinfo_create_at ON public.fileinfo USING btree (createat);


--
-- Name: idx_fileinfo_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_fileinfo_delete_at ON public.fileinfo USING btree (deleteat);


--
-- Name: idx_fileinfo_postid_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_fileinfo_postid_at ON public.fileinfo USING btree (postid);


--
-- Name: idx_fileinfo_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_fileinfo_update_at ON public.fileinfo USING btree (updateat);


--
-- Name: idx_incoming_webhook_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_incoming_webhook_create_at ON public.incomingwebhooks USING btree (createat);


--
-- Name: idx_incoming_webhook_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_incoming_webhook_delete_at ON public.incomingwebhooks USING btree (deleteat);


--
-- Name: idx_incoming_webhook_team_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_incoming_webhook_team_id ON public.incomingwebhooks USING btree (teamid);


--
-- Name: idx_incoming_webhook_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_incoming_webhook_update_at ON public.incomingwebhooks USING btree (updateat);


--
-- Name: idx_incoming_webhook_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_incoming_webhook_user_id ON public.incomingwebhooks USING btree (userid);


--
-- Name: idx_jobs_type; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_jobs_type ON public.jobs USING btree (type);


--
-- Name: idx_oauthaccessdata_client_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_oauthaccessdata_client_id ON public.oauthaccessdata USING btree (clientid);


--
-- Name: idx_oauthaccessdata_refresh_token; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_oauthaccessdata_refresh_token ON public.oauthaccessdata USING btree (refreshtoken);


--
-- Name: idx_oauthaccessdata_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_oauthaccessdata_user_id ON public.oauthaccessdata USING btree (userid);


--
-- Name: idx_oauthapps_creator_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_oauthapps_creator_id ON public.oauthapps USING btree (creatorid);


--
-- Name: idx_oauthauthdata_client_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_oauthauthdata_client_id ON public.oauthauthdata USING btree (code);


--
-- Name: idx_outgoing_webhook_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_outgoing_webhook_create_at ON public.outgoingwebhooks USING btree (createat);


--
-- Name: idx_outgoing_webhook_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_outgoing_webhook_delete_at ON public.outgoingwebhooks USING btree (deleteat);


--
-- Name: idx_outgoing_webhook_team_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_outgoing_webhook_team_id ON public.outgoingwebhooks USING btree (teamid);


--
-- Name: idx_outgoing_webhook_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_outgoing_webhook_update_at ON public.outgoingwebhooks USING btree (updateat);


--
-- Name: idx_posts_channel_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_channel_id ON public.posts USING btree (channelid);


--
-- Name: idx_posts_channel_id_delete_at_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_channel_id_delete_at_create_at ON public.posts USING btree (channelid, deleteat, createat);


--
-- Name: idx_posts_channel_id_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_channel_id_update_at ON public.posts USING btree (channelid, updateat);


--
-- Name: idx_posts_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_create_at ON public.posts USING btree (createat);


--
-- Name: idx_posts_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_delete_at ON public.posts USING btree (deleteat);


--
-- Name: idx_posts_hashtags_txt; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_hashtags_txt ON public.posts USING gin (to_tsvector('english'::regconfig, (hashtags)::text));


--
-- Name: idx_posts_is_pinned; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_is_pinned ON public.posts USING btree (ispinned);


--
-- Name: idx_posts_message_txt; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_message_txt ON public.posts USING gin (to_tsvector('english'::regconfig, (message)::text));


--
-- Name: idx_posts_root_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_root_id ON public.posts USING btree (rootid);


--
-- Name: idx_posts_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_update_at ON public.posts USING btree (updateat);


--
-- Name: idx_posts_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_posts_user_id ON public.posts USING btree (userid);


--
-- Name: idx_preferences_category; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_preferences_category ON public.preferences USING btree (category);


--
-- Name: idx_preferences_name; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_preferences_name ON public.preferences USING btree (name);


--
-- Name: idx_preferences_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_preferences_user_id ON public.preferences USING btree (userid);


--
-- Name: idx_sessions_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_sessions_create_at ON public.sessions USING btree (createat);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expiresat);


--
-- Name: idx_sessions_last_activity_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_sessions_last_activity_at ON public.sessions USING btree (lastactivityat);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (userid);


--
-- Name: idx_status_status; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_status_status ON public.status USING btree (status);


--
-- Name: idx_status_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_status_user_id ON public.status USING btree (userid);


--
-- Name: idx_teammembers_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teammembers_delete_at ON public.teammembers USING btree (deleteat);


--
-- Name: idx_teammembers_team_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teammembers_team_id ON public.teammembers USING btree (teamid);


--
-- Name: idx_teammembers_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teammembers_user_id ON public.teammembers USING btree (userid);


--
-- Name: idx_teams_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teams_create_at ON public.teams USING btree (createat);


--
-- Name: idx_teams_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teams_delete_at ON public.teams USING btree (deleteat);


--
-- Name: idx_teams_invite_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teams_invite_id ON public.teams USING btree (inviteid);


--
-- Name: idx_teams_name; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teams_name ON public.teams USING btree (name);


--
-- Name: idx_teams_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_teams_update_at ON public.teams USING btree (updateat);


--
-- Name: idx_user_access_tokens_token; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_user_access_tokens_token ON public.useraccesstokens USING btree (token);


--
-- Name: idx_user_access_tokens_user_id; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_user_access_tokens_user_id ON public.useraccesstokens USING btree (userid);


--
-- Name: idx_users_all_no_full_name_txt; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_all_no_full_name_txt ON public.users USING gin (to_tsvector('english'::regconfig, (((((username)::text || ' '::text) || (nickname)::text) || ' '::text) || (email)::text)));


--
-- Name: idx_users_all_txt; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_all_txt ON public.users USING gin (to_tsvector('english'::regconfig, (((((((((username)::text || ' '::text) || (firstname)::text) || ' '::text) || (lastname)::text) || ' '::text) || (nickname)::text) || ' '::text) || (email)::text)));


--
-- Name: idx_users_create_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_create_at ON public.users USING btree (createat);


--
-- Name: idx_users_delete_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_delete_at ON public.users USING btree (deleteat);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_lower; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- Name: idx_users_firstname_lower; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_firstname_lower ON public.users USING btree (lower((firstname)::text));


--
-- Name: idx_users_lastname_lower; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_lastname_lower ON public.users USING btree (lower((lastname)::text));


--
-- Name: idx_users_names_no_full_name_txt; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_names_no_full_name_txt ON public.users USING gin (to_tsvector('english'::regconfig, (((username)::text || ' '::text) || (nickname)::text)));


--
-- Name: idx_users_names_txt; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_names_txt ON public.users USING gin (to_tsvector('english'::regconfig, (((((((username)::text || ' '::text) || (firstname)::text) || ' '::text) || (lastname)::text) || ' '::text) || (nickname)::text)));


--
-- Name: idx_users_nickname_lower; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_nickname_lower ON public.users USING btree (lower((nickname)::text));


--
-- Name: idx_users_update_at; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_update_at ON public.users USING btree (updateat);


--
-- Name: idx_users_username_lower; Type: INDEX; Schema: public; Owner: mmuser; Tablespace:
--

CREATE INDEX idx_users_username_lower ON public.users USING btree (lower((username)::text));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: mmuser
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM mmuser;
GRANT ALL ON SCHEMA public TO mmuser;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--
