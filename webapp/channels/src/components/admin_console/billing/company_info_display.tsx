// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import CompanySvg from 'components/common/svg_images_components/company_svg';

import type {GlobalState} from 'types/store';

import './company_info_display.scss';

const noCompanyInfoSection = (
    <div className='CompanyInfoDisplay__noCompanyInfo'>
        <CompanySvg
            width={170}
            height={149}
        />
        <div className='CompanyInfoDisplay__noCompanyInfo-message'>
            <FormattedMessage
                id='admin.billing.company_info_display.noCompanyInfo'
                defaultMessage='There is currently no company information on file.'
            />
        </div>
    </div>
);

const CompanyInfoDisplay: React.FC = () => {
    const companyInfo = useSelector((state: GlobalState) => state.entities.cloud.customer);

    if (!companyInfo) {
        return null;
    }

    let body = noCompanyInfoSection;
    const address = companyInfo?.company_address?.line1 ? companyInfo.company_address : companyInfo?.billing_address;
    const isCompanyBillingFilled = address?.line1 !== undefined && address?.line1 !== '';
    if (isCompanyBillingFilled) {
        body = (
            <div className='CompanyInfoDisplay__companyInfo'>
                <div className='CompanyInfoDisplay__companyInfo-text'>
                    <div className='CompanyInfoDisplay__companyInfo-name'>
                        {companyInfo?.name}
                    </div>
                    {Boolean(companyInfo.num_employees) &&
                        <div className='CompanyInfoDisplay__companyInfo-numEmployees'>
                            <FormattedMessage
                                id='admin.billing.company_info.employees'
                                defaultMessage='{employees} employees'
                                values={{employees: companyInfo.num_employees}}
                            />
                        </div>
                    }
                    <div className='CompanyInfoDisplay__companyInfo-addressTitle'>
                        <FormattedMessage
                            id='admin.billing.company_info.companyAddress'
                            defaultMessage='Company Address'
                        />
                    </div>
                    <div className='CompanyInfoDisplay__companyInfo-address'>
                        <div>{address.line1}</div>
                        {address.line2 && <div>{address.line2}</div>}
                        <div>{`${address.city}, ${address.state}, ${address.postal_code}`}</div>
                        <div>{address.country}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='CompanyInfoDisplay'>
            <div className='CompanyInfoDisplay__header'>
                <div className='CompanyInfoDisplay__headerText'>
                    <div className='CompanyInfoDisplay__headerText-top'>
                        <FormattedMessage
                            id='admin.billing.company_info_display.companyDetails'
                            defaultMessage='Company Details'
                        />
                    </div>
                    {isCompanyBillingFilled &&
                        <div className='CompanyInfoDisplay__headerText-bottom'>
                            <FormattedMessage
                                id='admin.billing.company_info_display.detailsProvided'
                                defaultMessage='Your company name and address'
                            />
                        </div>
                    }
                </div>
            </div>
            <div className='CompanyInfoDisplay__body'>
                {body}
            </div>
        </div>
    );
};

export default CompanyInfoDisplay;
