// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import {createCallRequest, makeCallErrorResponse} from 'utils/apps';

import AppsForm from './apps_form_component';

import type {AppContext, AppField, AppForm, AppFormValues, FormResponseData, AppLookupResponse} from '@mattermost/types/apps';
import type {IntlShape} from 'react-intl';
import type {DoAppSubmit, DoAppFetchForm, DoAppLookup, DoAppCallResult, PostEphemeralCallResponseForContext} from 'types/apps';

type Props = {
    intl: IntlShape;
    form?: AppForm;
    context?: AppContext;
    onExited: () => void;
    actions: {
        doAppSubmit: DoAppSubmit<any>;
        doAppFetchForm: DoAppFetchForm<any>;
        doAppLookup: DoAppLookup<any>;
        postEphemeralCallResponseForContext: PostEphemeralCallResponseForContext;
    };
};

type State = {
    form?: AppForm;
}

class AppsFormContainer extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {form: props.form};
    }

    submitForm = async (submission: {values: AppFormValues}): Promise<DoAppCallResult<FormResponseData>> => {
        const makeErrorMsg = (msg: string) => {
            return this.props.intl.formatMessage(
                {
                    id: 'apps.error.form.submit.pretext',
                    defaultMessage: 'There has been an error submitting the modal. Contact the app developer. Details: {details}',
                },
                {details: msg},
            );
        };
        const {form} = this.state;
        if (!form) {
            const errMsg = this.props.intl.formatMessage({id: 'apps.error.form.no_form', defaultMessage: '`form` is not defined.'});
            return {error: makeCallErrorResponse(makeErrorMsg(errMsg))};
        }
        if (!form.submit) {
            const errMsg = this.props.intl.formatMessage({id: 'apps.error.form.no_submit', defaultMessage: '`submit` is not defined'});
            return {error: makeCallErrorResponse(makeErrorMsg(errMsg))};
        }
        if (!this.props.context) {
            return {error: makeCallErrorResponse('unreachable: empty context')};
        }

        const creq = createCallRequest(form.submit, this.props.context, {}, submission.values);
        const res = await this.props.actions.doAppSubmit(creq, this.props.intl) as DoAppCallResult<FormResponseData>;
        if (res.error) {
            return res;
        }

        const callResp = res.data!;
        switch (callResp.type) {
        case AppCallResponseTypes.OK:
            if (callResp.text) {
                this.props.actions.postEphemeralCallResponseForContext(
                    callResp,
                    callResp.text,
                    creq.context,
                );
            }
            break;
        case AppCallResponseTypes.FORM:
            this.setState({form: callResp.form});
            break;
        case AppCallResponseTypes.NAVIGATE:
            break;
        default:
            return {error: makeCallErrorResponse(makeErrorMsg(this.props.intl.formatMessage(
                {
                    id: 'apps.error.responses.unknown_type',
                    defaultMessage: 'App response type not supported. Response type: {type}.',
                }, {
                    type: callResp.type,
                },
            )))};
        }
        return res;
    };

    refreshOnSelect = async (field: AppField, values: AppFormValues): Promise<DoAppCallResult<FormResponseData>> => {
        const makeErrMsg = (message: string) => this.props.intl.formatMessage(
            {
                id: 'apps.error.form.update',
                defaultMessage: 'There has been an error updating the modal. Contact the app developer. Details: {details}',
            },
            {details: message},
        );

        const {form} = this.state;
        if (!form) {
            return {error: makeCallErrorResponse(makeErrMsg(this.props.intl.formatMessage({
                id: 'apps.error.form.no_form',
                defaultMessage: '`form` is not defined.',
            })))};
        }
        if (!form.source) {
            return {error: makeCallErrorResponse(makeErrMsg(this.props.intl.formatMessage({
                id: 'apps.error.form.no_source',
                defaultMessage: '`source` is not defined.',
            })))};
        }
        if (!field.refresh) {
            // Should never happen
            return {error: makeCallErrorResponse(makeErrMsg(this.props.intl.formatMessage({
                id: 'apps.error.form.refresh_no_refresh',
                defaultMessage: 'Called refresh on no refresh field.',
            })))};
        }
        if (!this.props.context) {
            return {error: makeCallErrorResponse('unreachable: empty context')};
        }

        const creq = createCallRequest(form.source, this.props.context, {}, values);
        creq.selected_field = field.name;

        const res = await this.props.actions.doAppFetchForm(creq, this.props.intl);
        if (res.error) {
            return res;
        }

        const callResp = res.data!;
        switch (callResp.type) {
        case AppCallResponseTypes.FORM:
            this.setState({form: callResp.form});
            break;
        case AppCallResponseTypes.OK:
        case AppCallResponseTypes.NAVIGATE:
            return {error: makeCallErrorResponse(makeErrMsg(this.props.intl.formatMessage({
                id: 'apps.error.responses.unexpected_type',
                defaultMessage: 'App response type was not expected. Response type: {type}',
            }, {
                type: callResp.type,
            },
            )))};
        default:
            return {error: makeCallErrorResponse(makeErrMsg(this.props.intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResp.type,
            },
            )))};
        }
        return res;
    };

    performLookupCall = async (field: AppField, values: AppFormValues, userInput: string): Promise<DoAppCallResult<AppLookupResponse>> => {
        const intl = this.props.intl;
        const makeErrorMsg = (message: string) => intl.formatMessage(
            {
                id: 'apps.error.form.refresh',
                defaultMessage: 'There has been an error fetching the select fields. Contact the app developer. Details: {details}',
            },
            {details: message},
        );
        if (!field.lookup) {
            return {error: makeCallErrorResponse(makeErrorMsg(intl.formatMessage({
                id: 'apps.error.form.no_lookup',
                defaultMessage: '`lookup` is not defined.',
            })))};
        }
        if (!this.props.context) {
            return {error: makeCallErrorResponse('unreachable: empty context')};
        }

        const creq = createCallRequest(field.lookup, this.props.context, {}, values);
        creq.selected_field = field.name;
        creq.query = userInput;

        return this.props.actions.doAppLookup(creq, intl);
    };

    render() {
        const {form} = this.state;

        if (!form?.submit || !this.props.context) {
            return null;
        }

        return (
            <AppsForm
                form={form}
                onExited={this.props.onExited}
                actions={{
                    submit: this.submitForm,
                    performLookupCall: this.performLookupCall,
                    refreshOnSelect: this.refreshOnSelect,
                }}
            />
        );
    }
}

// Exported for tests
export {AppsFormContainer as RawAppsFormContainer};

export default injectIntl(AppsFormContainer);
