// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal, Fade} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import type {AppCallResponse, AppField, AppForm, AppFormValues, AppSelectOption, FormResponseData, AppLookupResponse, AppFormValue} from '@mattermost/types/apps';
import type {DialogElement} from '@mattermost/types/integrations';

import {AppCallResponseTypes, AppFieldTypes} from 'mattermost-redux/constants/apps';
import {
    checkDialogElementForError, checkIfErrorsMatchElements,
} from 'mattermost-redux/utils/integration_utils';

import Markdown from 'components/markdown';
import SpinnerButton from 'components/spinner_button';
import ModalSuggestionList from 'components/suggestion/modal_suggestion_list';
import SuggestionList from 'components/suggestion/suggestion_list';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {filterEmptyOptions} from 'utils/apps';
import {localizeMessage} from 'utils/utils';

import type {DoAppCallResult} from 'types/apps';

import AppsFormField from './apps_form_field';
import AppsFormHeader from './apps_form_header';

import './apps_form_component.scss';

export type AppsFormProps = {
    form: AppForm;
    isEmbedded?: boolean;
    onExited: () => void;
    actions: {
        submit: (submission: {
            values: AppFormValues;
        }) => Promise<DoAppCallResult<FormResponseData>>;
        performLookupCall: (field: AppField, values: AppFormValues, userInput: string) => Promise<DoAppCallResult<AppLookupResponse>>;
        refreshOnSelect: (field: AppField, values: AppFormValues) => Promise<DoAppCallResult<FormResponseData>>;
    };
}

export type Props = AppsFormProps & WrappedComponentProps<'intl'>;

export type State = {
    show: boolean;
    values: AppFormValues;
    formError: string | null;
    fieldErrors: {[name: string]: React.ReactNode};
    loading: boolean;
    submitting: string | null;
    form: AppForm;
}

const initFormValues = (form: AppForm): AppFormValues => {
    const values: AppFormValues = {};
    if (form && form.fields) {
        form.fields.forEach((f) => {
            let defaultValue: AppFormValue = null;
            if (f.type === AppFieldTypes.BOOL) {
                defaultValue = false;
            }

            values[f.name] = f.value || defaultValue;
        });
    }

    return values;
};

export class AppsForm extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        const {form} = props;
        const values = initFormValues(form);

        this.state = {
            loading: false,
            show: true,
            values,
            formError: null,
            fieldErrors: {},
            submitting: null,
            form,
        };
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        if (nextProps.form !== prevState.form) {
            return {
                values: initFormValues(nextProps.form),
                form: nextProps.form,
            };
        }

        return null;
    }

    updateErrors = (elements: DialogElement[], fieldErrors?: {[x: string]: string}, formError?: string): boolean => {
        let hasErrors = false;
        const state = {} as State;

        if (formError) {
            hasErrors = true;
            state.formError = formError;
        }

        if (fieldErrors && Object.keys(fieldErrors).length >= 0) {
            hasErrors = true;
            if (checkIfErrorsMatchElements(fieldErrors as any, elements)) {
                state.fieldErrors = {};
                for (const [key, value] of Object.entries(fieldErrors)) {
                    state.fieldErrors[key] = (<Markdown message={value}/>);
                }
            } else if (!state.formError) {
                const field = Object.keys(fieldErrors)[0];
                state.formError = this.props.intl.formatMessage({
                    id: 'apps.error.responses.unknown_field_error',
                    defaultMessage: 'Received an error for an unknown field. Field name: `{field}`. Error:\n{error}',
                }, {
                    field,
                    error: fieldErrors[field],
                });
            }
        }

        if (hasErrors) {
            this.setState(state);
        }

        return hasErrors;
    };

    handleSubmit = async (e: React.FormEvent, submitName?: string, value?: string) => {
        e.preventDefault();

        const {fields} = this.props.form;
        const values = this.state.values;
        if (submitName && value) {
            values[submitName] = value;
        }

        const fieldErrors: {[name: string]: React.ReactNode} = {};

        const elements = fieldsAsElements(fields);
        elements?.forEach((element) => {
            const error = checkDialogElementForError( // TODO: make sure all required values are present in `element`
                element,
                values[element.name],
            );
            if (error) {
                fieldErrors[element.name] = (
                    <FormattedMessage
                        id={error.id}
                        defaultMessage={error.defaultMessage}
                        values={error.values}
                    />
                );
            }
        });

        this.setState({fieldErrors});
        if (Object.keys(fieldErrors).length !== 0) {
            const formError = this.props.intl.formatMessage({
                id: 'apps.error.form.required_fields_empty',
                defaultMessage: 'Please fix all field errors',
            });

            this.setState({formError});
            return;
        }

        const submission = {
            values,
        };

        let submitting = 'submit';
        if (submitName && value) {
            submitting = value;
        }

        this.setState({submitting, formError: null});
        const res = await this.props.actions.submit(submission);
        this.setState({submitting: null});

        if (res.error) {
            const errorResponse = res.error;
            const errorMessage = errorResponse.text;
            const hasErrors = this.updateErrors(elements, errorResponse.data?.errors, errorMessage);
            if (!hasErrors) {
                this.handleHide(false);
            }
            return;
        }

        const callResponse = res.data as AppCallResponse<FormResponseData>;

        let hasErrors = false;
        let updatedForm = false;
        switch (callResponse.type) {
        case AppCallResponseTypes.FORM:
            updatedForm = true;
            break;
        case AppCallResponseTypes.OK:
        case AppCallResponseTypes.NAVIGATE:
            break;
        default:
            hasErrors = true;
            this.updateErrors([], undefined, this.props.intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResponse.type,
            }));
        }

        if (!hasErrors && !updatedForm) {
            this.handleHide(true);
        }
    };

    performLookup = async (name: string, userInput: string): Promise<AppSelectOption[]> => {
        const intl = this.props.intl;
        const field = this.props.form.fields?.find((f) => f.name === name);
        if (!field) {
            return [];
        }

        const res = await this.props.actions.performLookupCall(field, this.state.values, userInput);
        if (res.error) {
            const errorResponse = res.error;
            const errMsg = errorResponse.text || intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error occurred.',
            });
            this.setState({
                fieldErrors: {
                    ...this.state.fieldErrors,
                    [field.name]: errMsg,
                },
            });
            return [];
        }

        const callResp = res.data!;
        switch (callResp.type) {
        case AppCallResponseTypes.OK: {
            let items = callResp.data?.items || [];
            items = items?.filter(filterEmptyOptions);
            return items;
        }
        case AppCallResponseTypes.FORM:
        case AppCallResponseTypes.NAVIGATE: {
            const errMsg = intl.formatMessage({
                id: 'apps.error.responses.unexpected_type',
                defaultMessage: 'App response type was not expected. Response type: {type}',
            }, {
                type: callResp.type,
            },
            );
            this.setState({
                fieldErrors: {
                    ...this.state.fieldErrors,
                    [field.name]: errMsg,
                },
            });
            return [];
        }
        default: {
            const errMsg = intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResp.type,
            },
            );
            this.setState({
                fieldErrors: {
                    ...this.state.fieldErrors,
                    [field.name]: errMsg,
                },
            });
            return [];
        }
        }
    };

    onHide = () => {
        this.handleHide(false);
    };

    handleHide = (submitted = false) => {
        const {form} = this.props;

        if (!submitted && form.submit_on_cancel) {
            // const dialog = {
            //     url,
            //     callback_id: callbackId,
            //     state,
            //     cancelled: true,
            // };

            // this.props.actions.submit(dialog);
        }

        this.setState({show: false});
    };

    onChange = (name: string, value: any) => {
        const field = this.props.form.fields?.find((f) => f.name === name);
        if (!field) {
            return;
        }

        const values = {...this.state.values, [name]: value};

        if (field.refresh) {
            this.setState({loading: true});
            this.props.actions.refreshOnSelect(field, values).then((res) => {
                this.setState({loading: false});
                if (res.error) {
                    const errorResponse = res.error;
                    const errorMsg = errorResponse.text;
                    const errors = errorResponse.data?.errors;
                    const elements = fieldsAsElements(this.props.form.fields);
                    this.updateErrors(elements, errors, errorMsg);
                    return;
                }

                const callResponse = res.data!;
                switch (callResponse.type) {
                case AppCallResponseTypes.FORM:
                    return;
                case AppCallResponseTypes.OK:
                case AppCallResponseTypes.NAVIGATE:
                    this.updateErrors([], undefined, this.props.intl.formatMessage({
                        id: 'apps.error.responses.unexpected_type',
                        defaultMessage: 'App response type was not expected. Response type: {type}',
                    }, {
                        type: callResponse.type,
                    }));
                    return;
                default:
                    this.updateErrors([], undefined, this.props.intl.formatMessage({
                        id: 'apps.error.responses.unknown_type',
                        defaultMessage: 'App response type not supported. Response type: {type}.',
                    }, {
                        type: callResponse.type,
                    }));
                }
            });
        }

        this.setState({values});
    };

    renderModal() {
        const {fields, header} = this.props.form;
        const loading = Boolean(this.state.loading);
        const bodyClass = loading ? 'apps-form-modal-body-loading' : 'apps-form-modal-body-loaded';
        const bodyClassNames = 'apps-form-modal-body-common ' + bodyClass;
        return (
            <Modal
                id='appsModal'
                dialogClassName='a11y__modal about-modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                backdrop='static'
                role='dialog'
                aria-labelledby='appsModalLabel'
            >
                <form
                    onSubmit={this.handleSubmit}
                    autoComplete={'off'}
                >
                    <Modal.Header
                        closeButton={true}
                        style={{borderBottom: fields && fields.length ? '' : '0px'}}
                    >
                        <Modal.Title
                            componentClass='h1'
                            id='appsModalLabel'
                        >
                            {this.renderHeader()}
                        </Modal.Title>
                    </Modal.Header>
                    {(fields || header) && (
                        <Modal.Body>
                            <Fade in={loading}>
                                <div
                                    className={
                                        bodyClassNames
                                    }
                                >
                                    <LoadingSpinner style={{fontSize: '24px'}}/>
                                </div>
                            </Fade>
                            {this.renderBody()}
                        </Modal.Body>
                    )}
                    <Modal.Footer>
                        {this.renderFooter()}
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }

    renderEmbedded() {
        const {fields, header} = this.props.form;

        return (
            <form onSubmit={this.handleSubmit}>
                <div>
                    {this.renderHeader()}
                </div>
                {(fields || header) && (
                    <div>
                        {this.renderBody()}
                    </div>
                )}
                <div>
                    {this.renderFooter()}
                </div>
            </form>
        );
    }

    renderHeader() {
        const {
            title,
            icon,
        } = this.props.form;

        let iconComponent;
        if (icon) {
            iconComponent = (
                <img
                    id='appsModalIconUrl'
                    alt={'modal title icon'}
                    className='more-modal__image'
                    width='36'
                    height='36'
                    src={icon}
                />
            );
        }

        return (
            <React.Fragment>
                {iconComponent}
                {title}
            </React.Fragment>
        );
    }

    renderElements() {
        const {isEmbedded, form} = this.props;

        const {fields} = form;
        if (!fields) {
            return null;
        }

        return fields.filter((f) => f.name !== form.submit_buttons).map((field, index) => {
            return (
                <AppsFormField
                    field={field}
                    key={field.name}
                    autoFocus={index === 0}
                    name={field.name}
                    errorText={this.state.fieldErrors[field.name]}
                    value={this.state.values[field.name]}
                    performLookup={this.performLookup}
                    onChange={this.onChange}
                    listComponent={isEmbedded ? SuggestionList : ModalSuggestionList}
                />
            );
        });
    }

    renderBody() {
        const {fields, header} = this.props.form;

        return (fields || header) && (
            <React.Fragment>
                {header && (
                    <AppsFormHeader
                        id='appsModalHeader'
                        value={header}
                    />
                )}
                {this.renderElements()}
            </React.Fragment>
        );
    }

    renderFooter() {
        const {fields} = this.props.form;

        const submitText: React.ReactNode = (
            <FormattedMessage
                id='interactive_dialog.submit'
                defaultMessage='Submit'
            />
        );

        let submitButtons = [(
            <SpinnerButton
                id='appsModalSubmit'
                key='submit'
                type='submit'
                autoFocus={!fields || fields.length === 0}
                className='btn btn-primary save-button'
                spinning={Boolean(this.state.submitting)}
                spinningText={localizeMessage(
                    'interactive_dialog.submitting',
                    'Submitting...',
                )}
            >
                {submitText}
            </SpinnerButton>
        )];

        if (this.props.form.submit_buttons) {
            const field = fields?.find((f) => f.name === this.props.form.submit_buttons);
            if (field) {
                const buttons = field.options?.map((o) => (
                    <SpinnerButton
                        id={'appsModalSubmit' + o.value}
                        key={o.value}
                        type='submit'
                        className='btn btn-primary save-button'
                        spinning={this.state.submitting === o.value}
                        spinningText={o.label}
                        onClick={(e: React.MouseEvent) => this.handleSubmit(e, field.name, o.value)}
                    >
                        {o.label}
                    </SpinnerButton>
                ));
                if (buttons) {
                    submitButtons = buttons;
                }
            }
        }

        return (
            <React.Fragment>
                <div>
                    {this.state.formError && (
                        <div>
                            <div className='error-text'>
                                <Markdown message={this.state.formError}/>
                            </div>
                        </div>
                    )}
                    <button
                        id='appsModalCancel'
                        type='button'
                        className='btn btn-tertiary cancel-button'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='interactive_dialog.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    {submitButtons}
                </div>
            </React.Fragment>
        );
    }

    render() {
        return this.props.isEmbedded ? this.renderEmbedded() : this.renderModal();
    }
}

function fieldsAsElements(fields?: AppField[]): DialogElement[] {
    return fields?.map((f) => ({
        name: f.name,
        type: f.type,
        subtype: f.subtype,
        optional: !f.is_required,
    })) as DialogElement[];
}

export default injectIntl(AppsForm);
