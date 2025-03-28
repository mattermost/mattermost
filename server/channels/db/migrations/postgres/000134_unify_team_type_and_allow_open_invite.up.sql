-- Migration to ensure consistency between Team.Type and Team.AllowOpenInvite
-- Default to more private settings - prioritize privacy over openness

-- If Team is private (Type='I'), set AllowOpenInvite to false
UPDATE Teams 
SET AllowOpenInvite = false 
WHERE Type = 'I' AND AllowOpenInvite = true;

-- If AllowOpenInvite is false, set Team to private (Type='I')
UPDATE Teams 
SET Type = 'I' 
WHERE AllowOpenInvite = false AND Type = 'O';