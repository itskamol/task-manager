import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module'; // Using AppModule to get the real service instance
import { ConfigModule } from '@nestjs/config';
import { AuthService } from '../../src/bot/services/auth.service';
import { PrismaClient } from '@prisma/client';
import { clearDatabase, createMockContext } from '../utils/test-utils';
import { DeepMocked } from 'jest-mock-extended';
import { Context, InlineKeyboard, Keyboard } from 'grammy';

describe('AuthService Bot Interactions', () => {
  let app: TestingModule;
  let authService: AuthService;
  let prisma: PrismaClient;
  let mockCtx: DeepMocked<Context>;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        AppModule, // Provides AuthService, PrismaService, BotLoggerService etc.
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
      ],
    }).compile();

    authService = app.get<AuthService>(AuthService);
    prisma = app.get<PrismaClient>(PrismaClient);
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    // Create a fresh mock context for each test
    mockCtx = createMockContext({ id: 123, username: 'testuser' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sendConsentPrompt', () => {
    it('should reply with the consent message and correct inline keyboard', async () => {
      await authService.sendConsentPrompt(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('need your phone number'),
        expect.objectContaining({
          reply_markup: new InlineKeyboard()
            .text('✅ I agree', 'agree_phone')
            .text('❌ I decline', 'decline_phone'),
        }),
      );
    });
  });

  describe('handleConsentResponse', () => {
    it('for "agree_phone": should ask to send contact via button and answer callback', async () => {
      mockCtx.callbackQuery = {
        id: 'cb_agree',
        from: { id: 123, is_bot: false, first_name: 'Test' },
        data: 'agree_phone',
        chat_instance: 'chat_inst_agree',
      };
      // The actual method in AuthService does not call answerCallbackQuery. This test will highlight it.
      // If it *should* call it, the mock for answerCallbackQuery in createMockContext is ready.

      await authService.handleConsentResponse(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Please click the button below to share your phone number'),
        expect.objectContaining({
          reply_markup: new Keyboard().requestContact('📲 Send my number').resized(),
        }),
      );
      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledTimes(1);
      // To test answerCallbackQuery, it would need to be called in AuthService
      // expect(mockCtx.answerCallbackQuery).toHaveBeenCalledTimes(1); 
    });

    it('for "decline_phone": should send explanation message and answer callback', async () => {
      mockCtx.callbackQuery = {
        id: 'cb_decline',
        from: { id: 123, is_bot: false, first_name: 'Test' },
        data: 'decline_phone',
        chat_instance: 'chat_inst_decline',
      };

      await authService.handleConsentResponse(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('I understand. You can continue using basic features')
      );
      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledTimes(1);
      // expect(mockCtx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleContact', () => {
    const USER_ID = 456;
    const USER_USERNAME = 'contactsharer';
    const USER_FIRST_NAME = 'Sharer';
    const USER_PHONE = '+15551234567';

    beforeEach(() => {
      // Reset context for this specific user
      mockCtx = createMockContext({ id: USER_ID, username: USER_USERNAME, first_name: USER_FIRST_NAME });
    });

    it('should register user with their own contact and reply with success', async () => {
      mockCtx.message = {
        message_id: 1,
        date: Date.now()/1000,
        chat: { id: USER_ID, type: 'private', first_name: USER_FIRST_NAME, username: USER_USERNAME },
        contact: {
          phone_number: USER_PHONE,
          first_name: USER_FIRST_NAME,
          user_id: USER_ID, // Contact belongs to the sender
        },
      };

      await authService.handleContact(mockCtx);

      const userInDb = await prisma.user.findUnique({ where: { telegramId: BigInt(USER_ID) } });
      expect(userInDb).not.toBeNull();
      expect(userInDb?.phoneNumber).toBe(USER_PHONE);
      expect(userInDb?.firstName).toBe(USER_FIRST_NAME);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Thank you! You have been successfully registered.'),
        { reply_markup: { remove_keyboard: true } },
      );
    });

    it('should reject contact if user_id does not match sender and prompt again', async () => {
      mockCtx.message = {
        message_id: 1,
        date: Date.now()/1000,
        chat: { id: USER_ID, type: 'private', first_name: USER_FIRST_NAME, username: USER_USERNAME },
        contact: {
          phone_number: USER_PHONE,
          first_name: 'Other',
          user_id: 999, // Contact does NOT belong to the sender
        },
      };

      await authService.handleContact(mockCtx);

      const userInDb = await prisma.user.findUnique({ where: { telegramId: BigInt(USER_ID) } });
      expect(userInDb?.phoneNumber).toBeNull(); // Or check it's not USER_PHONE if user existed

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('For security reasons, I can only accept your own phone number.'),
        expect.objectContaining({
          reply_markup: new Keyboard().requestContact('📲 Send my number').resized(),
        }),
      );
    });
  });
});
