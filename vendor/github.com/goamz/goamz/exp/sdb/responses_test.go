package sdb_test

var TestCreateDomainXmlOK = `
<?xml version="1.0"?>
<CreateDomainResponse xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <ResponseMetadata>
    <RequestId>63264005-7a5f-e01a-a224-395c63b89f6d</RequestId>
    <BoxUsage>0.0055590279</BoxUsage>
  </ResponseMetadata>
</CreateDomainResponse>
`

var TestListDomainsXmlOK = `
<?xml version="1.0"?>
<ListDomainsResponse xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <ListDomainsResult>
    <DomainName>Account</DomainName>
    <DomainName>Domain</DomainName>
    <DomainName>Record</DomainName>
  </ListDomainsResult>
  <ResponseMetadata>
    <RequestId>15fcaf55-9914-63c2-21f3-951e31193790</RequestId>
    <BoxUsage>0.0000071759</BoxUsage>
  </ResponseMetadata>
</ListDomainsResponse>
`

var TestListDomainsWithNextTokenXmlOK = `
<?xml version="1.0"?>
<ListDomainsResponse xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <ListDomainsResult>
    <DomainName>Domain1-200706011651</DomainName>
    <DomainName>Domain2-200706011652</DomainName>
    <NextToken>TWV0ZXJpbmdUZXN0RG9tYWluMS0yMDA3MDYwMTE2NTY=</NextToken>
  </ListDomainsResult>
  <ResponseMetadata>
    <RequestId>eb13162f-1b95-4511-8b12-489b86acfd28</RequestId>
    <BoxUsage>0.0000219907</BoxUsage>
  </ResponseMetadata>
</ListDomainsResponse>
`

var TestDeleteDomainXmlOK = `
<?xml version="1.0"?>
<DeleteDomainResponse xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <ResponseMetadata>
    <RequestId>039e1e25-9a64-2a74-93da-2fda36122a97</RequestId>
    <BoxUsage>0.0055590278</BoxUsage>
  </ResponseMetadata>
</DeleteDomainResponse>
`

var TestDomainMetadataXmlNoSuchDomain = `
<?xml version="1.0"?>
<Response xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <Errors>
    <Error>
      <Code>NoSuchDomain</Code>
      <Message>The specified domain does not exist.</Message>
      <BoxUsage>0.0000071759</BoxUsage>
    </Error>
  </Errors>
  <RequestID>e050cea2-a772-f90e-2cb0-98ebd42c2898</RequestID>
</Response>
`

var TestPutAttrsXmlOK = `
<?xml version="1.0"?>
<PutAttributesResponse xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <ResponseMetadata>
    <RequestId>490206ce-8292-456c-a00f-61b335eb202b</RequestId>
    <BoxUsage>0.0000219907</BoxUsage>
  </ResponseMetadata>
</PutAttributesResponse>
`

var TestAttrsXmlOK = `
<?xml version="1.0"?>
<GetAttributesResponse xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <GetAttributesResult>
    <Attribute><Name>Color</Name><Value>Blue</Value></Attribute>
    <Attribute><Name>Size</Name><Value>Med</Value></Attribute>
  </GetAttributesResult>
  <ResponseMetadata>
    <RequestId>b1e8f1f7-42e9-494c-ad09-2674e557526d</RequestId>
    <BoxUsage>0.0000219942</BoxUsage>
  </ResponseMetadata>
</GetAttributesResponse>
`

var TestSelectXmlOK = `
<?xml version="1.0"?>
<SelectResponse xmlns="http://sdb.amazonaws.com/doc/2009-04-15/">
  <SelectResult>
    <Item>
      <Name>Item_03</Name>
      <Attribute><Name>Category</Name><Value>Clothes</Value></Attribute>
      <Attribute><Name>Subcategory</Name><Value>Pants</Value></Attribute>
      <Attribute><Name>Name</Name><Value>Sweatpants</Value></Attribute>
      <Attribute><Name>Color</Name><Value>Blue</Value></Attribute>
      <Attribute><Name>Color</Name><Value>Yellow</Value></Attribute>
      <Attribute><Name>Color</Name><Value>Pink</Value></Attribute>
      <Attribute><Name>Size</Name><Value>Large</Value></Attribute>
    </Item>
    <Item>
      <Name>Item_06</Name>
      <Attribute><Name>Category</Name><Value>Motorcycle Parts</Value></Attribute>
      <Attribute><Name>Subcategory</Name><Value>Bodywork</Value></Attribute>
      <Attribute><Name>Name</Name><Value>Fender Eliminator</Value></Attribute>
      <Attribute><Name>Color</Name><Value>Blue</Value></Attribute>
      <Attribute><Name>Make</Name><Value>Yamaha</Value></Attribute>
      <Attribute><Name>Model</Name><Value>R1</Value></Attribute>
    </Item>
  </SelectResult>
  <ResponseMetadata>
    <RequestId>b1e8f1f7-42e9-494c-ad09-2674e557526d</RequestId>
    <BoxUsage>0.0000219907</BoxUsage>
  </ResponseMetadata>
</SelectResponse>
`
