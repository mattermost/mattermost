// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Buffer} from 'buffer';

import {LicenseLinks} from './constants';

const baseZendeskFormURL = 'https://support.mattermost.com/hc/en-us/requests/new';

export enum ZendeskSupportForm {
    SELF_HOSTED_SUPPORT_FORM = '11184911962004',
    CLOUD_SUPPORT_FORM = '11184929555092',
}

export enum ZendeskFormFieldIDs {
    CLOUD_WORKSPACE_URL = '5245314479252',
    SELF_HOSTED_ENVIRONMENT = '360026980452',
    BILLING_SALES_CATEGORY = '360031056451',
    EMAIL = 'anonymous_requester_email',
    SUBJECT = 'subject',
    DESCRIPTION = 'description'
}

export type PrefillFieldFormFieldIDs = {
    id: ZendeskFormFieldIDs;
    val: string;
}

export const buildZendeskSupportForm = (form: ZendeskSupportForm, formFieldIDs: PrefillFieldFormFieldIDs[]): string => {
    let formUrl = `${baseZendeskFormURL}?ticket_form_id=${form}`;

    formFieldIDs.forEach((formPrefill) => {
        formUrl = formUrl.concat(`&tf_${formPrefill.id}=${formPrefill.val}`);
    });

    if (form === ZendeskSupportForm.SELF_HOSTED_SUPPORT_FORM) {
        formUrl = formUrl.concat(`&tf_${ZendeskFormFieldIDs.SELF_HOSTED_ENVIRONMENT}=production`);
    }

    return formUrl;
};

export const goToSelfHostedSupportForm = (email: string, subject: string) => {
    const form = ZendeskSupportForm.SELF_HOSTED_SUPPORT_FORM;
    const url = buildZendeskSupportForm(form, [
        {id: ZendeskFormFieldIDs.EMAIL, val: email},
        {id: ZendeskFormFieldIDs.SUBJECT, val: subject},
    ]);
    window.open(url, '_blank');
};

export const getSelfHostedSupportLink = (email: string, subject: string) => {
    const form = ZendeskSupportForm.SELF_HOSTED_SUPPORT_FORM;
    const url = buildZendeskSupportForm(form, [
        {id: ZendeskFormFieldIDs.EMAIL, val: email},
        {id: ZendeskFormFieldIDs.SUBJECT, val: subject},
    ]);
    return url;
};

export const goToCloudSupportForm = (email: string, subject: string, description: string, workspaceURL: string) => {
    const form = ZendeskSupportForm.CLOUD_SUPPORT_FORM;
    let url = buildZendeskSupportForm(form, [
        {id: ZendeskFormFieldIDs.EMAIL, val: email},
        {id: ZendeskFormFieldIDs.SUBJECT, val: subject},
        {id: ZendeskFormFieldIDs.DESCRIPTION, val: description},
    ]);
    url = url.concat(`&tf_${ZendeskFormFieldIDs.CLOUD_WORKSPACE_URL}=${workspaceURL}`);
    window.open(url, '_blank');
};

export const getCloudSupportLink = (email: string, subject: string, description: string, workspaceURL: string) => {
    const form = ZendeskSupportForm.CLOUD_SUPPORT_FORM;
    let url = buildZendeskSupportForm(form, [
        {id: ZendeskFormFieldIDs.EMAIL, val: email},
        {id: ZendeskFormFieldIDs.SUBJECT, val: subject},
        {id: ZendeskFormFieldIDs.DESCRIPTION, val: description},
    ]);
    url = url.concat(`&tf_${ZendeskFormFieldIDs.CLOUD_WORKSPACE_URL}=${workspaceURL}`);
    return url;
};

const encodeString = (s: string) => {
    return Buffer.from(s).toString('base64');
};

export const buildMMURL = (baseURL: string, firstName: string, lastName: string, companyName: string, businessEmail: string, source: string, medium: string) => {
    const mmURL = `${baseURL}?qk=${encodeString(firstName)}&qp=${encodeString(lastName)}&qw=${encodeString(companyName)}&qx=${encodeString(businessEmail)}&utm_source=${source}&utm_medium=${medium}`;
    return mmURL;
};

export const goToMattermostContactSalesForm = (firstName: string, lastName: string, companyName: string, businessEmail: string, source: string, medium: string) => {
    const url = buildMMURL(LicenseLinks.CONTACT_SALES, firstName, lastName, companyName, businessEmail, source, medium);
    window.open(url, '_blank');
};

export const getCloudContactSalesLink = (firstName: string, lastName: string, companyName: string, businessEmail: string, source: string, medium: string) => {
    const url = buildMMURL(LicenseLinks.CONTACT_SALES, firstName, lastName, companyName, businessEmail, source, medium);
    return url;
};
