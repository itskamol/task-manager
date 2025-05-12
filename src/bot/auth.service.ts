import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Context, InlineKeyboard, Keyboard } from 'grammy';
import { BotLoggerService } from './bot-logger.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: BotLoggerService,
    ) {}

    async checkRegistration(ctx: Context): Promise<boolean> {
        if (!ctx.from) return false;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (user) {
                await ctx.reply(`Welcome back, ${user.firstName || 'there'}! 👋`);
                return true;
            }

            return false;
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            return false;
        }
    }

    async sendConsentPrompt(ctx: Context): Promise<void> {
        const keyboard = new InlineKeyboard()
            .text('✅ I agree', 'agree_phone')
            .text('❌ I decline', 'decline_phone');

        await ctx.reply(
            'To use all features of Task Manager, I need your phone number. ' +
                'This will help me identify you and ensure secure access to your tasks. ' +
                'Would you like to share your phone number?',
            { reply_markup: keyboard },
        );
    }

    async handleConsentResponse(ctx: Context): Promise<void> {
        if (!ctx.callbackQuery?.data) return;

        const data = ctx.callbackQuery.data;
        if (data === 'agree_phone') {
            const keyboard = new Keyboard().requestContact('📲 Send my number').resized();

            await ctx.reply('Great! Please click the button below to share your phone number.', {
                reply_markup: keyboard,
            });
        } else if (data === 'decline_phone') {
            await ctx.reply(
                'I understand. You can continue using basic features, but some functionality will be limited. ' +
                    'You can always register later using the /register command.',
            );
        }

        // Remove the inline keyboard from the previous message
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    }

    async handleContact(ctx: Context): Promise<void> {
        if (!ctx.message?.contact || !ctx.from) {
            return;
        }

        const contact = ctx.message.contact;
        const from = ctx.from;

        // Verify that the contact belongs to the sender
        if (contact.user_id !== from.id) {
            await ctx.reply(
                'For security reasons, I can only accept your own phone number. ' +
                    'Please use the button below to share your contact.',
                {
                    reply_markup: new Keyboard().requestContact('📲 Send my number').resized(),
                },
            );
            return;
        }

        try {
            const user = await this.prisma.user.upsert({
                where: { telegramId: BigInt(from.id) },
                update: {
                    phoneNumber: contact.phone_number,
                    firstName: from.first_name,
                    lastName: from.last_name,
                    username: from.username,
                },
                create: {
                    telegramId: BigInt(from.id),
                    phoneNumber: contact.phone_number,
                    firstName: from.first_name,
                    lastName: from.last_name,
                    username: from.username,
                },
            });

            await ctx.reply(
                '✅ Thank you! You have been successfully registered. ' +
                    'You now have full access to all Task Manager features!\n\n' +
                    'Use /help to see available commands.',
                { reply_markup: { remove_keyboard: true } },
            );

            this.logger.userRegistered(ctx, user.id);
        } catch (error) {
            this.logger.userRegistrationFailed(ctx, error as Error);
            await ctx.reply(
                'Sorry, there was an error registering your account. Please try again later.',
                { reply_markup: { remove_keyboard: true } },
            );
        }
    }
}
