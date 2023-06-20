// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {PropertyTypeEnum} from 'src/blocks/board'

import CreatedTimeProperty from './createdTime/property'
import CreatedByProperty from './createdBy/property'
import UpdatedTimeProperty from './updatedTime/property'
import UpdatedByProperty from './updatedBy/property'
import TextProperty from './text/property'
import EmailProperty from './email/property'
import PhoneProperty from './phone/property'
import NumberProperty from './number/property'
import UrlProperty from './url/property'
import SelectProperty from './select/property'
import MultiSelectProperty from './multiselect/property'
import DateProperty from './date/property'
import PersonProperty from './person/property'
import MultiPersonProperty from './multiperson/property'
import CheckboxProperty from './checkbox/property'
import UnknownProperty from './unknown/property'

import {PropertyType} from './types'

class PropertiesRegistry {
    properties: {[key: string]: PropertyType} = {}
    propertiesList: PropertyType[] = []
    unknownProperty: PropertyType = new UnknownProperty()

    register(prop: PropertyType) {
        this.properties[prop.type] = prop
        this.propertiesList.push(prop)
    }

    unregister(prop: PropertyType) {
        delete this.properties[prop.type]
        this.propertiesList = this.propertiesList.filter((p) => p.type === prop.type)
    }

    list() {
        return this.propertiesList
    }

    get(type: PropertyTypeEnum) {
        return this.properties[type] || this.unknownProperty
    }
}

const registry = new PropertiesRegistry()
registry.register(new TextProperty())
registry.register(new NumberProperty())
registry.register(new EmailProperty())
registry.register(new PhoneProperty())
registry.register(new UrlProperty())
registry.register(new SelectProperty())
registry.register(new MultiSelectProperty())
registry.register(new DateProperty())
registry.register(new PersonProperty())
registry.register(new MultiPersonProperty())
registry.register(new CheckboxProperty())
registry.register(new CreatedTimeProperty())
registry.register(new CreatedByProperty())
registry.register(new UpdatedTimeProperty())
registry.register(new UpdatedByProperty())

export default registry
