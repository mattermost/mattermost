UPDATE Roles r
INNER JOIN (
    SELECT role_name, MIN(scheme_id) AS scheme_id
    FROM (
        SELECT Id AS scheme_id, DefaultTeamAdminRole AS role_name FROM Schemes
        UNION ALL SELECT Id, DefaultTeamUserRole FROM Schemes
        UNION ALL SELECT Id, DefaultTeamGuestRole FROM Schemes
        UNION ALL SELECT Id, DefaultChannelAdminRole FROM Schemes
        UNION ALL SELECT Id, DefaultChannelUserRole FROM Schemes
        UNION ALL SELECT Id, DefaultChannelGuestRole FROM Schemes
        UNION ALL SELECT Id, DefaultPlaybookAdminRole FROM Schemes
        UNION ALL SELECT Id, DefaultPlaybookMemberRole FROM Schemes
        UNION ALL SELECT Id, DefaultRunAdminRole FROM Schemes
        UNION ALL SELECT Id, DefaultRunMemberRole FROM Schemes
    ) expanded
    WHERE role_name IS NOT NULL AND role_name <> ''
    GROUP BY role_name
) m ON r.Name = m.role_name
SET r.SchemeId = m.scheme_id;
