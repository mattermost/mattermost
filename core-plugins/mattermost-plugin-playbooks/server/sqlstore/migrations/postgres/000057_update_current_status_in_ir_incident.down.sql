UPDATE IR_Incident
SET CurrentStatus =
        CASE
            WHEN CurrentStatus = 'Finished'
                THEN 'Archived'
            ELSE 'InProgress'
            END;
