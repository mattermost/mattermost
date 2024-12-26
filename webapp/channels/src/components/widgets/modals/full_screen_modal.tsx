// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';

import BackIcon from 'components/widgets/icons/back_icon';
import CloseIcon from 'components/widgets/icons/close_icon';

import './full_screen_modal.scss';

// This must be on sync with the animation time in ./full_screen_modal.scss
const ANIMATION_DURATION = 100;

type Props = {
    show: boolean;
    onClose: () => void;
    onGoBack?: () => void;
    children: React.ReactNode;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    intl: any; // TODO This needs to be replaced with IntlShape once react-intl is upgraded
    overrideTargetEvent?: boolean;
    ignoreExit?: boolean;
};

class FullScreenModal extends React.PureComponent<Props> {
    private modal = React.createRef<HTMLDivElement>();

    public componentDidMount() {
        document.addEventListener('keydown', this.handleKeypress);
        document.addEventListener('focus', this.enforceFocus, this.props.overrideTargetEvent);
        this.enforceFocus();
    }

    public componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeypress);
        document.removeEventListener('focus', this.enforceFocus, this.props.overrideTargetEvent);
    }

    public enforceFocus = () => {
        setTimeout(() => {
            const currentActiveElement = document.activeElement;
            if (this.modal && this.modal.current && !this.modal.current.contains(currentActiveElement)) {
                this.modal.current.focus();
            }
        });
    };

    private handleKeypress = (e: KeyboardEvent) => {
        if (this.props.ignoreExit !== undefined && this.props.ignoreExit && e.key === 'Escape') {
            return;
        }

        const currentActiveElement = document.activeElement;
        if (!this.props.overrideTargetEvent && e.key === 'Escape' && this.props.show && e.target && this.modal.current && this.modal.current.contains(currentActiveElement)) {
            this.close();
        }
        if (this.props.overrideTargetEvent && e.key === 'Escape' && this.props.show) {
            this.close();
        }
    };

    private close = () => {
        this.props.onClose();
    };

    public render() {
        return (
            <CSSTransition
                in={this.props.show}
                classNames='FullScreenModal'
                mountOnEnter={true}
                unmountOnExit={true}
                timeout={ANIMATION_DURATION}
                appear={true}
            >
                <>
                    <div
                        className='FullScreenModal'
                        ref={this.modal}
                        tabIndex={-1}
                        aria-modal={true}
                        aria-label={this.props.ariaLabel}
                        aria-labelledby={this.props.ariaLabelledBy}
                        role='none'
                    >
                        {this.props.onGoBack &&
                            <button
                                onClick={this.props.onGoBack}
                                className='back'
                                aria-label={this.props.intl.formatMessage({id: 'full_screen_modal.back', defaultMessage: 'Back'})}
                            >
                                <BackIcon id='backIcon'/>
                            </button>}
                        <button
                            onClick={this.close}
                            className='close-x'
                            aria-label={this.props.intl.formatMessage({id: 'full_screen_modal.close', defaultMessage: 'Close'})}
                        >
                            <CloseIcon id='closeIcon'/>
                        </button>
                        {this.props.children}
                    </div>
                    <div
                        tabIndex={0}
                        style={{display: 'none'}}
                    />
                </>
            </CSSTransition>
        );
    }
}

const wrappedComponent = injectIntl(FullScreenModal, {forwardRef: true});
wrappedComponent.displayName = 'injectIntl(FullScreenModal)';
wrappedComponent.defaultProps = {
    overrideTargetEvent: true,
};
export default wrappedComponent;
