// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import type {Store} from 'redux';

import {Constants} from 'utils/constants';

import {
    AppsTypes,

    AppBindingLocations,
    AppCallResponseTypes,
    AppFieldTypes,
    makeAppBindingsSelector,
    selectChannel,
    getChannel,
    getCurrentTeamId,
    doAppFetchForm,
    doAppLookup,
    getStore,
    EXECUTE_CURRENT_COMMAND_ITEM_ID,
    COMMAND_SUGGESTION_ERROR,
    getExecuteSuggestion,
    createCallRequest,
    selectUserByUsername,
    getUserByUsername,
    selectUser,
    getUser,
    getChannelByNameAndTeamName,
    getCurrentTeam,
    selectChannelByName,
    errorMessage as parserErrorMessage,
    filterEmptyOptions,
    autocompleteUsersInChannel,
    autocompleteChannels,
    getOpenInModalSuggestion,
    OPEN_COMMAND_IN_MODAL_ITEM_ID,
    getChannelSuggestions,
    getUserSuggestions,
    inTextMentionSuggestions,
    getAppCommandForm,
    getAppRHSCommandForm,
    makeRHSAppBindingSelector,
} from './app_command_parser_dependencies';
import type {
    AppCallRequest,
    AppBinding,
    AppCall,
    AppField,
    DoAppCallResult,
    AppLookupResponse,
    AppContext,
    AppForm,
    AppCallValues,
    AppSelectOption,
    AutocompleteSuggestion,
    AutocompleteStaticSelect,
    Channel,
    ExtendedAutocompleteSuggestion,
    intlShim} from './app_command_parser_dependencies';

export enum ParseState {
    Start = 'Start',
    Command = 'Command',
    EndCommand = 'EndCommand',
    CommandSeparator = 'CommandSeparator',
    StartParameter = 'StartParameter',
    ParameterSeparator = 'ParameterSeparator',
    Flag1 = 'Flag1',
    Flag = 'Flag',
    FlagValueSeparator = 'FlagValueSeparator',
    StartValue = 'StartValue',
    NonspaceValue = 'NonspaceValue',
    QuotedValue = 'QuotedValue',
    TickValue = 'TickValue',
    EndValue = 'EndValue',
    EndQuotedValue = 'EndQuotedValue',
    EndTickedValue = 'EndTickedValue',
    Error = 'Error',
    MultiselectStart = 'MultiselectStart',
    MultiselectStartValue = 'MultiselectStartValue',
    MultiselectNonspaceValue = 'MultiselectNonspaceValue',
    MultiselectQuotedValue = 'MultiselectQuotedValue',
    MultiselectTickValue = 'MultiselectTickValue',
    MultiselectEndValue = 'MultiselectEndValue',
    MultiselectEndQuotedValue = 'MultiselectEndQuotedValue',
    MultiselectEndTickedValue = 'MultiselectEndTickedValue',
    MultiselectValueSeparator = 'MultiselectValueSeparator',
    MultiselectNextValue = 'MultiselectNextValue',
    Rest = 'Rest',
}

interface FormsCache {
    getSubmittableForm: (location: string, binding: AppBinding) => Promise<{form?: AppForm; error?: string} | undefined>;
}

type Intl = typeof intlShim;

const getCommandBindings = makeAppBindingsSelector(AppBindingLocations.COMMAND);
const getRHSCommandBindings = makeRHSAppBindingSelector(AppBindingLocations.COMMAND);

export class ParsedCommand {
    state = ParseState.Start;
    command: string;
    i = 0;
    incomplete = '';
    incompleteStart = 0;
    binding: AppBinding | undefined;
    resolvedForm: AppForm | undefined;
    formsCache: FormsCache;
    field: AppField | undefined;
    position = 0;
    values: {[name: string]: string | string[]} = {};
    location = '';
    error = '';
    intl: Intl;

    constructor(command: string, formsCache: FormsCache, intl: any) {
        this.command = command;
        this.formsCache = formsCache || [];
        this.intl = intl;
    }

    private asError = (message: string): ParsedCommand => {
        this.state = ParseState.Error;
        this.error = message;
        return this;
    };

    // matchBinding finds the closest matching command binding.
    public matchBinding = async (commandBindings: AppBinding[], autocompleteMode = false): Promise<ParsedCommand> => {
        if (commandBindings.length === 0) {
            return this.asError(this.intl.formatMessage({
                id: 'apps.error.parser.no_bindings',
                defaultMessage: 'No command bindings.',
            }));
        }
        let bindings = commandBindings;

        let done = false;
        while (!done) {
            let c = '';
            if (this.i < this.command.length) {
                c = this.command[this.i];
            }

            switch (this.state) {
            case ParseState.Start: {
                if (c !== '/') {
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.no_slash_start',
                        defaultMessage: 'Command must start with a `/`.',
                    }));
                }
                this.i++;
                this.incomplete = '';
                this.incompleteStart = this.i;
                this.state = ParseState.Command;
                break;
            }

            case ParseState.Command: {
                switch (c) {
                case '': {
                    if (autocompleteMode) {
                        // Finish in the Command state, 'incomplete' will have the query string
                        done = true;
                    } else {
                        this.state = ParseState.EndCommand;
                    }
                    break;
                }
                case ' ':
                case '\t': {
                    this.state = ParseState.EndCommand;
                    break;
                }
                default:
                    this.incomplete += c;
                    this.i++;
                    break;
                }
                break;
            }

            case ParseState.EndCommand: {
                const binding = bindings.find((b: AppBinding) => b.label.toLowerCase() === this.incomplete.toLowerCase());
                if (!binding) {
                    // gone as far as we could, this token doesn't match a sub-command.
                    // return the state from the last matching binding
                    done = true;
                    break;
                }
                this.binding = binding;
                this.location += '/' + binding.label;
                bindings = binding.bindings || [];
                this.state = ParseState.CommandSeparator;
                break;
            }

            case ParseState.CommandSeparator: {
                if (c === '') {
                    done = true;
                }

                switch (c) {
                case ' ':
                case '\t': {
                    this.i++;
                    break;
                }
                default: {
                    this.incomplete = '';
                    this.incompleteStart = this.i;
                    this.state = ParseState.Command;
                    break;
                }
                }
                break;
            }

            default: {
                return this.asError(this.intl.formatMessage({
                    id: 'apps.error.parser.unexpected_state',
                    defaultMessage: 'Unreachable: Unexpected state in matchBinding: `{state}`.',
                }, {
                    state: this.state,
                }));
            }
            }
        }

        if (!this.binding) {
            if (autocompleteMode) {
                return this;
            }

            return this.asError(this.intl.formatMessage({
                id: 'apps.error.parser.no_match',
                defaultMessage: '`{command}`: No matching command found in this workspace.',
            }, {
                command: this.command,
            }));
        }

        if (!autocompleteMode && this.binding.bindings?.length) {
            return this.asError(this.intl.formatMessage({
                id: 'apps.error.parser.execute_non_leaf',
                defaultMessage: 'You must select a subcommand.',
            }));
        }

        if (!this.binding.bindings?.length) {
            // No more sub-bindings, must be a submit or a form.
            if (this.binding.submit && !this.binding.form) {
                // Submit, no form in the binding, construct an empty form for
                // submission.
                this.resolvedForm = {
                    submit: this.binding.submit,
                };
            } else if (this.binding.form && !this.binding.submit) {
                // Form, no submit in the binding. Refresh the form from the
                // source/cache as needed.
                const form = this.binding.form;
                if (!form.submit) {
                    const fetched = await this.formsCache.getSubmittableForm(this.location, this.binding);
                    if (fetched?.error) {
                        return this.asError(fetched.error);
                    }
                    this.resolvedForm = fetched?.form;
                }
                this.resolvedForm = this.binding?.form;
            } else {
                return this.asError(this.intl.formatMessage({
                    id: 'apps.error.parser',
                    defaultMessage: 'Parsing error: {error}',
                }, {
                    error: 'unreachable: invalid binding, neither or both Submit and Form',
                }));
            }
        }
        return this;
    };

    // parseForm parses the rest of the command using the previously matched form.
    public parseForm = (autocompleteMode = false): ParsedCommand => {
        if (this.state === ParseState.Error || !this.resolvedForm) {
            return this;
        }

        let fields: AppField[] = [];
        if (this.resolvedForm.fields) {
            fields = this.resolvedForm.fields;
        }

        fields = fields.filter((f) => f.type !== AppFieldTypes.MARKDOWN && !f.readonly);
        this.state = ParseState.StartParameter;
        this.i = this.incompleteStart || 0;
        let flagEqualsUsed = false;
        let escaped = false;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let c = '';
            if (this.i < this.command.length) {
                c = this.command[this.i];
            }

            switch (this.state) {
            case ParseState.StartParameter: {
                switch (c) {
                case '':
                    return this;
                case '-': {
                    // Named parameter (aka Flag). Flag1 consumes the optional second '-'.
                    this.state = ParseState.Flag1;
                    this.i++;
                    break;
                }
                case '—': {
                    // Em dash, introduced when two '-' are set in iOS. Will be considered as such.
                    this.state = ParseState.Flag;
                    this.i++;
                    this.incomplete = '';
                    this.incompleteStart = this.i;
                    flagEqualsUsed = false;
                    break;
                }
                default: {
                    // Positional parameter.
                    this.position++;
                    let field = fields.find((f: AppField) => f.position === this.position);
                    if (!field) {
                        field = fields.find((f) => f.position === -1 && f.type === AppFieldTypes.TEXT);
                        if (!field || this.values[field.name]) {
                            return this.asError(this.intl.formatMessage({
                                id: 'apps.error.parser.no_argument_pos_x',
                                defaultMessage: 'Unable to identify argument.',
                            }));
                        }
                        this.incompleteStart = this.i;
                        this.incomplete = '';
                        this.field = field;
                        this.state = ParseState.Rest;
                        break;
                    }
                    this.field = field;
                    this.state = ParseState.StartValue;
                    break;
                }
                }
                break;
            }

            case ParseState.Rest: {
                if (!this.field) {
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.missing_field_value',
                        defaultMessage: 'Field value is missing.',
                    }));
                }

                if (autocompleteMode && c === '') {
                    return this;
                }

                if (c === '') {
                    this.values[this.field.name] = this.incomplete;
                    return this;
                }

                this.i++;
                this.incomplete += c;
                break;
            }

            case ParseState.ParameterSeparator: {
                this.incompleteStart = this.i;
                switch (c) {
                case '':
                    this.state = ParseState.StartParameter;
                    return this;
                case ' ':
                case '\t': {
                    this.i++;
                    break;
                }
                default:
                    this.state = ParseState.StartParameter;
                    break;
                }
                break;
            }

            case ParseState.Flag1: {
                // consume the optional second '-'
                if (c === '-') {
                    this.i++;
                }
                this.state = ParseState.Flag;
                this.incomplete = '';
                this.incompleteStart = this.i;
                flagEqualsUsed = false;
                break;
            }

            case ParseState.Flag: {
                if (c === '' && autocompleteMode) {
                    return this;
                }

                switch (c) {
                case '':
                case ' ':
                case '\t':
                case '=': {
                    const field = fields.find((f) => f.label?.toLowerCase() === this.incomplete.toLowerCase());
                    if (!field) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.unexpected_flag',
                            defaultMessage: 'Command does not accept flag `{flagName}`.',
                        }, {
                            flagName: this.incomplete,
                        }));
                    }
                    this.state = ParseState.FlagValueSeparator;
                    this.field = field;
                    this.incomplete = '';
                    break;
                }
                default: {
                    this.incomplete += c;
                    this.i++;
                    break;
                }
                }
                break;
            }

            case ParseState.FlagValueSeparator: {
                this.incompleteStart = this.i;
                switch (c) {
                case '': {
                    if (autocompleteMode) {
                        return this;
                    }
                    this.state = ParseState.StartValue;
                    break;
                }
                case ' ':
                case '\t': {
                    this.i++;
                    break;
                }
                case '=': {
                    if (flagEqualsUsed) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.multiple_equal',
                            defaultMessage: 'Multiple `=` signs are not allowed.',
                        }));
                    }
                    flagEqualsUsed = true;
                    this.i++;
                    break;
                }
                default: {
                    this.state = ParseState.StartValue;
                }
                }
                break;
            }

            case ParseState.StartValue: {
                this.incomplete = '';
                this.incompleteStart = this.i;
                switch (c) {
                case '"': {
                    this.state = ParseState.QuotedValue;
                    this.i++;
                    break;
                }
                case '`': {
                    this.state = ParseState.TickValue;
                    this.i++;
                    break;
                }
                case ' ':
                case '\t':
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.unexpected_whitespace',
                        defaultMessage: 'Unreachable: Unexpected whitespace.',
                    }));
                case '[':
                    if (!this.field?.multiselect) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.unexpected_squared_bracket',
                            defaultMessage: 'Unexpected list opening.',
                        }));
                    }
                    this.state = ParseState.MultiselectStart;
                    this.i++;
                    break;
                default: {
                    this.state = ParseState.NonspaceValue;
                    break;
                }
                }
                break;
            }

            case ParseState.NonspaceValue: {
                switch (c) {
                case '':
                case ' ':
                case '\t': {
                    this.state = ParseState.EndValue;
                    break;
                }
                default: {
                    this.incomplete += c;
                    this.i++;
                    break;
                }
                }
                break;
            }

            case ParseState.QuotedValue: {
                switch (c) {
                case '': {
                    if (!autocompleteMode) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_quote',
                            defaultMessage: 'Matching double quote expected before end of input.',
                        }));
                    }
                    return this;
                }
                case '"': {
                    if (this.incompleteStart === this.i - 1) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.empty_value',
                            defaultMessage: 'Empty values are not allowed',
                        }));
                    }
                    this.i++;
                    this.state = ParseState.EndQuotedValue;
                    break;
                }
                case '\\': {
                    escaped = true;
                    this.i++;
                    break;
                }
                default: {
                    this.incomplete += c;
                    this.i++;
                    if (escaped) {
                        //TODO: handle \n, \t, other escaped chars
                        escaped = false;
                    }
                    break;
                }
                }
                break;
            }

            case ParseState.TickValue: {
                switch (c) {
                case '': {
                    if (!autocompleteMode) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_tick',
                            defaultMessage: 'Matching tick quote expected before end of input.',
                        }));
                    }
                    return this;
                }
                case '`': {
                    if (this.incompleteStart === this.i - 1) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.empty_value',
                            defaultMessage: 'Empty values are not allowed',
                        }));
                    }
                    this.i++;
                    this.state = ParseState.EndTickedValue;
                    break;
                }
                default: {
                    this.incomplete += c;
                    this.i++;
                    break;
                }
                }
                break;
            }

            case ParseState.EndTickedValue:
            case ParseState.EndQuotedValue:
            case ParseState.EndValue: {
                if (!this.field) {
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.missing_field_value',
                        defaultMessage: 'Field value is missing.',
                    }));
                }

                // special handling for optional BOOL values ('--boolflag true'
                // vs '--boolflag next-positional' vs '--boolflag
                // --next-flag...')
                if (this.field.type === AppFieldTypes.BOOL &&
                    ((autocompleteMode && !'true'.startsWith(this.incomplete) && !'false'.startsWith(this.incomplete)) ||
                    (!autocompleteMode && this.incomplete !== 'true' && this.incomplete !== 'false'))) {
                    // reset back where the value started, and treat as a new parameter
                    this.i = this.incompleteStart;
                    this.values[this.field.name] = 'true';
                    this.state = ParseState.StartParameter;
                } else {
                    if (autocompleteMode && c === '') {
                        return this;
                    }
                    this.values[this.field.name] = this.incomplete;
                    this.incomplete = '';
                    this.incompleteStart = this.i;
                    if (c === '') {
                        return this;
                    }
                    this.state = ParseState.ParameterSeparator;
                }
                break;
            }

            case ParseState.MultiselectStart:
                if (!this.field) {
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.missing_field_value',
                        defaultMessage: 'Field value is missing.',
                    }));
                }

                this.values![this.field.name] = [];
                switch (c) {
                case ' ':
                case '\t':
                    this.i++;
                    break;
                case ']':
                    this.i++;
                    this.state = ParseState.ParameterSeparator;
                    break;
                default:
                    this.state = ParseState.MultiselectStartValue;
                    break;
                }
                break;

            case ParseState.MultiselectStartValue:
                this.incomplete = '';
                this.incompleteStart = this.i;
                switch (c) {
                case '':
                    if (!autocompleteMode) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_list_end',
                            defaultMessage: 'Expected list closing token.',
                        }));
                    }
                    return this;
                case '"': {
                    this.state = ParseState.MultiselectQuotedValue;
                    this.i++;
                    break;
                }
                case '`': {
                    this.state = ParseState.MultiselectTickValue;
                    this.i++;
                    break;
                }
                case ' ':
                case '\t':
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.unexpected_whitespace',
                        defaultMessage: 'Unreachable: Unexpected whitespace.',
                    }));
                case ',':
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.unexpected_comma',
                        defaultMessage: 'Unexpected comma.',
                    }));
                default: {
                    this.state = ParseState.MultiselectNonspaceValue;
                    break;
                }
                }
                break;

            case ParseState.MultiselectNonspaceValue: {
                switch (c) {
                case '':
                case ' ':
                case '\t':
                case ',':
                case ']': {
                    this.state = ParseState.MultiselectEndValue;
                    break;
                }
                default: {
                    this.incomplete += c;
                    this.i++;
                    break;
                }
                }
                break;
            }

            case ParseState.MultiselectQuotedValue: {
                switch (c) {
                case '': {
                    if (!autocompleteMode) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_quote',
                            defaultMessage: 'Matching double quote expected before end of input.',
                        }));
                    }
                    return this;
                }
                case '"': {
                    if (this.incompleteStart === this.i - 1) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.empty_value',
                            defaultMessage: 'Empty values are not allowed',
                        }));
                    }
                    this.i++;
                    this.state = ParseState.MultiselectEndQuotedValue;
                    break;
                }
                case '\\': {
                    escaped = true;
                    this.i++;
                    break;
                }
                default: {
                    this.incomplete += c;
                    this.i++;
                    if (escaped) {
                        //TODO: handle \n, \t, other escaped chars
                        escaped = false;
                    }
                    break;
                }
                }
                break;
            }

            case ParseState.MultiselectTickValue: {
                switch (c) {
                case '': {
                    if (!autocompleteMode) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_tick',
                            defaultMessage: 'Matching tick quote expected before end of input.',
                        }));
                    }
                    return this;
                }
                case '`': {
                    if (this.incompleteStart === this.i - 1) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.empty_value',
                            defaultMessage: 'Empty values are not allowed',
                        }));
                    }
                    this.i++;
                    this.state = ParseState.MultiselectEndTickedValue;
                    break;
                }
                default: {
                    this.incomplete += c;
                    this.i++;
                    break;
                }
                }
                break;
            }

            case ParseState.MultiselectEndTickedValue:
            case ParseState.MultiselectEndQuotedValue:
            case ParseState.MultiselectEndValue: {
                if (!this.field) {
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.missing_field_value',
                        defaultMessage: 'Field value is missing.',
                    }));
                }

                if (autocompleteMode && c === '') {
                    return this;
                }
                (this.values![this.field.name] as string[]).push(this.incomplete);
                this.incomplete = '';
                this.incompleteStart = this.i;
                if (c === '') {
                    return this;
                }
                this.state = ParseState.MultiselectValueSeparator;
                break;
            }

            case ParseState.MultiselectValueSeparator:
                switch (c) {
                case '':
                    if (!autocompleteMode) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_list_end',
                            defaultMessage: 'Expected list closing token.',
                        }));
                    }
                    return this;
                case ']':
                    this.i++;
                    this.state = ParseState.ParameterSeparator;
                    break;
                case ' ':
                case '\t':
                    this.i++;
                    break;
                case ',':
                    this.i++;
                    this.state = ParseState.MultiselectNextValue;
                    break;
                default:
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.unexpected_character',
                        defaultMessage: 'Unexpected character.',
                    }));
                }
                break;
            case ParseState.MultiselectNextValue:
                switch (c) {
                case ' ':
                case '\t':
                    this.i++;
                    break;
                default:
                    this.state = ParseState.MultiselectStartValue;
                }
                break;
            default:
                return this.asError(this.intl.formatMessage({
                    id: 'apps.error.parser.unexpected_state',
                    defaultMessage: 'Unreachable: Unexpected state in matchBinding: `{state}`.',
                }, {
                    state: this.state,
                }));
            }
        }
    };
}

export class AppCommandParser {
    private store: Store;
    private channelID: string;
    private teamID: string;
    private rootPostID?: string;
    private intl: Intl;

    constructor(store: Store|null, intl: Intl, channelID: string, teamID = '', rootPostID = '') {
        this.store = store || getStore();
        this.channelID = channelID;
        this.rootPostID = rootPostID;
        this.teamID = teamID;
        this.intl = intl;
    }

    // composeCommandSubmitCall creates the form submission call
    public composeCommandSubmitCall = async (command: string): Promise<{creq: AppCallRequest | null; errorMessage?: string}> => {
        let parsed = new ParsedCommand(command, this, this.intl);

        const commandBindings = this.getCommandBindings();
        if (!commandBindings) {
            return {creq: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.no_bindings',
                    defaultMessage: 'No command bindings.',
                })};
        }

        parsed = await parsed.matchBinding(commandBindings, false);
        parsed = parsed.parseForm(false);
        if (parsed.state === ParseState.Error) {
            return {creq: null, errorMessage: parserErrorMessage(this.intl, parsed.error, parsed.command, parsed.i)};
        }

        await this.addDefaultAndReadOnlyValues(parsed);

        const missing = this.getMissingFields(parsed);
        if (missing.length > 0) {
            const missingStr = missing.map((f) => f.label).join(', ');
            return {creq: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.command.field_missing',
                    defaultMessage: 'Required fields missing: `{fieldName}`.',
                }, {
                    fieldName: missingStr,
                })};
        }

        const {creq, errorMessage} = await this.composeCallRequest(parsed, parsed.resolvedForm?.submit);
        if (errorMessage) {
            return {creq: null, errorMessage};
        }

        return {creq};
    };

    public composeFormFromCommand = async (command: string): Promise<{form: AppForm | null; context: AppContext | null; errorMessage?: string}> => {
        let parsed = new ParsedCommand(command, this, this.intl);

        const commandBindings = this.getCommandBindings();
        if (!commandBindings) {
            return {
                form: null,
                context: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.no_bindings',
                    defaultMessage: 'No command bindings.',
                })};
        }

        parsed = await parsed.matchBinding(commandBindings, false);
        parsed = parsed.parseForm(false);

        const form = JSON.parse(JSON.stringify(parsed.resolvedForm));
        if (!form) {
            return {
                form: null,
                context: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.no_form',
                    defaultMessage: 'No form found.',
                }),
            };
        }

        const values: AppCallValues = parsed.values;
        await this.expandOptions(parsed, values);

        for (const field of form.fields || []) {
            if (values[field.name]) {
                field.value = values[field.name];
            }
        }

        if (!form.title) {
            form.title = parsed.binding?.location;
        }

        const context = this.getAppContext(parsed.binding!);
        return {form, context};
    };

    private async addDefaultAndReadOnlyValues(parsed: ParsedCommand) {
        if (!parsed.resolvedForm?.fields) {
            return;
        }

        await Promise.all(parsed.resolvedForm?.fields.map(async (f) => {
            if (!f.value) {
                return;
            }

            if (f.readonly || !(f.name in parsed.values)) {
                switch (f.type) {
                case AppFieldTypes.TEXT:
                    parsed.values[f.name] = f.value as string;
                    break;
                case AppFieldTypes.BOOL:
                    parsed.values[f.name] = 'true';
                    break;
                case AppFieldTypes.USER: {
                    const userID = (f.value as AppSelectOption).value;
                    let user = selectUser(this.store.getState(), userID);
                    if (!user) {
                        const dispatchResult = await this.store.dispatch(getUser(userID));
                        if ('error' in dispatchResult) {
                            // Silently fail on default value
                            break;
                        }
                        user = dispatchResult.data!;
                    }
                    parsed.values[f.name] = user.username;
                    break;
                }
                case AppFieldTypes.CHANNEL: {
                    const channelID = (f.value as AppSelectOption).label;
                    let channel = selectChannel(this.store.getState(), channelID);
                    if (!channel) {
                        const dispatchResult = await this.store.dispatch(getChannel(channelID));
                        if ('error' in dispatchResult) {
                            // Silently fail on default value
                            break;
                        }
                        channel = dispatchResult.data!;
                    }
                    parsed.values[f.name] = channel.name;
                    break;
                }
                case AppFieldTypes.STATIC_SELECT:
                case AppFieldTypes.DYNAMIC_SELECT:
                    parsed.values[f.name] = (f.value as AppSelectOption).value;
                    break;
                case AppFieldTypes.MARKDOWN:

                    // Do nothing
                }
            }
        }) || []);
    }

    // getSuggestionsBase is a synchronous function that returns results for base commands
    public getSuggestionsBase = (pretext: string): AutocompleteSuggestion[] => {
        const command = pretext.toLowerCase();
        const result: AutocompleteSuggestion[] = [];

        const bindings = this.getCommandBindings();

        for (const binding of bindings) {
            let base = binding.label;
            if (!base) {
                continue;
            }

            if (base[0] !== '/') {
                base = '/' + base;
            }

            if (base.startsWith(command)) {
                result.push({
                    Complete: binding.label,
                    Suggestion: base,
                    Description: binding.description || '',
                    Hint: binding.hint || '',
                    IconData: binding.icon || '',
                    type: Constants.Integrations.COMMAND,
                });
            }
        }

        return result;
    };

    // getSuggestions returns suggestions for subcommands and/or form arguments
    public getSuggestions = async (pretext: string): Promise<ExtendedAutocompleteSuggestion[]> => {
        let parsed = new ParsedCommand(pretext, this, this.intl);
        let suggestions: ExtendedAutocompleteSuggestion[] = [];

        const commandBindings = this.getCommandBindings();
        if (!commandBindings) {
            return [];
        }

        parsed = await parsed.matchBinding(commandBindings, true);
        if (parsed.state === ParseState.Error) {
            suggestions = this.getErrorSuggestion(parsed);
        }

        if (parsed.state === ParseState.Command) {
            suggestions = this.getCommandSuggestions(parsed);
        }

        if (parsed.resolvedForm || parsed.incomplete) {
            parsed = parsed.parseForm(true);
            if (parsed.state === ParseState.Error) {
                suggestions = this.getErrorSuggestion(parsed);
            }
            const argSuggestions = await this.getParameterSuggestions(parsed);
            suggestions = suggestions.concat(argSuggestions);
        }

        // Add "Execute Current Command" suggestion
        // TODO get full text from SuggestionBox
        const executableStates: string[] = [
            ParseState.EndCommand,
            ParseState.CommandSeparator,
            ParseState.StartParameter,
            ParseState.ParameterSeparator,
            ParseState.EndValue,
            ParseState.Rest,
        ];

        const modalStates: string[] = [
            ParseState.StartParameter,
            ParseState.Error,
            ParseState.TickValue,
            ParseState.QuotedValue,
            ParseState.EndValue,
            ParseState.Rest,
            ParseState.Flag,
            ParseState.FlagValueSeparator,
        ];
        const call = parsed.resolvedForm?.submit || parsed.binding?.form?.submit;
        const hasRequired = this.getMissingFields(parsed).length === 0;
        const hasValue = (parsed.state !== ParseState.EndValue || (parsed.field && parsed.values[parsed.field.name] !== undefined));

        if (executableStates.includes(parsed.state) && call && hasRequired && hasValue) {
            const execute = getExecuteSuggestion(parsed);
            if (execute) {
                suggestions = [execute, ...suggestions];
            }
        } else if (suggestions.length === 0 && (parsed.field?.type !== AppFieldTypes.USER && parsed.field?.type !== AppFieldTypes.CHANNEL)) {
            suggestions = this.getNoMatchingSuggestion();
        }

        if (modalStates.includes(parsed.state) && call && parsed.resolvedForm?.fields?.length) {
            const open = getOpenInModalSuggestion(parsed);
            if (open) {
                suggestions = [...suggestions, open];
            }
        }

        return suggestions.map((suggestion) => this.decorateSuggestionComplete(parsed, suggestion));
    };

    getNoMatchingSuggestion = () => {
        return [{
            Complete: '',
            Suggestion: '',
            Hint: this.intl.formatMessage({
                id: 'apps.suggestion.no_suggestion',
                defaultMessage: 'No matching suggestions.',
            }),
            IconData: COMMAND_SUGGESTION_ERROR,
            Description: '',
        }];
    };

    getErrorSuggestion = (parsed: ParsedCommand) => {
        return [{
            Complete: '',
            Suggestion: '',
            Hint: this.intl.formatMessage({
                id: 'apps.suggestion.errors.parser_error',
                defaultMessage: 'Parsing error',
            }),
            IconData: COMMAND_SUGGESTION_ERROR,
            Description: parsed.error,
        }];
    };

    // composeCallRequest creates the form submission call
    private composeCallRequest = async (parsed: ParsedCommand, call: AppCall | undefined): Promise<{creq: AppCallRequest | null; errorMessage?: string}> => {
        if (!parsed.binding) {
            return {creq: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.missing_binding',
                    defaultMessage: 'Missing command bindings.',
                })};
        }
        if (!call) {
            return {creq: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.missing_submit',
                    defaultMessage: 'No submit call in binding or form.',
                })};
        }

        const values: AppCallValues = parsed.values;
        const {errorMessage} = await this.expandOptions(parsed, values);
        if (errorMessage) {
            return {creq: null, errorMessage};
        }

        const context = this.getAppContext(parsed.binding);
        return {creq: createCallRequest(call, context, {}, values, parsed.command)};
    };

    private expandOptions = async (parsed: ParsedCommand, values: AppCallValues): Promise<{errorMessage?: string}> => {
        if (!parsed.resolvedForm?.fields) {
            return {};
        }

        const errors: {[key: string]: string} = {};
        await Promise.all(parsed.resolvedForm.fields.map(async (f) => {
            if (!values[f.name]) {
                return;
            }
            switch (f.type) {
            case AppFieldTypes.DYNAMIC_SELECT:
                if (f.multiselect && Array.isArray(values[f.name])) {
                    const options: AppSelectOption[] = [];
                    const commandValues = values[f.name] as string[];
                    for (const value of commandValues) {
                        if (options.find((o) => o.value === value)) {
                            errors[f.name] = this.intl.formatMessage({
                                id: 'apps.error.command.same_option',
                                defaultMessage: 'Option repeated for field `{fieldName}`: `{option}`.',
                            }, {
                                fieldName: f.name,
                                option: value,
                            });
                        }
                    }
                    values[f.name] = options;
                    break;
                }

                values[f.name] = {label: values[f.name], value: values[f.name]};
                break;
            case AppFieldTypes.STATIC_SELECT: {
                const getOption = (value: string) => {
                    return f.options?.find((o) => (o.value === value));
                };

                const setOptionError = (value: string) => {
                    errors[f.name] = this.intl.formatMessage({
                        id: 'apps.error.command.unknown_option',
                        defaultMessage: 'Unknown option for field `{fieldName}`: `{option}`.',
                    }, {
                        fieldName: f.name,
                        option: value,
                    });
                    values[f.name] = undefined;
                };

                if (f.multiselect && Array.isArray(values[f.name])) {
                    const options: AppSelectOption[] = [];
                    const commandValues = values[f.name] as string[];
                    for (const value of commandValues) {
                        const option = getOption(value);
                        if (!option) {
                            setOptionError(value);
                            return;
                        }
                        if (options.find((o) => o.value === option.value)) {
                            errors[f.name] = this.intl.formatMessage({
                                id: 'apps.error.command.same_option',
                                defaultMessage: 'Option repeated for field `{fieldName}`: `{option}`.',
                            }, {
                                fieldName: f.name,
                                option: value,
                            });
                        }
                        options.push(option);
                    }
                    values[f.name] = options;
                    break;
                }

                const option = getOption(values[f.name]);
                if (!option) {
                    setOptionError(values[f.name]);
                    return;
                }
                values[f.name] = option;
                break;
            }
            case AppFieldTypes.USER: {
                const getUser = async (userName: string) => {
                    let user = selectUserByUsername(this.store.getState(), userName);
                    if (!user) {
                        const dispatchResult = await this.store.dispatch(getUserByUsername(userName) as any);
                        if ('error' in dispatchResult) {
                            return null;
                        }
                        user = dispatchResult.data;
                    }
                    return user;
                };

                const setUserError = (username: string) => {
                    errors[f.name] = this.intl.formatMessage({
                        id: 'apps.error.command.unknown_user',
                        defaultMessage: 'Unknown user for field `{fieldName}`: `{option}`.',
                    }, {
                        fieldName: f.name,
                        option: username,
                    });
                };

                if (f.multiselect && Array.isArray(values[f.name])) {
                    const options: AppSelectOption[] = [];
                    const commandValues = values[f.name] as string[];
                    /* eslint-disable no-await-in-loop */
                    for (const value of commandValues) {
                        let userName = value;
                        if (userName[0] === '@') {
                            userName = userName.substr(1);
                        }
                        const user = await getUser(userName);
                        if (!user) {
                            setUserError(userName);
                            return;
                        }

                        if (options.find((o) => o.value === user?.id)) {
                            errors[f.name] = this.intl.formatMessage({
                                id: 'apps.error.command.same_user',
                                defaultMessage: 'User repeated for field `{fieldName}`: `{option}`.',
                            }, {
                                fieldName: f.name,
                                option: userName,
                            });
                        }
                        options.push({label: user.username, value: user.id});
                    }
                    /* eslint-enable no-await-in-loop */
                    values[f.name] = options;
                    break;
                }

                let userName = values[f.name] as string;
                if (userName[0] === '@') {
                    userName = userName.substr(1);
                }
                const user = await getUser(userName);
                if (!user) {
                    setUserError(userName);
                    return;
                }
                values[f.name] = {label: user.username, value: user.id};
                break;
            }
            case AppFieldTypes.CHANNEL: {
                const getChannel = async (channelName: string) => {
                    let channel = selectChannelByName(this.store.getState(), channelName);
                    if (!channel) {
                        const team = getCurrentTeam(this.store.getState());
                        if (!team) {
                            return null;
                        }
                        const dispatchResult = await this.store.dispatch(getChannelByNameAndTeamName(team.name, channelName) as any);
                        if ('error' in dispatchResult) {
                            return null;
                        }
                        channel = dispatchResult.data;
                    }
                    return channel;
                };

                const setChannelError = (channelName: string) => {
                    errors[f.name] = this.intl.formatMessage({
                        id: 'apps.error.command.unknown_channel',
                        defaultMessage: 'Unknown channel for field `{fieldName}`: `{option}`.',
                    }, {
                        fieldName: f.name,
                        option: channelName,
                    });
                };

                if (f.multiselect && Array.isArray(values[f.name])) {
                    const options: AppSelectOption[] = [];
                    const commandValues = values[f.name] as string[];
                    /* eslint-disable no-await-in-loop */
                    for (const value of commandValues) {
                        let channelName = value;
                        if (channelName[0] === '~') {
                            channelName = channelName.substr(1);
                        }
                        const channel = await getChannel(channelName);
                        if (!channel) {
                            setChannelError(channelName);
                            return;
                        }

                        if (options.find((o) => o.value === channel?.id)) {
                            errors[f.name] = this.intl.formatMessage({
                                id: 'apps.error.command.same_channel',
                                defaultMessage: 'Channel repeated for field `{fieldName}`: `{option}`.',
                            }, {
                                fieldName: f.name,
                                option: channelName,
                            });
                        }

                        options.push({label: channel?.display_name, value: channel?.id});
                    }
                    /* eslint-enable no-await-in-loop */
                    values[f.name] = options;
                    break;
                }

                let channelName = values[f.name] as string;
                if (channelName[0] === '~') {
                    channelName = channelName.substr(1);
                }
                const channel = await getChannel(channelName);
                if (!channel) {
                    setChannelError(channelName);
                    return;
                }
                values[f.name] = {label: channel?.display_name, value: channel?.id};
                break;
            }
            case AppFieldTypes.BOOL: {
                const strValue = values[f.name] as string;
                if (strValue.toLowerCase() === 'true') {
                    values[f.name] = true;
                } else {
                    values[f.name] = false;
                }
            }
            }
        }));

        if (Object.keys(errors).length === 0) {
            return {};
        }

        let errorMessage = '';
        Object.keys(errors).forEach((v) => {
            errorMessage = errorMessage + errors[v] + '\n';
        });
        return {errorMessage};
    };

    // decorateSuggestionComplete applies the necessary modifications for a suggestion to be processed
    private decorateSuggestionComplete = (parsed: ParsedCommand, choice: AutocompleteSuggestion): AutocompleteSuggestion => {
        if (choice.Complete && (
            choice.Complete.endsWith(EXECUTE_CURRENT_COMMAND_ITEM_ID) ||
            choice.Complete.endsWith(OPEN_COMMAND_IN_MODAL_ITEM_ID))) {
            return choice as AutocompleteSuggestion;
        }

        let goBackSpace = 0;
        if (choice.Complete === '') {
            goBackSpace = 1;
        }
        let complete = parsed.command.substring(0, parsed.incompleteStart - goBackSpace);
        complete += choice.Complete === undefined ? choice.Suggestion : choice.Complete;
        choice.Hint = choice.Hint || '';
        complete = complete.substring(1);

        return {
            ...choice,
            Complete: complete,
        };
    };

    // getCommandBindings returns the commands in the redux store.
    // They are grouped by app id since each app has one base command
    private getCommandBindings = (): AppBinding[] => {
        const state = this.store.getState();
        if (this.rootPostID) {
            return getRHSCommandBindings(state);
        }
        return getCommandBindings(state);
    };

    // getChannel gets the channel in which the user is typing the command
    private getChannel = (): Channel | undefined => {
        const state = this.store.getState();
        return selectChannel(state, this.channelID);
    };

    public setChannelContext = (channelID: string, teamID = '', rootPostID?: string) => {
        this.channelID = channelID;
        this.rootPostID = rootPostID;
        this.teamID = teamID;
    };

    // isAppCommand determines if subcommand/form suggestions need to be returned.
    // When this returns true, the caller knows that the parser should handle all suggestions for the current command string.
    // When it returns false, the caller should call getSuggestionsBase() to check if there are any base commands that match the command string.
    public isAppCommand = (pretext: string): boolean => {
        const command = pretext.toLowerCase();
        for (const binding of this.getCommandBindings()) {
            let base = binding.label;
            if (!base) {
                continue;
            }

            if (base[0] !== '/') {
                base = '/' + base;
            }

            if (command.startsWith(base + ' ')) {
                return true;
            }
        }
        return false;
    };

    // getAppContext collects post/channel/team info for performing calls
    private getAppContext = (binding: AppBinding): AppContext => {
        const context: AppContext = {
            app_id: binding.app_id,
            location: binding.location,
            root_id: this.rootPostID,
        };

        const channel = this.getChannel();
        if (!channel) {
            return context;
        }

        context.channel_id = channel.id;
        context.team_id = channel.team_id || getCurrentTeamId(this.store.getState());

        return context;
    };

    // fetchSubmittableForm unconditionaly retrieves the form for the given binding (subcommand)
    private fetchSubmittableForm = async (source: AppCall, context: AppContext): Promise<{form?: AppForm; error?: string} | undefined> => {
        const payload = createCallRequest(source, context);
        const res = await this.store.dispatch(doAppFetchForm(payload, this.intl)) as DoAppCallResult;
        if (res.error) {
            const errorResponse = res.error;
            return {error: errorResponse.text || this.intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error occurred.',
            })};
        }

        const callResponse = res.data!;
        switch (callResponse.type) {
        case AppCallResponseTypes.FORM:
            break;
        case AppCallResponseTypes.NAVIGATE:
        case AppCallResponseTypes.OK:
            return {error: this.intl.formatMessage({
                id: 'apps.error.responses.unexpected_type',
                defaultMessage: 'App response type was not expected. Response type: {type}',
            }, {
                type: callResponse.type,
            })};
        default:
            return {error: this.intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResponse.type,
            })};
        }

        if (!callResponse.form?.submit) {
            return {error: this.intl.formatMessage({
                id: 'apps.error.parser.missing_submit',
                defaultMessage: 'No submit call in binding or form.',
            })};
        }

        return {form: callResponse.form};
    };

    public getSubmittableForm = async (location: string, binding: AppBinding): Promise<{form?: AppForm; error?: string} | undefined> => {
        const rootID = this.rootPostID || '';
        const key = `${this.channelID}-${rootID}-${location}`;
        const submittableForm = this.rootPostID ? getAppRHSCommandForm(this.store.getState(), key) : getAppCommandForm(this.store.getState(), key);
        if (submittableForm) {
            return {form: submittableForm};
        }

        if (!binding.form?.source) {
            return {error: this.intl.formatMessage({
                id: 'apps.error.parser.missing_source',
                defaultMessage: 'Form has neither submit nor source.',
            })};
        }
        const context = this.getAppContext(binding);
        const fetched = await this.fetchSubmittableForm(binding.form.source, context);
        if (fetched?.form) {
            let actionType: string = AppsTypes.RECEIVED_APP_COMMAND_FORM;
            if (this.rootPostID) {
                actionType = AppsTypes.RECEIVED_APP_RHS_COMMAND_FORM;
            }
            this.store.dispatch({
                data: {form: fetched.form, location: key},
                type: actionType,
            });
        }
        return fetched;
    };

    // getSuggestionsForSubCommands returns suggestions for a subcommand's name
    private getCommandSuggestions = (parsed: ParsedCommand): AutocompleteSuggestion[] => {
        if (!parsed.binding?.bindings?.length) {
            return [];
        }
        const bindings = parsed.binding.bindings;
        const result: AutocompleteSuggestion[] = [];

        bindings.forEach((b) => {
            if (b.label.toLowerCase().startsWith(parsed.incomplete.toLowerCase())) {
                result.push({
                    Complete: b.label,
                    Suggestion: b.label,
                    Description: b.description || '',
                    Hint: b.hint || '',
                    IconData: b.icon || '',
                    type: Constants.Integrations.COMMAND,
                });
            }
        });

        return result;
    };

    // getParameterSuggestions computes suggestions for positional argument values, flag names, and flag argument values
    private getParameterSuggestions = async (parsed: ParsedCommand): Promise<ExtendedAutocompleteSuggestion[]> => {
        switch (parsed.state) {
        case ParseState.StartParameter: {
            // see if there's a matching positional field
            const positional = parsed.resolvedForm?.fields?.find((f: AppField) => f.position === parsed.position + 1);
            if (positional) {
                parsed.field = positional;
                return this.getValueSuggestions(parsed);
            }
            return this.getFlagNameSuggestions(parsed);
        }

        case ParseState.Flag:
            return this.getFlagNameSuggestions(parsed);

        case ParseState.FlagValueSeparator: {
            const suggestions = await this.getValueSuggestions(parsed);
            if (parsed.field?.multiselect) {
                suggestions.unshift({
                    Complete: '[',
                    Suggestion: '[',
                    Description: 'Start building a list',
                    Hint: '',
                    IconData: '',
                });
            }
            return suggestions;
        }
        case ParseState.EndValue:
        case ParseState.NonspaceValue:
        case ParseState.MultiselectNextValue:
        case ParseState.MultiselectStart:
        case ParseState.MultiselectNonspaceValue:
        case ParseState.MultiselectEndValue:
        case ParseState.MultiselectStartValue:
            return this.getValueSuggestions(parsed);
        case ParseState.EndQuotedValue:
        case ParseState.QuotedValue:
        case ParseState.MultiselectQuotedValue:
            return this.getValueSuggestions(parsed, '"');
        case ParseState.EndTickedValue:
        case ParseState.TickValue:
        case ParseState.MultiselectTickValue:
            return this.getValueSuggestions(parsed, '`');
        case ParseState.MultiselectValueSeparator:
            return this.getMultiselectValueSeparatorSuggestion();
        case ParseState.Rest: {
            return this.getValueSuggestions(parsed);
        }
        }
        return [];
    };

    private getMultiselectValueSeparatorSuggestion = (): AutocompleteSuggestion[] => {
        return [
            {
                Complete: ',',
                Suggestion: ',',
                Description: 'Add new element',
                Hint: '',
                IconData: '',
            },
            {
                Complete: ']',
                Suggestion: ']',
                Description: 'End list',
                Hint: '',
                IconData: '',
            },
        ];
    };

    // getMissingFields collects the required fields that were not supplied in a submission
    private getMissingFields = (parsed: ParsedCommand): AppField[] => {
        const form = parsed.resolvedForm;
        if (!form) {
            return [];
        }

        const missing: AppField[] = [];

        const values = parsed.values || [];
        const fields = form.fields || [];
        for (const field of fields) {
            if (field.is_required && !values[field.name]) {
                missing.push(field);
            }
        }

        return missing;
    };

    // getFlagNameSuggestions returns suggestions for flag names
    private getFlagNameSuggestions = (parsed: ParsedCommand): AutocompleteSuggestion[] => {
        if (!parsed.resolvedForm?.fields?.length) {
            return [];
        }

        // There have been 0 to 2 dashes in the command prior to this call, adjust.
        const prevCharIndex = parsed.incompleteStart - 1;
        let prefix = '--';
        for (let i = prevCharIndex; i > 0 && i >= parsed.incompleteStart - 2 && parsed.command[i] === '-'; i--) {
            prefix = prefix.substring(1);
        }
        if (prevCharIndex > 0 && parsed.command[prevCharIndex] === '—') {
            prefix = '';
        }

        const applicable = parsed.resolvedForm.fields.filter((field) => field.label && field.label.toLowerCase().startsWith(parsed.incomplete.toLowerCase()) && !parsed.values[field.name]);
        if (applicable) {
            return applicable.map((f) => {
                return {
                    Complete: prefix + (f.label || f.name),
                    Suggestion: '--' + (f.label || f.name),
                    Description: f.description || '',
                    Hint: f.hint || '',
                    IconData: parsed.binding?.icon || '',
                };
            });
        }

        return [];
    };

    // getSuggestionsForField gets suggestions for a positional or flag field value
    private getValueSuggestions = async (parsed: ParsedCommand, delimiter?: string): Promise<ExtendedAutocompleteSuggestion[]> => {
        if (!parsed || !parsed.field) {
            return [];
        }
        const f = parsed.field;

        switch (f.type) {
        case AppFieldTypes.USER:
            return this.getUserFieldSuggestions(parsed);
        case AppFieldTypes.CHANNEL:
            return this.getChannelFieldSuggestions(parsed);
        case AppFieldTypes.BOOL:
            return this.getBooleanSuggestions(parsed);
        case AppFieldTypes.DYNAMIC_SELECT:
            return this.getDynamicSelectSuggestions(parsed, delimiter);
        case AppFieldTypes.STATIC_SELECT:
            return this.getStaticSelectSuggestions(parsed, delimiter);
        }

        const mentionSuggestions = await inTextMentionSuggestions(parsed.incomplete, this.store, this.channelID, this.teamID, delimiter);
        if (mentionSuggestions) {
            return mentionSuggestions;
        }

        // Handle text values
        let complete = parsed.incomplete;
        if (complete && delimiter) {
            complete = delimiter + complete + delimiter;
        }

        const fieldName = parsed.field.modal_label || parsed.field.label || parsed.field.name;
        return [{
            Complete: complete,
            Suggestion: `${fieldName}: ${delimiter || '"'}${parsed.incomplete}${delimiter || '"'}`,
            Description: f.description || '',
            Hint: '',
            IconData: parsed.binding?.icon || '',
        }];
    };

    // getStaticSelectSuggestions returns suggestions specified in the field's options property
    private getStaticSelectSuggestions = (parsed: ParsedCommand, delimiter?: string): AutocompleteSuggestion[] => {
        const f = parsed.field as AutocompleteStaticSelect;
        const opts = f.options?.filter((opt) => opt.label.toLowerCase().startsWith(parsed.incomplete.toLowerCase()));
        if (!opts?.length) {
            return [{
                Complete: '',
                Suggestion: '',
                Hint: this.intl.formatMessage({
                    id: 'apps.suggestion.no_static',
                    defaultMessage: 'No matching options.',
                }),
                Description: '',
                IconData: COMMAND_SUGGESTION_ERROR,
            }];
        }
        return opts.map((opt) => {
            let complete = opt.value;
            if (delimiter) {
                complete = delimiter + complete + delimiter;
            } else if (isMultiword(opt.value)) {
                complete = '`' + complete + '`';
            }
            return {
                Complete: complete,
                Suggestion: opt.label,
                Hint: f.hint || '',
                Description: f.description || '',
                IconData: opt.icon_data || parsed.binding?.icon || '',
            };
        });
    };

    // getDynamicSelectSuggestions fetches and returns suggestions from the server
    private getDynamicSelectSuggestions = async (parsed: ParsedCommand, delimiter?: string): Promise<AutocompleteSuggestion[]> => {
        const f = parsed.field;
        if (!f) {
            // Should never happen
            return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                id: 'apps.error.parser.unexpected_error',
                defaultMessage: 'Unexpected error.',
            }));
        }

        const {creq, errorMessage} = await this.composeCallRequest(parsed, f.lookup);
        if (!creq) {
            return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                id: 'apps.error.lookup.error_preparing_request',
                defaultMessage: 'Error preparing lookup request: {errorMessage}',
            }, {
                errorMessage,
            }));
        }
        creq.query = parsed.incomplete;
        creq.selected_field = parsed.field?.name;

        const res = await this.store.dispatch(doAppLookup(creq, this.intl)) as DoAppCallResult<AppLookupResponse>;

        if (res.error) {
            const errorResponse = res.error;
            return this.makeDynamicSelectSuggestionError(errorResponse.text || this.intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error occurred.',
            }));
        }

        const callResponse = res.data!;
        switch (callResponse.type) {
        case AppCallResponseTypes.OK:
            break;
        case AppCallResponseTypes.NAVIGATE:
        case AppCallResponseTypes.FORM:
            return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                id: 'apps.error.responses.unexpected_type',
                defaultMessage: 'App response type was not expected. Response type: {type}',
            }, {
                type: callResponse.type,
            }));
        default:
            return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResponse.type,
            }));
        }

        let items = callResponse?.data?.items;
        items = items?.filter(filterEmptyOptions);
        if (!items?.length) {
            return [{
                Complete: '',
                Suggestion: '',
                Hint: this.intl.formatMessage({
                    id: 'apps.suggestion.no_static',
                    defaultMessage: 'No matching options.',
                }),
                IconData: '',
                Description: this.intl.formatMessage({
                    id: 'apps.suggestion.no_dynamic',
                    defaultMessage: 'No data was returned for dynamic suggestions',
                }),
            }];
        }

        return items.map((s): AutocompleteSuggestion => {
            let complete = s.value;
            if (delimiter) {
                complete = delimiter + complete + delimiter;
            } else if (isMultiword(s.value)) {
                complete = '`' + complete + '`';
            }
            return ({
                Complete: complete,
                Description: s.label || s.value,
                Suggestion: s.value,
                Hint: '',
                IconData: s.icon_data || parsed.binding?.icon || '',
            });
        });
    };

    private makeDynamicSelectSuggestionError = (message: string): AutocompleteSuggestion[] => {
        const errMsg = this.intl.formatMessage({
            id: 'apps.error',
            defaultMessage: 'Error: {error}',
        }, {
            error: message,
        });
        return [{
            Complete: '',
            Suggestion: '',
            Hint: this.intl.formatMessage({
                id: 'apps.suggestion.dynamic.error',
                defaultMessage: 'Dynamic select error',
            }),
            IconData: COMMAND_SUGGESTION_ERROR,
            Description: errMsg,
        }];
    };

    private getUserFieldSuggestions = async (parsed: ParsedCommand): Promise<AutocompleteSuggestion[]> => {
        let input = parsed.incomplete.trim();
        if (input[0] === '@') {
            input = input.substring(1);
        }
        const {data} = await this.store.dispatch(autocompleteUsersInChannel(input, this.channelID));
        return getUserSuggestions(data);
    };

    private getChannelFieldSuggestions = async (parsed: ParsedCommand): Promise<AutocompleteSuggestion[]> => {
        let input = parsed.incomplete.trim();
        if (input[0] === '~') {
            input = input.substring(1);
        }
        const {data} = await this.store.dispatch(autocompleteChannels(this.teamID, input));
        return getChannelSuggestions(data);
    };

    // getBooleanSuggestions returns true/false suggestions
    private getBooleanSuggestions = (parsed: ParsedCommand): AutocompleteSuggestion[] => {
        const suggestions: AutocompleteSuggestion[] = [];

        if ('true'.startsWith(parsed.incomplete)) {
            suggestions.push({
                Complete: 'true',
                Suggestion: 'true',
                Description: parsed.field?.description || '',
                Hint: parsed.field?.hint || '',
                IconData: parsed.binding?.icon || '',
            });
        }
        if ('false'.startsWith(parsed.incomplete)) {
            suggestions.push({
                Complete: 'false',
                Suggestion: 'false',
                Description: parsed.field?.description || '',
                Hint: parsed.field?.hint || '',
                IconData: parsed.binding?.icon || '',
            });
        }
        return suggestions;
    };
}

function isMultiword(value: string) {
    if (value.indexOf(' ') !== -1) {
        return true;
    }

    if (value.indexOf('\t') !== -1) {
        return true;
    }

    return false;
}
