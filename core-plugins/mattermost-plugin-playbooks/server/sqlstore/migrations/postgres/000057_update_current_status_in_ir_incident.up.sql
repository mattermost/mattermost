UPDATE IR_Incident
SET CurrentStatus =
        CASE
            WHEN CurrentStatus = 'Archived'
                THEN 'Finished'
            ELSE 'InProgress'
            END;
