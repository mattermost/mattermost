// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

export const messages = defineMessages({
    globalRelayCustomerType_title: {id: 'admin.complianceExport.globalRelayCustomerType.title', defaultMessage: 'Customer Type:'},
    globalRelayCustomerType_description: {id: 'admin.complianceExport.globalRelayCustomerType.description', defaultMessage: 'The type of GlobalRelay customer account that your organization has.'},
    globalRelaySMTPUsername_title: {id: 'admin.complianceExport.globalRelaySMTPUsername.title', defaultMessage: 'SMTP Username:'},
    globalRelaySMTPUsername_description: {id: 'admin.complianceExport.globalRelaySMTPUsername.description', defaultMessage: 'The username that is used to authenticate against the GlobalRelay SMTP server.'},
    globalRelaySMTPPassword_title: {id: 'admin.complianceExport.globalRelaySMTPPassword.title', defaultMessage: 'SMTP Password:'},
    globalRelaySMTPPassword_description: {id: 'admin.complianceExport.globalRelaySMTPPassword.description', defaultMessage: 'The password that is used to authenticate against the GlobalRelay SMTP server.'},
    globalRelayEmailAddress_title: {id: 'admin.complianceExport.globalRelayEmailAddress.title', defaultMessage: 'Email Address:'},
    globalRelayEmailAddress_description: {id: 'admin.complianceExport.globalRelayEmailAddress.description', defaultMessage: 'The email address that your GlobalRelay server monitors for incoming Compliance Exports.'},
    complianceExportTitle: {id: 'admin.service.complianceExportTitle', defaultMessage: 'Enable Compliance Export:'},
    complianceExportDesc: {id: 'admin.service.complianceExportDesc', defaultMessage: 'When true, Mattermost will export all messages that were posted in the last 24 hours. The export task is scheduled to run once per day. See <link>the documentation</link> to learn more.'},
    exportJobStartTime_title: {id: 'admin.complianceExport.exportJobStartTime.title', defaultMessage: 'Compliance Export Time:'},
    exportJobStartTime_description: {id: 'admin.complianceExport.exportJobStartTime.description', defaultMessage: 'Set the start time of the daily scheduled compliance export job. Choose a time when fewer people are using your system. Must be a 24-hour time stamp in the form HH:MM.'},
    exportFormat_title: {id: 'admin.complianceExport.exportFormat.title', defaultMessage: 'Export Format:'},
    exportFormat_description_intro: {
        id: 'admin.complianceExport.exportFormatDetail.intro',
        defaultMessage: 'Format of the compliance export. Corresponds to the system that you want to import the data into.'},
    exportFormat_description_details: {
        id: 'admin.complianceExport.exportFormatDetail.details',
        defaultMessage: 'For Actiance XML, compliance export files are written to the exports subdirectory of the configured <a>Local Storage Directory</a>. For Global Relay EML, they are emailed to the configured email address.'},
    createJob_title: {id: 'admin.complianceExport.createJob.title', defaultMessage: 'Run Compliance Export Job Now'},
    createJob_help: {id: 'admin.complianceExport.createJob.help', defaultMessage: 'Initiates a Compliance Export job immediately.'},
});

export const searchableStrings: Array<
string | MessageDescriptor | [MessageDescriptor, { [key: string]: any }]
> = [
    messages.exportFormat_description_intro,
    messages.exportFormat_description_details,
    messages.complianceExportTitle,
    messages.complianceExportDesc,
    messages.exportJobStartTime_title,
    messages.exportJobStartTime_description,
    messages.exportFormat_title,
    messages.createJob_title,
    messages.createJob_help,
    messages.globalRelayCustomerType_title,
    messages.globalRelayCustomerType_description,
    messages.globalRelaySMTPUsername_title,
    messages.globalRelaySMTPUsername_description,
    messages.globalRelaySMTPPassword_title,
    messages.globalRelaySMTPPassword_description,
    messages.globalRelayEmailAddress_title,
    messages.globalRelayEmailAddress_description,
];
