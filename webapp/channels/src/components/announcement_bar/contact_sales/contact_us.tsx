// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

export interface Props {
    buttonTextElement?: JSX.Element;
    eventID?: string;
    customClass?: string;
}

const ContactUsButton: React.FC<Props> = (props: Props) => {
    const [openContactSales] = useOpenSalesLink();

    const handleContactUsLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        openContactSales();
    };

    return (
        <button
            className={`btn contact-us ${props.customClass || 'btn-tertiary'}`}
            onClick={(e) => handleContactUsLinkClick(e)}
        >
            {props.buttonTextElement || (
                <FormattedMessage
                    id={'admin.license.trialCard.contactSales'}
                    defaultMessage={'Contact Sales'}
                />
            )}
        </button>
    );
};

export default ContactUsButton;
