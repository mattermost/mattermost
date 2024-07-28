func UpdateUserStatus(userId string, status string) error {
    if status == "" {
        return errors.New("status cannot be empty")
    }
    // Logic to update the user status
    err := updateStatusInDB(userId, status)
    if err != nil {
        return err
    }
    return nil
}
