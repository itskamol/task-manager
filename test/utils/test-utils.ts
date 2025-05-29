import { Context } from 'grammy';
import { mockDeep, DeepMocked } from 'jest-mock-extended';
import { PrismaClient, User, Task, Reminder } from '@prisma/client'; // Assuming PrismaClient types

// Default From details for a typical user
const defaultFrom = {
  id: 123456789,
  is_bot: false,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  language_code: 'en',
};

// Default Chat details for a private chat
const defaultChat = {
  id: 123456789, // Same as user ID for private chats
  type: 'private' as const,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
};

export function createMockContext(
  fromDetails: Partial<Context['from']> = {},
  messageDetails: Partial<Context['message']> = {},
  callbackQueryDetails: Partial<Context['callbackQuery']> = {},
): DeepMocked<Context> {
  const ctx = mockDeep<Context>();

  // From (User)
  ctx.from = {
    ...defaultFrom,
    ...fromDetails,
  };

  // Message
  if (Object.keys(messageDetails).length > 0 || !callbackQueryDetails.data) { // Default to message if no callback
    const effectiveMessageDetails = {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: {
        ...defaultChat,
        id: ctx.from?.id || defaultChat.id, // Ensure chat ID matches from ID for private
        first_name: ctx.from?.first_name,
        last_name: ctx.from?.last_name,
        username: ctx.from?.username,
      },
      text: '', // Default empty text
      ...messageDetails,
    };
    ctx.message = effectiveMessageDetails as Context['message'];

    // Common alias
    if (ctx.message?.text) {
        ctx.msg = ctx.message;
    }
  }


  // Callback Query
  if (Object.keys(callbackQueryDetails).length > 0) {
    const effectiveCallbackQueryDetails = {
      id: 'testqueryid',
      from: { // Callback query also has a 'from' user
        ...defaultFrom,
        ...fromDetails, // ensure consistency
      },
      message: ctx.message, // Callbacks are often tied to a message
      chat_instance: String(ctx.from?.id || defaultChat.id),
      data: '', // Default empty data
      ...callbackQueryDetails,
    };
    ctx.callbackQuery = effectiveCallbackQueryDetails as Context['callbackQuery'];
  }
  
  // Mock common reply functions
  // These are often what you'll spy on or check calls for
  ctx.reply.mockResolvedValue(mockDeep<Context['message']>() as any); // grammy >v1.18.0 returns Message.Full variants
  ctx.answerCallbackQuery.mockResolvedValue(true);
  ctx.editMessageText.mockResolvedValue(true as any); // Can be boolean or Message
  ctx.editMessageReplyMarkup.mockResolvedValue(true as any); 
  ctx.deleteMessage.mockResolvedValue(true);
  ctx.api.sendMessage.mockResolvedValue(mockDeep<Context['message']>() as any);

  return ctx;
}

export async function clearDatabase(prisma: PrismaClient): Promise<void> {
  // Order matters due to foreign key constraints
  // Start with models that are depended upon by others, or use cascade if configured
  // For this schema: Reminder depends on Task, Task depends on User.
  // So, delete in reverse order: Reminder -> Task -> User
  
  console.log('Clearing database for test...');
  try {
    // Check if Prisma is connected, or connect
    // This is usually handled by NestJS lifecycle, but for direct util usage:
    // await prisma.$connect(); // Not always needed if PrismaClient is already managed by NestJS

    await prisma.reminder.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('Database cleared.');
  } catch (error) {
    console.error('Error clearing database:', error);
    // await prisma.$disconnect(); // Disconnect if we connected manually
    throw error; // Re-throw to fail the test if DB clearing fails
  } finally {
    // await prisma.$disconnect(); // Disconnect if we connected manually
  }
}

// Basic User creation helper
export async function createUser(
    prisma: PrismaClient,
    userData: Partial<User> & { telegramId: bigint }, // Ensure telegramId is provided
): Promise<User> {
    const defaultUser: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'telegramId'> = {
        firstName: 'Test',
        lastName: 'User',
        username: `testuser${userData.telegramId}`,
        phoneNumber: null,
        timezone: 'Asia/Tashkent',
    };

    return prisma.user.create({
        data: {
            ...defaultUser,
            ...userData,
            telegramId: userData.telegramId, // Ensure it's part of the data spread
        },
    });
}

// Basic Task creation helper
export async function createTask(
    prisma: PrismaClient,
    taskData: Partial<Task> & { userId: string; title: string }, // Ensure userId and title are provided
): Promise<Task> {
    const defaultTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'title'> = {
        description: null,
        status: 'PENDING',
        priority: 'MEDIUM',
        deadline: null,
        timezone: 'Asia/Tashkent',
        repeat: 'NONE',
        estimatedTime: null,
    };

    return prisma.task.create({
        data: {
            ...defaultTask,
            ...taskData,
        },
    });
}
