# Troubleshooting AdvancedLoggingJSON Configuration in Mattermost v11.3+

## Common Validation Errors

### Error: `model.config.is_valid.log.advanced_logging.json`

**Symptoms:**
- Server fails to start
- Configuration validation errors in logs
- Error message: `Error parsing AdvancedLoggingJSON configuration`

**Common Causes:**
1. Malformed JSON syntax
2. Invalid level IDs  
3. Missing required fields
4. Incompatible level/target combinations

**Troubleshooting Steps:**

#### 1. Validate JSON Syntax
```bash
# Test your AdvancedLoggingJSON with a JSON validator
echo '{"your": "config"}' | python -m json.tool
```

#### 2. Check Level IDs
Ensure all level IDs correspond to valid levels:

**Standard Logging Valid IDs:**
- 0-6: Standard levels (panic, fatal, error, warn, info, debug, trace)
- 7: critical
- 10: stdlog  
- 11: logerror
- 130-132: Remote Cluster Service
- 140-144: LDAP
- 200-204: Shared Channel Service  
- 300-304: Notification Service

**Audit Logging Valid IDs:**
- 100: audit-api
- 101: audit-content
- 102: audit-permissions  
- 103: audit-cli

### Error: `model.config.is_valid.log.advanced_logging.parse`

**Symptoms:**
- Configuration loads but fails validation
- Server startup errors referencing invalid levels

**Root Cause:** Using wrong level types in wrong configuration sections

#### Scenario 1: Audit Levels in Standard Logging
```json
❌ INCORRECT:
{
  "LogSettings": {
    "AdvancedLoggingJSON": {
      "console": {
        "Type": "console",
        "Levels": [{"ID": 100, "Name": "audit-api"}]
      }
    }
  }
}

✅ CORRECT:
{
  "ExperimentalAuditSettings": {
    "AdvancedLoggingJSON": {
      "audit": {  
        "Type": "console",
        "Levels": [{"ID": 100, "Name": "audit-api"}]
      }
    }
  }
}
```

#### Scenario 2: Standard Levels in Audit Logging  
```json
❌ INCORRECT:
{
  "ExperimentalAuditSettings": {
    "AdvancedLoggingJSON": {
      "audit": {
        "Type": "file", 
        "Levels": [{"ID": 2, "Name": "error"}]
      }
    }
  }
}

✅ CORRECT:
{
  "LogSettings": {
    "AdvancedLoggingJSON": {
      "file": {
        "Type": "file",
        "Levels": [{"ID": 2, "Name": "error"}]  
      }
    }
  }
}
```

## Diagnostic Commands

### Check Current Configuration
```bash
# View current logging configuration
mmctl config get LogSettings.AdvancedLoggingJSON
mmctl config get ExperimentalAuditSettings.AdvancedLoggingJSON
```

### Validate Configuration File
```bash  
# Test configuration before applying
./mattermost config validate --config config.json
```

### Check Server Logs for Validation Details
```bash
# Look for specific validation errors
tail -f logs/mattermost.log | grep -i "advanced_logging\|validation"
```

## Migration Scenarios

### Migrating Pre-v11.3 Mixed Configurations

**Problem**: Configuration worked in pre-v11.3 but fails validation after upgrade

**Example Issue:**
```json
{
  "LogSettings": {
    "AdvancedLoggingJSON": {
      "mixed": {
        "Type": "file",
        "Levels": [
          {"ID": 2, "Name": "error"},      // Standard - OK
          {"ID": 100, "Name": "audit-api"} // Audit - INVALID in v11.3+
        ]
      }
    }
  }
}
```

**Solution**: Separate into appropriate sections
```json
{
  "LogSettings": {
    "AdvancedLoggingJSON": {
      "standard": {
        "Type": "file", 
        "Levels": [{"ID": 2, "Name": "error"}],
        "Options": {"Filename": "mattermost.log"}
      }
    }
  },
  "ExperimentalAuditSettings": {
    "AdvancedLoggingJSON": {
      "audit": {
        "Type": "file",
        "Levels": [{"ID": 100, "Name": "audit-api"}], 
        "Options": {"Filename": "audit.log"}
      }
    }
  }
}
```

## Quick Fix Checklist

When encountering AdvancedLoggingJSON errors:

1. **Check JSON Syntax**
   - [ ] Valid JSON structure
   - [ ] Proper quote escaping  
   - [ ] No trailing commas

2. **Verify Level Separation**
   - [ ] Standard levels (0-11, 130+) only in `LogSettings`
   - [ ] Audit levels (100-103) only in `ExperimentalAuditSettings`
   - [ ] No mixing between sections

3. **Validate Level References**
   - [ ] All level IDs exist and are correct
   - [ ] Level names match level IDs
   - [ ] No typos in level names

4. **Check Required Fields**
   - [ ] `Type` field present and valid
   - [ ] Required `Options` for target types (e.g., filename for file targets)

## Recovery Procedures

### Emergency Recovery: Disable Advanced Logging
If server won't start due to AdvancedLoggingJSON issues:

```json
{
  "LogSettings": {
    "AdvancedLoggingJSON": {}
  },
  "ExperimentalAuditSettings": {
    "AdvancedLoggingJSON": {}  
  }
}
```

### Gradual Migration Approach
1. Start with empty AdvancedLoggingJSON configurations
2. Add standard logging configuration first
3. Test and validate
4. Add audit logging configuration  
5. Test and validate

## Getting Help

### Log Information to Collect
When seeking support, provide:
- Complete error messages from server logs
- Current `LogSettings.AdvancedLoggingJSON` configuration
- Current `ExperimentalAuditSettings.AdvancedLoggingJSON` configuration  
- Mattermost server version
- Previous working configuration (if available)

### Support Channels
- [Mattermost Community Server](https://community.mattermost.com/)
- [GitHub Issues](https://github.com/mattermost/mattermost/issues)
- Enterprise Support (for Enterprise Edition users)