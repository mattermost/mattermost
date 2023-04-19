// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';

import type {MarketplaceLabel} from '@mattermost/types/marketplace';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import PluginIcon from 'components/widgets/icons/plugin_icon';

import {Constants} from 'utils/constants';
import Tag from 'components/widgets/tag/tag';
import ExternalLink from 'components/external_link';

// Label renders a tag showing a name and a description in a tooltip.
// If a URL is provided, clicking on the tag will open the URL in a new tab.
export const Label = ({name, description, url}: MarketplaceLabel): JSX.Element => {
    const tag = (
        <Tag
            text={name}
            uppercase={true}
            size={'sm'}
        />
    );

    let label;
    if (description) {
        label = (
            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={
                    <Tooltip id={'plugin-marketplace_label_' + name.toLowerCase() + '-tooltip'}>
                        {description}
                    </Tooltip>
                }
            >
                {tag}
            </OverlayTrigger>
        );
    } else {
        label = tag;
    }

    if (url) {
        return (
            <ExternalLink
                aria-label={name.toLowerCase()}
                className='style--none more-modal__row--link marketplace__tag'
                href={url}
                location='marketplace_item'
            >
                {label}
            </ExternalLink>
        );
    }

    return label;
};

export type MarketplaceItemProps = {
    id: string;
    name: string;
    description?: string;
    iconSource?: string;
    labels?: MarketplaceLabel[];
    homepageUrl?: string;

    error?: string;

    button: JSX.Element;
    updateDetails: JSX.Element | null;
    versionLabel: JSX.Element| null;
};

type MarketplaceItemState = {
    showTooltip: boolean;
};

export default class MarketplaceItem extends React.PureComponent <MarketplaceItemProps, MarketplaceItemState> {
    descriptionRef: React.RefObject<HTMLParagraphElement>;

    constructor(props: MarketplaceItemProps) {
        super(props);

        this.descriptionRef = React.createRef();

        this.state = {
            showTooltip: false,
        };
    }

    componentDidMount(): void {
        this.enableToolTipIfNeeded();
    }

    enableToolTipIfNeeded = (): void => {
        const element = this.descriptionRef.current;
        const showTooltip = element && element.offsetWidth < element.scrollWidth;
        this.setState({showTooltip: Boolean(showTooltip)});
    };

    render(): JSX.Element {
        const {labels = null} = this.props;
        let icon;
        if (this.props.iconSource) {
            icon = (
                <div className='icon__plugin icon__plugin--background'>
                    <img src={this.props.iconSource}/>
                </div>
            );
        } else {
            icon = <PluginIcon className='icon__plugin icon__plugin--background'/>;
        }

        const labelComponents = labels?.map((label) => (
            <Label
                key={label.name}
                name={label.name}
                description={label.description}
                url={label.url}
            />
        ));

        const pluginDetailsInner = (
            <>
                {this.props.name}
                {this.props.versionLabel}
            </>
        );

        const descriptionText = this.props.error || this.props.description;
        let description = (
            <p
                className={classNames('more-modal__description', {error_text: this.props.error})}
                ref={this.descriptionRef}
            >
                {descriptionText}
            </p>
        );

        if (this.state.showTooltip) {
            const displayNameToolTip = (
                <Tooltip
                    id='marketplace-item-description__tooltip'
                    className='more-modal__description-tooltip'
                >
                    {descriptionText}
                </Tooltip>
            );

            description = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={displayNameToolTip}
                >
                    {description}
                </OverlayTrigger>
            );
        }

        let pluginDetails;
        if (this.props.homepageUrl) {
            pluginDetails = (
                <>
                    <ExternalLink
                        aria-label={this.props.name.toLowerCase()}
                        className='style--none more-modal__row--link'
                        href={this.props.homepageUrl}
                        location='marketplace_item'
                    >
                        {pluginDetailsInner}
                    </ExternalLink>
                    {labelComponents}
                    <ExternalLink
                        aria-label="Plugin's website"
                        className='style--none more-modal__row--link'
                        href={this.props.homepageUrl}
                        location='marketplace_item'
                    >
                        {description}
                    </ExternalLink>
                </>
            );
        } else {
            pluginDetails = (
                <>
                    <span
                        aria-label={this.props.name.toLowerCase()}
                        className='style--none'
                    >
                        {pluginDetailsInner}
                    </span>
                    {labelComponents}
                    <span
                        aria-label="Plugin\'s website"
                        className='style--none'
                    >
                        {description}
                    </span>
                </>
            );
        }

        return (
            <>
                <div
                    className={classNames('more-modal__row', 'more-modal__row--link', {item_error: this.props.error})}
                    key={this.props.id}
                    id={'marketplace-plugin-' + this.props.id}
                >
                    {icon}
                    <div className='more-modal__details'>
                        {pluginDetails}
                        {this.props.updateDetails}
                    </div>
                    <div className='more-modal__actions'>
                        {this.props.button}
                    </div>
                </div>
            </>
        );
    }
}
