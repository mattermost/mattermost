// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button, type ButtonEmphasis} from '@mattermost/shared/components/button';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

export interface Props {
    buttonTextElement?: JSX.Element;
    emphasis?: ButtonEmphasis;
    customClass?: string;
}

const ContactUsButton: React.FC<Props> = (props: Props) => {
    const [openContactSales] = useOpenSalesLink();

    const handleContactUsLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        openContactSales();
    };

    return (
        <Button
            emphasis={props.emphasis}
            className={classNames('contact-us', props.customClass)}
            onClick={(e) => handleContactUsLinkClick(e)}
        >
            {props.buttonTextElement || (
                <FormattedMessage
                    id={'admin.license.trialCard.contactSales'}
                    defaultMessage={'Contact Sales'}
                />
            )}
        </Button>
    );
};

export default ContactUsButton;
