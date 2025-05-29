import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaClient } from '@prisma/client';
import { StartHandler } from '../../src/bot/handlers/start.handler';
import { ContactHandler } from '../../src/bot/handlers/contact.handler';
import { AuthService } from '../../src/bot/services/auth.service';
import { clearDatabase, createMockContext } from '../utils/test-utils';
import { DeepMocked } from 'jest-mock-extended';
import { Context } from 'grammy';
import { ConfigModule } from '@nestjs/config';

describe('Bot /start and Registration Flow (E2E)', () => {
  let app: TestingModule;
  let prisma: PrismaClient;
  let startHandler: StartHandler;
  let contactHandler: ContactHandler;
  let authService: AuthService; // To verify DB changes or use its methods directly for setup

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        AppModule,
        ConfigModule.forRoot({
          envFilePath: '.env.test', // Ensure test environment is loaded
          isGlobal: true,
        }),
      ],
    }).compile();

    prisma = app.get<PrismaClient>(PrismaClient);
    startHandler = app.get<StartHandler>(StartHandler);
    contactHandler = app.get<ContactHandler>(ContactHandler);
    authService = app.get<AuthService>(AuthService);
  });

  beforeEach(async () => {
    // Clear database before each test
    await clearDatabase(prisma);
    // Reset mocks on ctx if they are stateful across calls within a single test
    // jest.clearAllMocks() can be used if spies are created with jest.spyOn
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/start command', () => {
    it('should prompt a new user for phone number consent', async () => {
      const mockCtx = createMockContext({ id: 111, username: 'newuser' }, { text: '/start' });

      await startHandler.handle(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('need your phone number'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '✅ I agree', callback_data: 'agree_phone' }),
                expect.objectContaining({ text: '❌ I decline', callback_data: 'decline_phone' }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should welcome back a registered user', async () => {
      // Create a user directly in DB
      await prisma.user.create({
        data: {
          telegramId: BigInt(222),
          firstName: 'Registered',
          username: 'registereduser',
          timezone: 'Asia/Tashkent', // Ensure all required fields are present
        },
      });
      const mockCtx = createMockContext({ id: 222, username: 'registereduser' }, { text: '/start' });

      await startHandler.handle(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Welcome back, Registered!'),
      );
    });
  });

  describe('Registration Flow', () => {
    const NEW_USER_TELEGRAM_ID = 333;
    const NEW_USER_USERNAME = 'consentuser';

    it('user agrees to share phone: should ask to send contact via button', async () => {
      const mockCtx = createMockContext(
        { id: NEW_USER_TELEGRAM_ID, username: NEW_USER_USERNAME },
        {}, // No initial message, this is a callback
        { data: 'agree_phone' },
      );
      
      // Simulate that the consent prompt message exists and can be edited
      mockCtx.editMessageReplyMarkup.mockResolvedValue(true as any);


      await contactHandler.handleConsentResponse(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Please click the button below to share your phone number'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '📲 Send my number', request_contact: true }),
              ]),
            ]),
            resize_keyboard: true,
          }),
        }),
      );
      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledTimes(1); // Ensure original inline kbd is removed
    });
    
    it('user declines to share phone: should send an explanation message', async () => {
      const mockCtx = createMockContext(
        { id: NEW_USER_TELEGRAM_ID, username: NEW_USER_USERNAME },
        {},
        { data: 'decline_phone' },
      );
      mockCtx.editMessageReplyMarkup.mockResolvedValue(true as any);

      await contactHandler.handleConsentResponse(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining("I understand. You can continue using basic features")
      );
      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledTimes(1);
    });

    it('user shares contact: should register the user and send confirmation', async () => {
      const phoneNumber = '+1234567890';
      const mockCtx = createMockContext(
        { id: NEW_USER_TELEGRAM_ID, username: NEW_USER_USERNAME, first_name: 'Shared' },
        { 
          contact: { 
            phone_number: phoneNumber, 
            first_name: 'Shared', 
            user_id: NEW_USER_TELEGRAM_ID // Important: contact user_id must match sender
          } 
        },
      );

      await contactHandler.handle(mockCtx);

      // Verify DB
      const userInDb = await prisma.user.findUnique({ where: { telegramId: BigInt(NEW_USER_TELEGRAM_ID) } });
      expect(userInDb).not.toBeNull();
      expect(userInDb?.phoneNumber).toBe(phoneNumber);
      expect(userInDb?.firstName).toBe('Shared');

      // Verify reply
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Thank you! You have been successfully registered.'),
        expect.objectContaining({
          reply_markup: { remove_keyboard: true },
        }),
      );
    });

    it('user shares contact not their own: should reject and prompt again', async () => {
        const anotherUserId = 99999; // Different from sender
        const phoneNumber = '+1999999999';
        const mockCtx = createMockContext(
          { id: NEW_USER_TELEGRAM_ID, username: NEW_USER_USERNAME, first_name: 'Shared' },
          { 
            contact: { 
              phone_number: phoneNumber, 
              first_name: 'OtherUser', 
              user_id: anotherUserId 
            } 
          },
        );
  
        await contactHandler.handle(mockCtx);
  
        // Verify DB (user should NOT be created or updated with this contact)
        const userInDb = await prisma.user.findUnique({ where: { telegramId: BigInt(NEW_USER_TELEGRAM_ID) } });
        // This depends on whether an initial user record might exist or if upsert is used.
        // For a new user, they shouldn't be in DB. If upserting an existing user with wrong contact, check fields didn't change.
        // Assuming this is a new user for simplicity:
        if (userInDb) { // If a user record was somehow created before this specific contact interaction
            expect(userInDb.phoneNumber).toBeNull(); // Or not equal to the shared contact's number
        } else {
            expect(userInDb).toBeNull(); // Better to ensure no user record if this is the first interaction
        }
  
        // Verify reply
        expect(mockCtx.reply).toHaveBeenCalledTimes(1);
        expect(mockCtx.reply).toHaveBeenCalledWith(
          expect.stringContaining('For security reasons, I can only accept your own phone number.'),
          expect.objectContaining({
            reply_markup: expect.objectContaining({
                keyboard: expect.arrayContaining([
                  expect.arrayContaining([
                    expect.objectContaining({ text: '📲 Send my number', request_contact: true }),
                  ]),
                ]),
            })
          }),
        );
      });
  });
});
