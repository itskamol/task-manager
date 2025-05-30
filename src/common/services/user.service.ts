import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from '../interfaces/user.interface';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    async findById(id: string): Promise<User | null> {
        try {
            return await this.prisma.user.findUnique({
                where: { id },
            });
        } catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }

    async findByTelegramId(telegramId: string): Promise<User | null> {
        try {
            return await this.prisma.user.findUnique({
                where: { telegramId: BigInt(telegramId) },
            });
        } catch (error) {
            console.error('Error finding user by Telegram ID:', error);
            return null;
        }
    }

    async create(userData: CreateUserDto): Promise<User> {
        try {
            return await this.prisma.user.create({
                data: {
                    id: userData.id,
                    telegramId: BigInt(userData.telegramId),
                    username: userData.username,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    phoneNumber: userData.phoneNumber,
                    timezone: userData.timezone || 'Asia/Tashkent',
                },
            });
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async update(id: string, userData: Partial<CreateUserDto>): Promise<User> {
        try {
            const updateData: any = { ...userData };
            if (updateData.telegramId) {
                updateData.telegramId = BigInt(updateData.telegramId);
            }

            return await this.prisma.user.update({
                where: { id },
                data: updateData,
            });
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    async ensureUserExists(
        telegramId: string,
        userData: {
            firstName?: string;
            lastName?: string;
            username?: string;
        },
    ): Promise<User> {
        try {
            // Try to find existing user
            let user = await this.findByTelegramId(telegramId);

            if (!user) {
                // Create new user if doesn't exist
                user = await this.create({
                    id: crypto.randomUUID(),
                    telegramId,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    username: userData.username || userData.firstName || 'Unknown',
                    timezone: 'Asia/Tashkent',
                });
                console.log(`Created new user: ${user.id}`);
            }

            return user;
        } catch (error) {
            console.error('Error ensuring user exists:', error);
            throw new Error('User registration failed');
        }
    }
}
