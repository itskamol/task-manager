import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaClient, User } from '@prisma/client';
import { TasksHandler } from '../../src/tasks/handlers/tasks.handler';
import { TasksService } from '../../src/tasks/services/tasks.service';
import { AuthService } from '../../src/bot/services/auth.service';
import { clearDatabase, createMockContext, createUser as dbCreateUser } from '../utils/test-utils'; // Renamed createUser to dbCreateUser
import { DeepMocked } from 'jest-mock-extended';
import { Context } from 'grammy';
import { ConfigModule } from '@nestjs/config';

describe('Bot /add Command (E2E)', () => {
  let app: TestingModule;
  let prisma: PrismaClient;
  let tasksHandler: TasksHandler;
  // let tasksService: TasksService; // To verify DB changes directly if needed
  let testUser: User;

  const USER_TELEGRAM_ID = 1001;
  const USER_USERNAME = 'taskadder';
  const USER_TIMEZONE = 'Europe/Berlin';

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        AppModule,
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
      ],
    }).compile();

    prisma = app.get<PrismaClient>(PrismaClient);
    tasksHandler = app.get<TasksHandler>(TasksHandler);
    // tasksService = app.get<TasksService>(TasksService);
    
    // Clear DB and create a user once for all tests in this suite
    await clearDatabase(prisma);
    testUser = await dbCreateUser(prisma, { 
      telegramId: BigInt(USER_TELEGRAM_ID), 
      username: USER_USERNAME,
      timezone: USER_TIMEZONE,
      firstName: "Task"
    });
  });
  
  beforeEach(async () => {
    // Clear only tasks before each test, user remains
    await prisma.reminder.deleteMany({});
    await prisma.task.deleteMany({});
    // Mock clear for context methods
    // This will be handled by creating a new mockCtx for each test
  });

  afterAll(async () => {
    await clearDatabase(prisma); // Clean up the user after all tests
    await app.close();
  });

  it('should add a new task with full details provided', async () => {
    const taskText = '/add Buy milk and eggs for breakfast';
    const mockCtx = createMockContext(
      { id: USER_TELEGRAM_ID, username: USER_USERNAME },
      { text: taskText },
    );

    await tasksHandler.handleAddTask(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('✅ Task created: Buy milk and eggs for breakfast'),
      // We can also check for priority, deadline, estimated time if AI suggestions are stable
      // For now, checking title is a good start.
    );

    const tasksInDb = await prisma.task.findMany({ where: { userId: testUser.id } });
    expect(tasksInDb.length).toBe(1);
    expect(tasksInDb[0].title).toBe('Buy milk and eggs for breakfast');
    expect(tasksInDb[0].userId).toBe(testUser.id);
    expect(tasksInDb[0].timezone).toBe(USER_TIMEZONE); // Check if user's timezone is applied
    // Further checks for priority, estimatedTime, and deadline can be added
    // based on the behavior of `createTaskWithAISuggestions`
    // For example, if 'breakfast' suggests HIGH priority:
    // expect(tasksInDb[0].priority).toBe('HIGH');
  });

  it('should add a new task with minimal input (title only)', async () => {
    const taskText = '/add A very simple task';
    const mockCtx = createMockContext(
      { id: USER_TELEGRAM_ID, username: USER_USERNAME },
      { text: taskText },
    );

    await tasksHandler.handleAddTask(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('✅ Task created: A very simple task'),
    );

    const tasksInDb = await prisma.task.findMany({ where: { userId: testUser.id } });
    expect(tasksInDb.length).toBe(1);
    expect(tasksInDb[0].title).toBe('A very simple task');
    // Default priority (e.g., LOW or MEDIUM) and other AI suggestions would be applied here
    // Example: expect(tasksInDb[0].priority).toBe('LOW');
  });

  it('should inform the user if no task title is provided', async () => {
    const taskText = '/add'; // No title
    const mockCtx = createMockContext(
      { id: USER_TELEGRAM_ID, username: USER_USERNAME },
      { text: taskText },
    );

    await tasksHandler.handleAddTask(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      'Please provide a task title. Example: /add Buy groceries'
    );

    const tasksInDb = await prisma.task.findMany({ where: { userId: testUser.id } });
    expect(tasksInDb.length).toBe(0); // No task should be created
  });
  
  // Optional: Test for non-registered user if applicable (depends on guards/auth checks)
  // This test assumes that if a user is not found by authService.getUser, a message is sent.
  // The current TasksHandler relies on authService.getUser, so this is a valid scenario.
  it('should not add a task if the user is not found/registered', async () => {
    const NON_EXISTENT_USER_ID = 9999;
    const taskText = '/add This task should not be added';
    const mockCtx = createMockContext(
      { id: NON_EXISTENT_USER_ID, username: 'ghostuser' },
      { text: taskText },
    );

    // Mock authService.getUser to return null for this specific user
    // This requires getting the authService instance and spying on it.
    const authServiceInstance = app.get<AuthService>(AuthService);
    jest.spyOn(authServiceInstance, 'getUser').mockImplementation(async (telegramId) => {
        if (telegramId === BigInt(NON_EXISTENT_USER_ID)) {
            return null;
        }
        // Fallback for other calls if any (though not expected in this test)
        return dbCreateUser(prisma, {telegramId, username: 'fallback'}); 
    });


    await tasksHandler.handleAddTask(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      'Could not find your user information. Please try /start again.'
    );

    const tasksInDb = await prisma.task.findMany({ where: { user: { telegramId: BigInt(NON_EXISTENT_USER_ID) } } });
    expect(tasksInDb.length).toBe(0);

    // Restore the original implementation after the test
    jest.restoreAllMocks();
  });

});
