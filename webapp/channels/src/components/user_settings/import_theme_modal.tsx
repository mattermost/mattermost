// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, WrappedComponentProps, injectIntl} from 'react-intl';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {setThemeDefaults} from 'mattermost-redux/utils/theme_utils';

interface Props extends WrappedComponentProps {
    callback: ((args: Theme) => void) | null;
    onExited: () => void;
}

type State = {
    value: string;
    inputError: React.ReactNode | null;
    show: boolean;
}

class ImportThemeModal extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            value: '',
            inputError: null,
            show: true,
        };
    }

    private handleOnHide = () => {
        this.setState({show: false});
    }

    private handleSubmit = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();

        const text = this.state.value;

        if (!ImportThemeModal.isInputValid(text)) {
            this.setState({
                inputError: (
                    <FormattedMessage
                        id='user.settings.import_theme.submitError'
                        defaultMessage='Invalid format, please try copying and pasting in again.'
                    />
                ),
            });
            return;
        }

        /*
         * index mapping of slack theme format (index => slack-property name)
         *
         * |-------|-------------------------|-------------------------|
         * | index | Slack theme-property    | MM theme-property       |
         * |-------|-------------------------|-------------------------|
         * |   0   | Column BG               | sidebarBg               |
         * |   1   | ???                     | sidebarHeaderBg         |
         * |   2   | Active Item BG          | sidebarTextActiveBorder |
         * |   3   | Active Item Text        | sidebarTextActiveColor  |
         * |   4   | Hover Item BG           | sidebarTextHoverBg      |
         * |   5   | Text Color              | sidebarText             |
         * |   6   | Active Presence         | onlineIndicator         |
         * |   7   | Mention Badge           | mentionBg               |
         * |   8   | TOP-NAV BG              | --- (desktop only)      |
         * |   9   | TOP-NAV Text            | --- (desktop only)      |
         * |-------|-------------------------|-------------------------|
         *
         * values at index 8 + 9 are only for the desktop app
         */

        const [
            sidebarBg, // 0
            sidebarHeaderBg, // 1
            sidebarTextActiveBorder, // 2
            sidebarTextActiveColor, // 3
            sidebarTextHoverBg, // 4
            sidebarText, // 5
            onlineIndicator, // 6
            mentionBg, // 7
        ] = text.split(',');

        const theme = setThemeDefaults({
            type: 'custom',
            sidebarBg,
            sidebarText,
            sidebarUnreadText: sidebarText,
            sidebarTextHoverBg,
            sidebarTextActiveBorder,
            sidebarTextActiveColor,
            sidebarHeaderBg,
            sidebarHeaderTextColor: sidebarText,
            onlineIndicator,
            mentionBg,
        });

        this.props.callback?.(theme as Theme);

        this.handleOnHide();
    }

    private static isInputValid(text: string) {
        if (text.length === 0) {
            return false;
        }

        if (text.indexOf(' ') !== -1) {
            return false;
        }

        if (text.length > 0 && text.indexOf(',') === -1) {
            return false;
        }

        if (text.length > 0) {
            const colors = text.split(',');

            if (colors.length !== 10) {
                return false;
            }

            for (let i = 0; i < colors.length; i++) {
                if (colors[i].length !== 7 && colors[i].length !== 4) {
                    return false;
                }

                if (colors[i].charAt(0) !== '#') {
                    return false;
                }
            }
        }

        return true;
    }

    handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        this.setState({value});

        if (ImportThemeModal.isInputValid(value)) {
            this.setState({inputError: null});
        } else {
            this.setState({
                inputError: (
                    <FormattedMessage
                        id='user.settings.import_theme.submitError'
                        defaultMessage='Invalid format, please try copying and pasting in again.'
                    />
                ),
            });
        }
    }

    render() {
        return (
            <span>
                <Modal
                    dialogClassName='a11y__modal'
                    show={this.state.show}
                    onHide={this.handleOnHide}
                    onExited={this.props.onExited}
                    role='dialog'
                    aria-labelledby='importThemeModalLabel'
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title
                            componentClass='h1'
                            id='importThemeModalLabel'
                        >
                            <FormattedMessage
                                id='user.settings.import_theme.importHeader'
                                defaultMessage='Import Slack Theme'
                            />
                        </Modal.Title>
                    </Modal.Header>
                    <form
                        role='form'
                        className='form-horizontal'
                    >
                        <Modal.Body>
                            <p>
                                <FormattedMessage
                                    id='user.settings.import_theme.importBody'
                                    defaultMessage='To import a theme, go to a Slack team and look for "Preferences -> Themes". Open the custom theme option, copy the theme color values and paste them here:'
                                />
                            </p>
                            <div className='form-group less'>
                                <div className='col-sm-12'>
                                    <input
                                        id='themeVector'
                                        type='text'
                                        className='form-control'
                                        value={this.state.value}
                                        onChange={this.handleChange}
                                    />
                                    <div className='input__help'>
                                        {this.state.inputError}
                                    </div>
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <button
                                id='cancelButton'
                                type='button'
                                className='btn btn-link'
                                onClick={this.handleOnHide}
                            >
                                <FormattedMessage
                                    id='user.settings.import_theme.cancel'
                                    defaultMessage='Cancel'
                                />
                            </button>
                            <button
                                id='submitButton'
                                onClick={this.handleSubmit}
                                type='submit'
                                className='btn btn-primary'
                            >
                                <FormattedMessage
                                    id='user.settings.import_theme.submit'
                                    defaultMessage='Submit'
                                />
                            </button>
                        </Modal.Footer>
                    </form>
                </Modal>
            </span>
        );
    }
}

export default injectIntl(ImportThemeModal);
