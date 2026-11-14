
ALTER TABLE ir_incident ALTER COLUMN id TYPE text;
ALTER TABLE ir_incident ALTER COLUMN name TYPE text;
ALTER TABLE ir_incident ALTER COLUMN description TYPE text;
ALTER TABLE ir_incident ALTER COLUMN commanderuserid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN teamid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN channelid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN postid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN playbookid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN activestagetitle TYPE text;
ALTER TABLE ir_incident ALTER COLUMN reminderpostid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN broadcastchannelid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN remindermessagetemplate TYPE text;
ALTER TABLE ir_incident ALTER COLUMN currentstatus TYPE text;
ALTER TABLE ir_incident ALTER COLUMN reporteruserid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN concatenatedinviteduserids TYPE text;
ALTER TABLE ir_incident ALTER COLUMN defaultcommanderid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN announcementchannelid TYPE text;
ALTER TABLE ir_incident ALTER COLUMN concatenatedwebhookoncreationurls TYPE text;
ALTER TABLE ir_incident ALTER COLUMN concatenatedwebhookonstatusupdateurls TYPE text;
ALTER TABLE ir_incident ALTER COLUMN concatenatedinvitedgroupids TYPE text;
ALTER TABLE ir_incident ALTER COLUMN retrospective TYPE text;
ALTER TABLE ir_incident ALTER COLUMN messageonjoin TYPE text;
ALTER TABLE ir_incident ALTER COLUMN categoryname TYPE text;
ALTER TABLE ir_incident ALTER COLUMN concatenatedbroadcastchannelids TYPE text;
ALTER TABLE ir_incident ALTER COLUMN channelidtorootid TYPE text;

ALTER TABLE ir_playbook ALTER COLUMN id TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN title TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN description TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN teamid TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN broadcastchannelid TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN remindermessagetemplate TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN concatenatedinviteduserids TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN defaultcommanderid TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN announcementchannelid TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN concatenatedwebhookoncreationurls TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN concatenatedinvitedgroupids TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN messageonjoin TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN retrospectivetemplate TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN concatenatedwebhookonstatusupdateurls TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN concatenatedsignalanykeywords TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN categoryname TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN concatenatedbroadcastchannelids TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN runsummarytemplate TYPE text;
ALTER TABLE ir_playbook ALTER COLUMN channelnametemplate TYPE text;

ALTER TABLE ir_statusposts ALTER COLUMN incidentid TYPE text;
ALTER TABLE ir_statusposts ALTER COLUMN postid TYPE text;

ALTER TABLE ir_category ALTER COLUMN id TYPE text;
ALTER TABLE ir_category ALTER COLUMN name TYPE text;
ALTER TABLE ir_category ALTER COLUMN teamid TYPE text;
ALTER TABLE ir_category ALTER COLUMN userid TYPE text;


ALTER TABLE ir_category_item ALTER COLUMN type TYPE text;
ALTER TABLE ir_category_item ALTER COLUMN categoryid TYPE text;
ALTER TABLE ir_category_item ALTER COLUMN itemid TYPE text;

ALTER TABLE ir_channelaction ALTER COLUMN id TYPE text;
ALTER TABLE ir_channelaction ALTER COLUMN actiontype TYPE text;
ALTER TABLE ir_channelaction ALTER COLUMN triggertype TYPE text;

ALTER TABLE ir_metric ALTER COLUMN incidentid TYPE text;
ALTER TABLE ir_metric ALTER COLUMN metricconfigid TYPE text;

ALTER TABLE ir_metricconfig ALTER COLUMN id TYPE text;
ALTER TABLE ir_metricconfig ALTER COLUMN playbookid TYPE text;
ALTER TABLE ir_metricconfig ALTER COLUMN title TYPE text;
ALTER TABLE ir_metricconfig ALTER COLUMN description TYPE text;
ALTER TABLE ir_metricconfig ALTER COLUMN type TYPE text;

ALTER TABLE ir_playbookautofollow ALTER COLUMN playbookid TYPE text;
ALTER TABLE ir_playbookautofollow ALTER COLUMN userid TYPE text;

ALTER TABLE ir_playbookmember ALTER COLUMN playbookid TYPE text;
ALTER TABLE ir_playbookmember ALTER COLUMN memberid TYPE text;
ALTER TABLE ir_playbookmember ALTER COLUMN roles TYPE text;

ALTER TABLE ir_run_participants ALTER COLUMN userid TYPE text;
ALTER TABLE ir_run_participants ALTER COLUMN incidentid TYPE text;

ALTER TABLE ir_timelineevent ALTER COLUMN id TYPE text;
ALTER TABLE ir_timelineevent ALTER COLUMN incidentid TYPE text;
ALTER TABLE ir_timelineevent ALTER COLUMN eventtype TYPE text;
ALTER TABLE ir_timelineevent ALTER COLUMN summary TYPE text;
ALTER TABLE ir_timelineevent ALTER COLUMN details TYPE text;
ALTER TABLE ir_timelineevent ALTER COLUMN postid TYPE text;
ALTER TABLE ir_timelineevent ALTER COLUMN subjectuserid TYPE text;
ALTER TABLE ir_timelineevent ALTER COLUMN creatoruserid TYPE text;

ALTER TABLE ir_userinfo ALTER COLUMN id TYPE text;

ALTER TABLE ir_viewedchannel ALTER COLUMN userid TYPE text;
ALTER TABLE ir_viewedchannel ALTER COLUMN channelid TYPE text;
