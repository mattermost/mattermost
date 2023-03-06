ALTER TABLE ir_incident ALTER COLUMN id TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN name TYPE varchar(1024);
ALTER TABLE ir_incident ALTER COLUMN description TYPE varchar(4096);
ALTER TABLE ir_incident ALTER COLUMN commanderuserid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN teamid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN channelid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN postid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN playbookid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN activestagetitle TYPE varchar(1024);
ALTER TABLE ir_incident ALTER COLUMN reminderpostid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN broadcastchannelid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN remindermessagetemplate TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN currentstatus TYPE varchar(1024);
ALTER TABLE ir_incident ALTER COLUMN reporteruserid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN concatenatedinviteduserids TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN defaultcommanderid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN announcementchannelid TYPE varchar(26);
ALTER TABLE ir_incident ALTER COLUMN concatenatedwebhookoncreationurls TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN concatenatedwebhookonstatusupdateurls TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN concatenatedinvitedgroupids TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN retrospective TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN messageonjoin TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN categoryname TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN concatenatedbroadcastchannelids TYPE varchar(65535);
ALTER TABLE ir_incident ALTER COLUMN channelidtorootid TYPE varchar(65535);


ALTER TABLE ir_playbook ALTER COLUMN id TYPE varchar(26);
ALTER TABLE ir_playbook ALTER COLUMN title TYPE varchar(1024);
ALTER TABLE ir_playbook ALTER COLUMN description TYPE varchar(4096);
ALTER TABLE ir_playbook ALTER COLUMN teamid TYPE varchar(26);
ALTER TABLE ir_playbook ALTER COLUMN broadcastchannelid TYPE varchar(26);
ALTER TABLE ir_playbook ALTER COLUMN remindermessagetemplate TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN concatenatedinviteduserids TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN defaultcommanderid TYPE varchar(26);
ALTER TABLE ir_playbook ALTER COLUMN announcementchannelid TYPE varchar(26);
ALTER TABLE ir_playbook ALTER COLUMN concatenatedwebhookoncreationurls TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN concatenatedinvitedgroupids TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN messageonjoin TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN retrospectivetemplate TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN concatenatedwebhookonstatusupdateurls TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN concatenatedsignalanykeywords TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN categoryname TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN concatenatedbroadcastchannelids TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN runsummarytemplate TYPE varchar(65535);
ALTER TABLE ir_playbook ALTER COLUMN channelnametemplate TYPE varchar(65535);

ALTER TABLE ir_statusposts ALTER COLUMN incidentid TYPE varchar(26);
ALTER TABLE ir_statusposts ALTER COLUMN postid TYPE varchar(26);

ALTER TABLE ir_category ALTER COLUMN id TYPE varchar(26);
ALTER TABLE ir_category ALTER COLUMN name TYPE varchar(512);
ALTER TABLE ir_category ALTER COLUMN teamid TYPE varchar(26);
ALTER TABLE ir_category ALTER COLUMN userid TYPE varchar(26);

ALTER TABLE ir_category_item ALTER COLUMN type TYPE varchar(1);
ALTER TABLE ir_category_item ALTER COLUMN categoryid TYPE varchar(26);
ALTER TABLE ir_category_item ALTER COLUMN itemid TYPE varchar(26);

ALTER TABLE ir_channelaction ALTER COLUMN id TYPE varchar(26);
ALTER TABLE ir_channelaction ALTER COLUMN actiontype TYPE varchar(65535);
ALTER TABLE ir_channelaction ALTER COLUMN triggertype TYPE varchar(65535);

ALTER TABLE ir_metric ALTER COLUMN incidentid TYPE varchar(26);
ALTER TABLE ir_metric ALTER COLUMN metricconfigid TYPE varchar(26);

ALTER TABLE ir_metricconfig ALTER COLUMN id TYPE varchar(26);
ALTER TABLE ir_metricconfig ALTER COLUMN playbookid TYPE varchar(26);
ALTER TABLE ir_metricconfig ALTER COLUMN title TYPE varchar(512);
ALTER TABLE ir_metricconfig ALTER COLUMN description TYPE varchar(4096);
ALTER TABLE ir_metricconfig ALTER COLUMN type TYPE varchar(32);

ALTER TABLE ir_playbookautofollow ALTER COLUMN playbookid TYPE varchar(26);
ALTER TABLE ir_playbookautofollow ALTER COLUMN userid TYPE varchar(26);

ALTER TABLE ir_playbookmember ALTER COLUMN playbookid TYPE varchar(26);
ALTER TABLE ir_playbookmember ALTER COLUMN memberid TYPE varchar(26);
ALTER TABLE ir_playbookmember ALTER COLUMN roles TYPE varchar(65535);

ALTER TABLE ir_run_participants ALTER COLUMN userid TYPE varchar(26);
ALTER TABLE ir_run_participants ALTER COLUMN incidentid TYPE varchar(26);

ALTER TABLE ir_timelineevent ALTER COLUMN id TYPE varchar(26);
ALTER TABLE ir_timelineevent ALTER COLUMN incidentid TYPE varchar(26);
ALTER TABLE ir_timelineevent ALTER COLUMN eventtype TYPE varchar(32);
ALTER TABLE ir_timelineevent ALTER COLUMN summary TYPE varchar(256);
ALTER TABLE ir_timelineevent ALTER COLUMN details TYPE varchar(4096);
ALTER TABLE ir_timelineevent ALTER COLUMN postid TYPE varchar(26);
ALTER TABLE ir_timelineevent ALTER COLUMN subjectuserid TYPE varchar(26);
ALTER TABLE ir_timelineevent ALTER COLUMN creatoruserid TYPE varchar(26);

ALTER TABLE ir_userinfo ALTER COLUMN id TYPE varchar(26);

ALTER TABLE ir_viewedchannel ALTER COLUMN userid TYPE varchar(26);
ALTER TABLE ir_viewedchannel ALTER COLUMN channelid TYPE varchar(26);
