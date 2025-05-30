export interface CreateUserDto {
    id: string;
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    timezone?: string;
}
