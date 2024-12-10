// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {AdminConfig, EnvironmentConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import WithTooltip from 'components/with_tooltip';

export type BaseProps = {
    config?: DeepPartial<AdminConfig>;
    environmentConfig?: EnvironmentConfig;
    setNavigationBlocked?: (blocked: boolean) => void;
    isDisabled?: boolean;
    patchConfig?: (config: DeepPartial<AdminConfig>) => {data: AdminConfig; error: ClientErrorPlaceholder};
}

export type BaseState = {
    saveNeeded: boolean;
    saving: boolean;
    serverError: string|null;
    serverErrorId?: string;
}

// Placeholder type until ClientError is exported from redux.
// TODO: remove ClientErrorPlaceholder and change the return type of patchConfig
type ClientErrorPlaceholder = {
    message: string;
    server_error_id: string;
}

export default abstract class OLDAdminSettings <Props extends BaseProps, State extends BaseState> extends React.Component<Props, State> {
    public constructor(props: Props) {
        super(props);
        const stateInit = {
            saveNeeded: false,
            saving: false,
            serverError: null,
        };
        if (props.config) {
            this.state = Object.assign(this.getStateFromConfig(props.config), stateInit) as Readonly<State>;
        } else {
            this.state = stateInit as Readonly<State>;
        }
    }

    protected abstract getStateFromConfig(config: DeepPartial<AdminConfig>): Partial<State>;

    protected abstract getConfigFromState(config: DeepPartial<AdminConfig>): unknown;

    protected abstract renderTitle(): React.ReactElement;

    protected abstract renderSettings(): React.ReactElement;

    protected handleSaved?: ((config: AdminConfig) => React.ReactElement | void);

    protected canSave?: () => boolean;

    protected handleChange = (id: string, value: unknown) => {
        this.setState((prevState) => ({
            ...prevState,
            saveNeeded: true,
            [id]: value,
        }));

        if (this.props.setNavigationBlocked) {
            this.props.setNavigationBlocked(true);
        }
    };

    private handleSubmit = (e: React.SyntheticEvent) => {
        e.preventDefault();

        this.doSubmit();
    };

    protected doSubmit = async (callback?: () => void) => {
        this.setState({
            saving: true,
            serverError: null,
        });

        // clone config so that we aren't modifying data in the stores
        let config = JSON.parse(JSON.stringify(this.props.config));
        config = this.getConfigFromState(config);

        if (this.props.patchConfig) {
            const {data, error} = await this.props.patchConfig(config);

            if (data) {
                this.setState(this.getStateFromConfig(data) as State);

                this.setState({
                    saveNeeded: false,
                    saving: false,
                });

                if (this.props.setNavigationBlocked) {
                    this.props.setNavigationBlocked(false);
                }

                if (callback) {
                    callback();
                }

                if (this.handleSaved) {
                    this.handleSaved(config);
                }
            } else if (error) {
                this.setState({
                    saving: false,
                    serverError: error.message,
                    serverErrorId: error.server_error_id,
                });

                if (callback) {
                    callback();
                }

                if (this.handleSaved) {
                    this.handleSaved(config);
                }
            }
        }
    };

    private parseInt = (str: string, defaultValue?: number) => {
        const n = parseInt(str, 10);

        if (isNaN(n)) {
            if (defaultValue) {
                return defaultValue;
            }
            return 0;
        }

        return n;
    };

    protected parseIntNonNegative = (str: string | number, defaultValue?: number) => {
        const n = typeof str === 'string' ? parseInt(str, 10) : str;

        if (isNaN(n) || n < 0) {
            if (defaultValue) {
                return defaultValue;
            }
            return 0;
        }

        return n;
    };

    protected parseIntZeroOrMin = (str: string | number, minimumValue = 1) => {
        const n = typeof str === 'string' ? parseInt(str, 10) : str;

        if (isNaN(n) || n < 0) {
            return 0;
        }
        if (n > 0 && n < minimumValue) {
            return minimumValue;
        }

        return n;
    };

    protected parseIntNonZero = (str: string | number, defaultValue?: number, minimumValue = 1) => {
        const n = typeof str === 'string' ? parseInt(str, 10) : str;

        if (isNaN(n) || n < minimumValue) {
            if (defaultValue) {
                return defaultValue;
            }
            return 1;
        }

        return n;
    };

    private getConfigValue(config: AdminConfig | EnvironmentConfig, path: string) {
        const pathParts = path.split('.');

        return pathParts.reduce((obj: object | null, pathPart) => {
            if (!obj) {
                return null;
            }
            return obj[(pathPart as keyof object)];
        }, config);
    }

    private setConfigValue(config: AdminConfig, path: string, value: any) {
        function setValue(obj: object, pathParts: string[]) {
            const part = pathParts[0] as keyof object;

            if (pathParts.length === 1) {
                Object.assign(obj, {[part]: value});
            } else {
                if (obj[part] == null) {
                    Object.assign(obj, {[part]: {}});
                }

                setValue(obj[part], pathParts.slice(1));
            }
        }

        setValue(config, path.split('.'));
    }

    protected isSetByEnv = (path: string) => {
        return Boolean(this.props.environmentConfig && this.getConfigValue(this.props.environmentConfig!, path));
    };

    public render() {
        return (
            <form
                className='form-horizontal'
                role='form'
                onSubmit={this.handleSubmit}
            >
                <div className='wrapper--fixed'>
                    <AdminHeader>
                        {this.renderTitle()}
                    </AdminHeader>
                    {this.renderSettings()}
                    <div className='admin-console-save'>
                        <SaveButton
                            saving={this.state.saving}
                            disabled={this.props.isDisabled || !this.state.saveNeeded || (this.canSave && !this.canSave())}
                            onClick={this.handleSubmit}
                            savingMessage={
                                <FormattedMessage
                                    id='admin.saving'
                                    defaultMessage='Saving Config...'
                                />
                            }
                        />
                        <WithTooltip
                            id='error-tooltip'
                            placement='top'
                            title={this.state?.serverError ?? ''}
                        >
                            <div
                                className='error-message'
                            >
                                <FormError error={this.state.serverError}/>
                            </div>
                        </WithTooltip>
                    </div>
                </div>
            </form>
        );
    }
}

