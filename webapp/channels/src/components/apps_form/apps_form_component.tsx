// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React from 'react';
import {Modal, Fade} from 'react-bootstrap';
import {defineMessage, FormattedMessage, injectIntl} from 'react-intl';
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
import {momentToString, stringToMoment, resolveRelativeDate} from 'utils/date_utils';

import type {DoAppCallResult} from 'types/apps';

import AppsFormField from './apps_form_field';
import AppsFormHeader from './apps_form_header';

import './apps_form_component.scss';

// Default time interval for DateTime fields in minutes
const DEFAULT_TIME_INTERVAL_MINUTES = 60;

export type AppsFormProps = {
    form: AppForm;
    timezone?: string;
    isEmbedded?: boolean;
    onExited: () => void;
    onHide?: () => void;
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

// Helper function to validate date format and warn if datetime format is used
const validateDateFieldValue = (fieldName: string, valueType: string, value: string): { warning: string; datePortion: string } | null => {
    if (!value) {
        return null;
    }

    // First handle relative dates
    const resolved = resolveRelativeDate(value);

    // Check if the resolved value is a datetime format being used for a date field
    if (resolved.includes('T') && resolved.match(/^\d{4}-\d{2}-\d{2}T/)) {
        // Extract date portion to show what will actually be used
        const datePortion = resolved.split('T')[0];
        return {
            warning: `Field "${fieldName}": ${valueType} received datetime format "${resolved}", only date portion "${datePortion}" will be used. Consider using date format instead`,
            datePortion,
        };
    }

    return null;
};

const validateAppField = (field: AppField): string[] => {
    const errors: string[] = [];

    // Validate time_interval for datetime fields (no mutation)
    if (field.type === AppFieldTypes.DATETIME && field.time_interval !== undefined) {
        if (typeof field.time_interval !== 'number' || field.time_interval <= 0 || field.time_interval > 1440) {
            errors.push(`Field "${field.name}": time_interval must be a positive number between 1 and 1440 minutes`);
        } else if (1440 % field.time_interval !== 0) {
            errors.push(`Field "${field.name}": time_interval must be a divisor of 1440 (24 hours * 60 minutes) to create valid time intervals, got ${field.time_interval}`);
        }
    }

    // Validate min_date and max_date for date/datetime fields (no mutation)
    if (field.type === AppFieldTypes.DATE || field.type === AppFieldTypes.DATETIME) {
        if (field.min_date) {
            const result = validateDateFieldValue(field.name, 'min_date', field.min_date);
            if (result) {
                errors.push(result.warning);
            }

            const moment = stringToMoment(field.min_date);
            if (!moment) {
                errors.push(`Field "${field.name}": min_date "${field.min_date}" is not a valid date format`);
            }
        }

        if (field.max_date) {
            const result = validateDateFieldValue(field.name, 'max_date', field.max_date);
            if (result) {
                errors.push(result.warning);
            }
            const moment = stringToMoment(field.max_date);
            if (!moment) {
                errors.push(`Field "${field.name}": max_date "${field.max_date}" is not a valid date format`);
            }
        }

        // Validate that min_date < max_date if both are present
        if (field.min_date && field.max_date) {
            const minMoment = stringToMoment(field.min_date);
            const maxMoment = stringToMoment(field.max_date);

            if (minMoment && maxMoment && minMoment.isAfter(maxMoment)) {
                errors.push(`Field "${field.name}": min_date cannot be after max_date`);
            }
        }

        // Validate default value format for date fields (no mutation)
        if (field.type === AppFieldTypes.DATE && field.value && typeof field.value === 'string') {
            const result = validateDateFieldValue(field.name, 'default value', field.value);
            if (result) {
                errors.push(result.warning);
            }
        }
    }

    return errors;
};

// Helper function to get safe date value without mutating original
const getSafeDateValue = (dateString: string): string => {
    const resolved = resolveRelativeDate(dateString);
    if (resolved.includes('T') && resolved.match(/^\d{4}-\d{2}-\d{2}T/)) {
        return resolved.split('T')[0]; // Extract date portion
    }
    return resolved;
};

// Create sanitized copy of field for safe usage
const createSanitizedField = (field: AppField): AppField => {
    const sanitized = {...field};

    // Sanitize time_interval for datetime fields
    if (field.type === AppFieldTypes.DATETIME && field.time_interval !== undefined) {
        const interval = field.time_interval;
        if (typeof interval !== 'number' || interval <= 0 || interval > 1440 || 1440 % interval !== 0) {
            sanitized.time_interval = DEFAULT_TIME_INTERVAL_MINUTES;
        }
    }

    // Sanitize date values for date/datetime fields
    if (field.type === AppFieldTypes.DATE || field.type === AppFieldTypes.DATETIME) {
        if (field.min_date) {
            sanitized.min_date = getSafeDateValue(field.min_date);
        }
        if (field.max_date) {
            sanitized.max_date = getSafeDateValue(field.max_date);
        }
        if (field.type === AppFieldTypes.DATE && field.value && typeof field.value === 'string') {
            sanitized.value = getSafeDateValue(field.value);
        }
    }

    return sanitized;
};

const initFormValues = (form: AppForm, timezone?: string): AppFormValues => {
    const values: AppFormValues = {};
    if (form && form.fields) {
        // Validate all fields first and log any validation errors (no mutations)
        const allErrors: string[] = [];
        form.fields.forEach((f) => {
            const fieldErrors = validateAppField(f);
            allErrors.push(...fieldErrors);
        });

        if (allErrors.length > 0) {
            // These validations are not enforced, logging only.
            // eslint-disable-next-line no-console
            console.warn('AppForm field validation errors:', allErrors);
        }

        // Work with sanitized copies for safe usage
        form.fields.forEach((originalField) => {
            const field = createSanitizedField(originalField);

            let defaultValue: AppFormValue = null;
            if (field.type === AppFieldTypes.BOOL) {
                defaultValue = false;
            } else if (field.type === AppFieldTypes.DATETIME && field.is_required && !field.value) {
                // Set default to current time for required datetime fields
                const currentTime = timezone ? moment.tz(timezone) : moment();

                // Use sanitized time_interval (guaranteed to be valid)
                const timePickerInterval = field.time_interval || DEFAULT_TIME_INTERVAL_MINUTES;

                // Round up to next time interval
                const minutesMod = currentTime.minutes() % timePickerInterval;
                const defaultMoment = minutesMod === 0 ?
                    currentTime.clone().seconds(0).milliseconds(0) :
                    currentTime.clone().add(timePickerInterval - minutesMod, 'minutes').seconds(0).milliseconds(0);
                defaultValue = momentToString(defaultMoment, true);
            }

            values[field.name] = field.value || defaultValue;
        });
    }

    return values;
};

export class AppsForm extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        const {form, timezone} = props;
        const values = initFormValues(form, timezone);

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
            const values = {
                ...prevState.values,
                ...initFormValues(nextProps.form),
            };

            return {
                values,
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
            if (checkIfErrorsMatchElements(fieldErrors, elements)) {
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
        this.props.onHide?.();
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

    hasDateTimeFields = (): boolean => {
        const {fields} = this.props.form;
        return fields ? fields.some((field) =>
            field.type === AppFieldTypes.DATE || field.type === AppFieldTypes.DATETIME,
        ) : false;
    };

    renderModal() {
        const {fields, header} = this.props.form;
        const loading = Boolean(this.state.loading);
        const bodyClass = loading ? 'apps-form-modal-body-loading' : 'apps-form-modal-body-loaded';
        const bodyClassNames = 'apps-form-modal-body-common ' + bodyClass;

        // Apply same pattern as DND modal for date/datetime fields
        const hasDateTimeFields = this.hasDateTimeFields();
        const dialogClassName = hasDateTimeFields ? 'a11y__modal about-modal modal-overflow' : 'a11y__modal about-modal';

        return (
            <Modal
                id='appsModal'
                dialogClassName={dialogClassName}
                enforceFocus={!hasDateTimeFields}
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                backdrop='static'
                role='none'
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
                    style={{marginRight: '12px'}}
                    width='36'
                    height='36'
                    src={icon}
                />
            );
        }

        return (
            <>
                {iconComponent}
                {title}
            </>
        );
    }

    renderElements() {
        const {isEmbedded, form} = this.props;

        const {fields} = form;
        if (!fields) {
            return null;
        }

        return fields.filter((f) => f.name !== form.submit_buttons).map((originalField, index) => {
            // Use sanitized field for safe usage in components
            const field = createSanitizedField(originalField);

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
            <>
                {header && (
                    <AppsFormHeader
                        id='appsModalHeader'
                        value={header}
                    />
                )}
                {this.renderElements()}
            </>
        );
    }

    renderFooter() {
        const {fields, submit_label: submitLabel} = this.props.form;

        const submitText: React.ReactNode = submitLabel || (
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
                spinningText={defineMessage({
                    id: 'interactive_dialog.submitting',
                    defaultMessage: 'Submitting...',
                })}
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
            <>
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
            </>
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
