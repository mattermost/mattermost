// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ChainableT<T =any> = Cypress.Chainable<T>;
export type ResponseT<T =any> = ChainableT<Cypress.Response<T>>;
