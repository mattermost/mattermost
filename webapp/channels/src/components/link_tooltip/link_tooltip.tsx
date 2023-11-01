// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useFloating} from '@floating-ui/react-dom';
import classNames from 'classnames';
import Popper from 'popper.js';
import React, {useState} from 'react';
import type {RefObject, CSSProperties} from 'react';
import ReactDOM from 'react-dom';

import useTooltip from 'components/common/hooks/useTooltip';

import Pluggable from 'plugins/pluggable';
import {Constants} from 'utils/constants';

import './link_tooltip.scss';

const tooltipContainerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1070,
    position: 'absolute',
    top: -1000,
    left: -1000,
};

type Props = {
    href: string;
    attributes: {[attribute: string]: string};
    children?: React.ReactNode;
}

type State = {
    show: boolean;
}

class LinkTooltipOld extends React.PureComponent<Props, State> {
    private tooltipContainerRef: RefObject<HTMLDivElement>;
    private hideTimeout: number;
    private showTimeout: number;
    private popper?: Popper;

    public constructor(props: Props) {
        super(props);

        this.tooltipContainerRef = React.createRef();
        this.showTimeout = -1;
        this.hideTimeout = -1;

        this.state = {
            show: false,
        };
    }

    public showTooltip = (e: React.MouseEvent<HTMLSpanElement>): void => {
        //clear the hideTimeout in the case when the cursor is moved from a tooltipContainer child to the link
        window.clearTimeout(this.hideTimeout);

        if (!this.state.show) {
            const target = e.currentTarget;
            const tooltipContainer = this.tooltipContainerRef.current;

            //clear the old this.showTimeout if there is any before overriding
            window.clearTimeout(this.showTimeout);

            this.showTimeout = window.setTimeout(() => {
                this.setState({show: true});

                if (!tooltipContainer) {
                    return;
                }

                const addChildEventListeners = (node: Node) => {
                    node.addEventListener('mouseover', () => clearTimeout(this.hideTimeout));
                    (node as HTMLElement).addEventListener('mouseleave', (event) => {
                        if (event.relatedTarget !== null) {
                            this.hideTooltip();
                        }
                    });
                };
                tooltipContainer.childNodes.forEach(addChildEventListeners);

                this.popper = new Popper(target, tooltipContainer, {
                    placement: 'bottom',
                    modifiers: {
                        preventOverflow: {enabled: false},
                        hide: {enabled: false},
                    },
                });
            }, Constants.OVERLAY_TIME_DELAY);
        }
    };

    public hideTooltip = (): void => {
        //clear the old this.hideTimeout if there is any before overriding
        window.clearTimeout(this.hideTimeout);

        this.hideTimeout = window.setTimeout(() => {
            this.setState({show: false});

            //prevent executing the showTimeout after the hideTooltip
            clearTimeout(this.showTimeout);
        }, Constants.OVERLAY_TIME_DELAY_SMALL);
    };

    public render() {
        const {href, children, attributes} = this.props;

        const dataAttributes = {
            'data-hashtag': attributes['data-hashtag'],
            'data-link': attributes['data-link'],
            'data-channel-mention': attributes['data-channel-mention'],
        };
        return (
            <React.Fragment>
                {ReactDOM.createPortal(
                    <div
                        style={tooltipContainerStyles}
                        ref={this.tooltipContainerRef}
                        className={classNames('tooltip-container', {visible: this.state.show})}
                    >
                        <Pluggable
                            href={href}
                            show={this.state.show}
                            pluggableName='LinkTooltip'
                        />
                    </div>,
                    document.getElementById('root') as HTMLElement,
                )}
                <span
                    onMouseOver={this.showTooltip}
                    onMouseLeave={this.hideTooltip}
                    {...dataAttributes}
                >
                    {children}
                </span>
            </React.Fragment>
        );
    }
}

let foo = false;
export function setFoo(val) {
    foo = val;
}

function LinkTooltipNew(props: Props) {
    const {href, children, attributes} = props;

    const [show] = useState(true);

    let ref;
    let refProps = {};
    let tooltip;
    if (foo) {
        const {
            refs,
            strategy,
            x,
            y,
        } = useFloating<HTMLSpanElement>({
            placement: 'bottom',
            strategy: 'fixed',
        });

        ref = refs.reference;

        tooltip = (
            <div
                style={{
                    position: strategy,
                    left: x ?? 0,
                    top: y ?? 0,
                }}
                ref={refs.floating as any}
                className={classNames('tooltip-container', {visible: show})}
            >
                <Pluggable
                    href={href}
                    show={show}
                    pluggableName='LinkTooltip'
                />
            </div>
        );
    } else {
        const {
            reference,
            getReferenceProps,
            tooltip: tooltipContents,
        } = useTooltip({
            message: (
                <div
                    className={classNames('tooltip-container', {visible: show})}
                    // style={tooltipContainerStyles}
                >
                    <Pluggable
                        href={href}
                        show={show}
                        pluggableName='LinkTooltip'
                    />
                </div>
            ),
            placement: 'bottom',
        });

        ref = reference;
        refProps = getReferenceProps();
        tooltip = tooltipContents;
    }

    return (
        <>

            {tooltip}
            <span
                ref={ref}
                {...refProps}
                data-channel-mention={attributes['data-channel-mention']}
                data-hashag={attributes['data-hashtag']}
                data-link={attributes['data-link']}
            >
                {children}
            </span>
        </>
    );

    // const dataAttributes = {
    //     'data-hashtag': attributes['data-hashtag'],
    //     'data-link': attributes['data-link'],
    //     'data-channel-mention': attributes['data-channel-mention'],
    // };
    // return (
    //     <React.Fragment>
    //         {ReactDOM.createPortal(
    //             <div
    //                 style={tooltipContainerStyles}
    //                 ref={this.tooltipContainerRef}
    //                 className={classNames('tooltip-container', {visible: this.state.show})}
    //             >
    //                 <Pluggable
    //                     href={href}
    //                     show={this.state.show}
    //                     pluggableName='LinkTooltip'
    //                 />
    //             </div>,
    //             document.getElementById('root') as HTMLElement,
    //         )}
    //         <span
    //             onMouseOver={this.showTooltip}
    //             onMouseLeave={this.hideTooltip}
    //             {...dataAttributes}
    //         >
    //             {children}
    //         </span>
    //     </React.Fragment>
    // );
}

export default LinkTooltipNew;
