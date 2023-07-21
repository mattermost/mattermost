// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getName} from 'country-list';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';
import {getCloudCustomer, updateCloudCustomer, updateCloudCustomerAddress} from 'mattermost-redux/actions/cloud';

import BlockableLink from 'components/admin_console/blockable_link';
import DropdownInput from 'components/dropdown_input';
import StateSelector from 'components/payment_form/state_selector';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import Input from 'components/widgets/inputs/input/input';

import {GlobalState} from 'types/store';
import {COUNTRIES} from 'utils/countries';
import * as Utils from 'utils/utils';

import './company_info_edit.scss';

type Props = Record<string, never>;

const CompanyInfoEdit: React.FC<Props> = () => {
    const dispatch = useDispatch();
    const history = useHistory();

    const companyInfo = useSelector((state: GlobalState) => state.entities.cloud.customer);

    const [companyName, setCompanyName] = useState(companyInfo?.name);
    const [numEmployees, setNumEmployees] = useState<number | undefined>(companyInfo?.num_employees || undefined);

    const [address, setAddress] = useState(companyInfo?.company_address?.line1);
    const [address2, setAddress2] = useState(companyInfo?.company_address?.line2);
    const [city, setCity] = useState(companyInfo?.company_address?.city);
    const [postalCode, setPostalCode] = useState(companyInfo?.company_address?.postal_code);
    const [country, setCountry] = useState(companyInfo?.company_address?.country || getName('US'));
    const [state, setState] = useState(companyInfo?.company_address?.state);
    const [contentChanged, setContentChanged] = useState(false);

    const [sameAsBillingAddress, setSameAsBillingAddress] = useState(Boolean(!companyInfo?.company_address?.line1 && companyInfo?.billing_address?.line1));
    const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    const setValidation = useCallback(() => {
        if (sameAsBillingAddress) {
            setIsValid(Boolean(companyName));
        } else {
            setIsValid(Boolean(companyName && address && city && postalCode && country && state));
        }
    }, [sameAsBillingAddress, companyName, address, city, postalCode, country, state]);

    const updateState = (setStateFunc: (value: any) => void) => {
        return (event: React.ChangeEvent<HTMLInputElement>) => {
            setStateFunc(event.target.value);
            setValidation();
            setContentChanged(true);
        };
    };

    const updateNumEmployees = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.value) {
            setNumEmployees(parseInt(event.target.value, 10));
        } else {
            setNumEmployees(undefined);
        }
        setContentChanged(true);
    };

    useEffect(() => {
        dispatch(getCloudCustomer());
    }, [dispatch]);

    useEffect(() => {
        setValidation();
    }, [setValidation]);

    useEffect(() => {
        if (contentChanged) {
            dispatch(setNavigationBlocked(true));
        }
    }, [contentChanged]);

    if (!companyInfo) {
        return null;
    }

    const handleSubmit = async () => {
        setIsSaving(true);
        await dispatch(updateCloudCustomer({name: companyName, num_employees: numEmployees || 0}));

        if (sameAsBillingAddress) {
            await dispatch(updateCloudCustomerAddress({
                city: '',
                country: '',
                line1: '',
                line2: '',
                postal_code: '',
                state: '',
            }));
        } else {
            await dispatch(updateCloudCustomerAddress({
                city: city || '',
                country: country || '',
                line1: address || '',
                line2: address2 || '',
                postal_code: postalCode || '',
                state: state || '',
            }));
        }

        setIsSaving(false);
        history.push('/admin_console/billing/company_info');
    };

    const billingAddressDisplay = (
        <>
            <div className='CompanyInfoEdit__companyInfo-addressTitle'>
                <FormattedMessage
                    id='admin.billing.company_info.billingAddress'
                    defaultMessage='Billing Address'
                />
            </div>
            <div className='CompanyInfoEdit__companyInfo-address'>
                <div>{companyInfo?.billing_address?.line1}</div>
                {companyInfo?.billing_address?.line2 && <div>{companyInfo?.billing_address?.line2}</div>}
                <div>{`${companyInfo?.billing_address?.city}, ${companyInfo?.billing_address?.state}, ${companyInfo?.billing_address?.postal_code}`}</div>
                <div>{companyInfo?.billing_address?.country}</div>
            </div>
        </>
    );

    const companyAddressInput = (
        <>
            <DropdownInput
                onChange={(option) => {
                    setCountry(option.value);
                    setContentChanged(true);
                }}
                value={country ? {value: country, label: country} : undefined}
                options={COUNTRIES.map((c) => ({value: c.name, label: c.name}))}
                legend={Utils.localizeMessage('admin.billing.company_info.country', 'Country')}
                placeholder={Utils.localizeMessage('admin.billing.company_info.country', 'Country')}
                name={'country_dropdown'}
            />
            <div className='form-row'>
                <Input
                    name='address'
                    type='text'
                    value={address}
                    onChange={updateState(setAddress)}
                    placeholder={Utils.localizeMessage('admin.billing.company_info.address', 'Address')}
                    required={true}
                />
            </div>
            <div className='form-row'>
                <Input
                    name='address2'
                    type='text'
                    value={address2}
                    onChange={updateState(setAddress2)}
                    placeholder={Utils.localizeMessage('admin.billing.company_info.address_2', 'Address 2')}
                />
            </div>
            <div className='form-row'>
                <Input
                    name='city'
                    type='text'
                    value={city}
                    onChange={updateState(setCity)}
                    placeholder={Utils.localizeMessage('admin.billing.company_info.city', 'City')}
                    required={true}
                />
            </div>
            <div className='form-row'>
                <div className='form-row-third-1 selector'>
                    <StateSelector
                        country={country!}
                        state={state!}
                        onChange={(stateValue) => {
                            setState(stateValue);
                            setContentChanged(true);
                        }}
                    />
                </div>
                <div className='form-row-third-2'>
                    <Input
                        name='postalCode'
                        type='text'
                        value={postalCode}
                        onChange={updateState(setPostalCode)}
                        placeholder={Utils.localizeMessage('admin.billing.company_info.zipcode', 'Zip/Postal Code')}
                        required={true}
                    />
                </div>
            </div>
        </>
    );

    return (
        <div className='wrapper--fixed CompanyInfoEdit'>
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to='/admin_console/billing/company_info'
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.billing.company_info_edit.title'
                        defaultMessage='Edit Company Information'
                    />
                </div>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <div className='CompanyInfoEdit__card'>
                        <div className='CompanyInfoEdit__form'>
                            <div className='section-title'>
                                <FormattedMessage
                                    id='admin.billing.company_info_edit.companyDetails'
                                    defaultMessage='Company Details'
                                />
                            </div>
                            <div className='form-row'>
                                <Input
                                    name='companyName'
                                    type='text'
                                    value={companyName}
                                    onChange={updateState(setCompanyName)}
                                    placeholder={Utils.localizeMessage('admin.billing.company_info.companyName', 'Company name')}
                                    required={true}
                                />
                            </div>
                            <div className='form-row'>
                                <Input
                                    name='numEmployees'
                                    type='number'
                                    value={numEmployees}
                                    onChange={updateNumEmployees}
                                    placeholder={Utils.localizeMessage('admin.billing.company_info.numEmployees', 'Number of employees (optional)')}
                                />
                            </div>
                            <div className='section-title'>
                                <FormattedMessage
                                    id='admin.billing.company_info_edit.company_address'
                                    defaultMessage='Company Address'
                                />
                            </div>
                            {companyInfo?.billing_address?.line1 &&
                                <div className='checkbox'>
                                    <label>
                                        <input
                                            type='checkbox'
                                            checked={sameAsBillingAddress}
                                            onChange={(event) => {
                                                setSameAsBillingAddress(event.target.checked);
                                                setContentChanged(true);
                                            }}
                                        />
                                        <FormattedMessage
                                            id='admin.billing.company_info_edit.sameAsBillingAddress'
                                            defaultMessage='Same as Billing Address'
                                        />
                                    </label>
                                </div>
                            }
                            {sameAsBillingAddress && companyInfo?.billing_address?.line1 ? billingAddressDisplay : companyAddressInput}
                        </div>
                    </div>
                </div>
            </div>
            <div className='admin-console-save'>
                <SaveButton
                    saving={isSaving}
                    disabled={!isValid}
                    onClick={handleSubmit}
                    defaultMessage={(
                        <FormattedMessage
                            id='admin.billing.company_info_edit.save'
                            defaultMessage='Save info'
                        />
                    )}
                />
                <BlockableLink
                    className='cancel-button'
                    to='/admin_console/billing/company_info'
                >
                    <FormattedMessage
                        id='admin.billing.company_info_edit.cancel'
                        defaultMessage='Cancel'
                    />
                </BlockableLink>
            </div>
        </div>
    );
};

export default CompanyInfoEdit;
