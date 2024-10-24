// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable react/require-optimization */

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import WithTooltip from 'components/with_tooltip';

// type Props1 = {
//     config?: DeepPartial<AdminConfig>;
//     environmentConfig?: EnvironmentConfig;
//     setNavigationBlocked?: (blocked: boolean) => void;
//     isDisabled?: boolean;
//     patchConfig?: (config: DeepPartial<AdminConfig>) => {data: AdminConfig; error: ClientErrorPlaceholder};
// }

// export type BaseState = {
//     saveNeeded: boolean;
//     saving: boolean;
//     serverError: string|null;
//     serverErrorId?: string;
// }

// // Placeholder type until ClientError is exported from redux.
// // TODO: remove ClientErrorPlaceholder and change the return type of patchConfig
// type ClientErrorPlaceholder = {
//     message: string;
//     server_error_id: string;
// }

type Props = {
    isDisabled?: boolean;
    renderTitle: () => JSX.Element;
    renderSettings: () => React.ReactNode;
    doSubmit: () => void;
    saving: boolean;
    saveNeeded: boolean;
    serverError?: React.ReactNode;
}

const AdminSetting = ({
    doSubmit,
    renderSettings,
    renderTitle,
    isDisabled,
    saving,
    saveNeeded,
    serverError,
}: Props) => {
    const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        doSubmit();
    }, [doSubmit]);

    return (
        <form
            className='form-horizontal'
            role='form'
            onSubmit={handleSubmit}
        >
            <div className='wrapper--fixed'>
                <AdminHeader>
                    {renderTitle()}
                </AdminHeader>
                {renderSettings()}
                <div className='admin-console-save'>
                    <SaveButton
                        saving={saving}
                        disabled={isDisabled || !saveNeeded} // || (canSave && !canSave())
                        onClick={handleSubmit}
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
                        title={serverError ?? ''}
                    >
                        <div
                            className='error-message'
                        >
                            <FormError error={serverError}/>
                        </div>
                    </WithTooltip>
                </div>
            </div>
        </form>
    );
};

export default AdminSetting;

// export default abstract class AdminSettings <Props extends Props1, State extends BaseState> extends React.Component<Props, State> {
//     public constructor(props: Props) {
//         super(props);
//         const stateInit = {
//             saveNeeded: false,
//             saving: false,
//             serverError: null,
//         };
//         if (props.config) {
//             this.state = Object.assign(this.getStateFromConfig(props.config), stateInit) as Readonly<State>;
//         } else {
//             this.state = stateInit as Readonly<State>;
//         }
//     }

//     protected abstract getStateFromConfig(config: DeepPartial<AdminConfig>): Partial<State>;

//     protected abstract getConfigFromState(config: DeepPartial<AdminConfig>): unknown;

//     protected abstract renderTitle(): React.ReactElement;

//     protected abstract renderSettings(): React.ReactElement;

//     protected handleSaved?: ((config: AdminConfig) => React.ReactElement | void);

//     protected canSave?: () => boolean;

//     protected handleChange = (id: string, value: unknown) => {
//         this.setState((prevState) => ({
//             ...prevState,
//             saveNeeded: true,
//             [id]: value,
//         }));

//         if (this.props.setNavigationBlocked) {
//             this.props.setNavigationBlocked(true);
//         }
//     };

//     private handleSubmit = (e: React.SyntheticEvent) => {
//         e.preventDefault();

//         this.doSubmit();
//     };

//     protected doSubmit = async (callback?: () => void) => {
//         this.setState({
//             saving: true,
//             serverError: null,
//         });

//         // clone config so that we aren't modifying data in the stores
//         let config = JSON.parse(JSON.stringify(this.props.config));
//         config = this.getConfigFromState(config);

//         if (this.props.patchConfig) {
//             const {data, error} = await this.props.patchConfig(config);

//             if (data) {
//                 this.setState(this.getStateFromConfig(data) as State);

//                 this.setState({
//                     saveNeeded: false,
//                     saving: false,
//                 });

//                 if (this.props.setNavigationBlocked) {
//                     this.props.setNavigationBlocked(false);
//                 }

//                 if (callback) {
//                     callback();
//                 }

//                 if (this.handleSaved) {
//                     this.handleSaved(config);
//                 }
//             } else if (error) {
//                 this.setState({
//                     saving: false,
//                     serverError: error.message,
//                     serverErrorId: error.server_error_id,
//                 });

//                 if (callback) {
//                     callback();
//                 }

//                 if (this.handleSaved) {
//                     this.handleSaved(config);
//                 }
//             }
//         }
//     };

//     public render() {
//         return (
//             <form
//                 className='form-horizontal'
//                 role='form'
//                 onSubmit={this.handleSubmit}
//             >
//                 <div className='wrapper--fixed'>
//                     <AdminHeader>
//                         {this.renderTitle()}
//                     </AdminHeader>
//                     {this.renderSettings()}
//                     <div className='admin-console-save'>
//                         <SaveButton
//                             saving={this.state.saving}
//                             disabled={this.props.isDisabled || !this.state.saveNeeded || (this.canSave && !this.canSave())}
//                             onClick={this.handleSubmit}
//                             savingMessage={
//                                 <FormattedMessage
//                                     id='admin.saving'
//                                     defaultMessage='Saving Config...'
//                                 />
//                             }
//                         />
//                         <WithTooltip
//                             id='error-tooltip'
//                             placement='top'
//                             title={this.state?.serverError ?? ''}
//                         >
//                             <div
//                                 className='error-message'
//                             >
//                                 <FormError error={this.state.serverError}/>
//                             </div>
//                         </WithTooltip>
//                     </div>
//                 </div>
//             </form>
//         );
//     }
// }

