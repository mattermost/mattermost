# Admin Console Updates for Mattermost v11.3

## Audit Logging Section Changes

### Label Update
**Path**: System Console → Environment → Logging → Audit Logging

- **Previous Label**: "Audit logging (Beta)"
- **Updated Label**: "Audit Logging"
- **Status**: Feature remains in beta (internal `isBeta` flag unchanged)

### UI Impact
- Remove "(Beta)" suffix from section headers
- Update navigation breadcrumbs 
- Update help text and tooltips that reference the old label

## Screenshot Updates Needed

The following admin console screenshots need to be updated to reflect the label change:

### Environment → Logging Page
- Main logging configuration page showing "Audit Logging" section
- Navigation sidebar showing updated label

### Audit Logging Configuration Page  
- Section header showing "Audit Logging" (without Beta)
- Any tooltips or help text references

## Text Updates Required

### Documentation Pages Requiring Updates

1. **System Admin Guide - Logging Configuration**
   - Replace "Audit logging (Beta)" with "Audit Logging"
   - Update section navigation references

2. **Configuration Settings Reference**
   - Update `ExperimentalAuditSettings` section headers
   - Maintain reference to beta status in feature description

3. **Admin Console Navigation Guide**
   - Update paths: `Environment > Logging > Audit Logging`
   - Update screenshots of navigation

### Help Text Updates

#### Before:
```
Navigate to System Console > Environment > Logging > Audit logging (Beta) to configure audit settings.
```

#### After:
```  
Navigate to System Console > Environment > Logging > Audit Logging to configure audit settings.
```

## Important Notes

### Beta Status Clarification
- **UI Label**: Changed to remove "(Beta)" suffix for cleaner appearance
- **Feature Status**: Remains in beta - no functional changes
- **Documentation**: Should still mention beta status in feature descriptions

### Consistency Requirements
- All admin console references should use "Audit Logging"  
- Feature descriptions should still note beta status
- API documentation continues to reference `ExperimentalAuditSettings`

## Implementation Checklist

### For Technical Writers
- [ ] Update all "Audit logging (Beta)" references to "Audit Logging"
- [ ] Verify beta status mentioned in feature descriptions
- [ ] Update navigation paths in procedural content
- [ ] Review screenshot requirements

### For UX/Design Teams
- [ ] Update admin console screenshots
- [ ] Review tooltip and help text consistency
- [ ] Verify navigation breadcrumb updates

### For QA Teams  
- [ ] Test admin console navigation paths
- [ ] Verify label consistency across different languages
- [ ] Validate help text and tooltip updates