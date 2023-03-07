// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type SamlCertificateStatus = {
    idp_certificate_file: string;
    private_key_file: string;
    public_certificate_file: string;
};

export type SamlMetadataResponse = {
    idp_descriptor_url: string;
    idp_url: string;
    idp_public_certificate: string;
};
