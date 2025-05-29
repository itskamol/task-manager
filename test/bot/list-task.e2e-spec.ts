import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaClient, User, Task, Priority } from '@prisma/client';
import { TasksHandler } from '../../src/tasks/handlers/tasks.handler';
// import { TasksService } from '../../src/tasks/services/tasks.service'; // For direct DB interaction if needed
import { AuthService } from '../../src/bot/services/auth.service';
import { 
    clearDatabase, 
    createMockContext, 
    createUser as dbCreateUser,
    createTask as dbCreateTask 
} from '../utils/test-utils';
import { DeepMocked } from 'jest-mock-extended';
import { Context } from 'grammy';
import { ConfigModule } from '@nestjs/config';
import { AiService } from '../../src/ai/ai.service'; // AiService is used by TasksHandler for optimizeSchedule

describe('Bot /list Command (E2E)', () => {
  let app: TestingModule;
  let prisma: PrismaClient;
  let tasksHandler: TasksHandler;
  let aiService: AiService; // For mocking optimizeSchedule if needed for predictable sort order
  let testUser: User;

  const USER_TELEGRAM_ID = 2002;
  const USER_USERNAME = 'tasklister';
  const USER_TIMEZONE = 'America/New_York';

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
    aiService = app.get<AiService>(AiService); // Get AiService instance
    
    await clearDatabase(prisma);
    testUser = await dbCreateUser(prisma, { 
      telegramId: BigInt(USER_TELEGRAM_ID), 
      username: USER_USERNAME,
      timezone: USER_TIMEZONE,
      firstName: "List"
    });
  });

  beforeEach(async () => {
    // Clear only tasks and reminders before each test, user remains
    await prisma.reminder.deleteMany({});
    await prisma.task.deleteMany({ where: { userId: testUser.id } });
  });

  afterAll(async () => {
    await clearDatabase(prisma); // Clean up the user and any remaining data
    await app.close();
  });

  it('should inform the user if they have no tasks', async () => {
    const mockCtx = createMockContext(
      { id: USER_TELEGRAM_ID, username: USER_USERNAME },
      { text: '/list' },
    );

    await tasksHandler.handleListTasks(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      'You have no tasks. Use /add to create one!'
    );
  });

  it('should list multiple tasks with their details, sorted by AI', async () => {
    // Create tasks with varying properties
    const task1 = await dbCreateTask(prisma, { 
        userId: testUser.id, 
        title: 'Task 1 - Medium Prio, Later Deadline', 
        priority: Priority.MEDIUM,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        estimatedTime: 60 
    });
    const task2 = await dbCreateTask(prisma, { 
        userId: testUser.id, 
        title: 'Task 2 - High Prio, Earlier Deadline', 
        priority: Priority.HIGH,
        deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
        estimatedTime: 30
    });
    const task3 = await dbCreateTask(prisma, { 
        userId: testUser.id, 
        title: 'Task 3 - Low Prio, No Deadline', 
        priority: Priority.LOW,
        estimatedTime: 120
    });

    // Mock aiService.optimizeSchedule to return tasks in a predictable order for assertion
    // For this test, let's assume the default sort: HIGH, MEDIUM, LOW
    // If deadlines are equal, then by estimatedTime (shorter first)
    // The actual AI logic is: Priority (desc), Deadline (asc), EstimatedTime (asc)
    const expectedSortedTasks = [task2, task1, task3]; // Based on AI logic: High Prio first, then Medium, then Low
    
    jest.spyOn(aiService, 'optimizeSchedule').mockResolvedValue(expectedSortedTasks);


    const mockCtx = createMockContext(
      { id: USER_TELEGRAM_ID, username: USER_USERNAME },
      { text: '/list' },
    );

    await tasksHandler.handleListTasks(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    const replyText = mockCtx.reply.mock.calls[0][0] as string;
    
    expect(replyText).toContain('📋 Your tasks (optimized by priority and deadline):');
    // Check if tasks appear in the expected order in the reply
    // This requires knowing the exact formatting from TasksHandler.getPriorityEmoji and formatInUserTz
    // For simplicity, we'll check for titles in order.
    const task2Index = replyText.indexOf(task2.title);
    const task1Index = replyText.indexOf(task1.title);
    const task3Index = replyText.indexOf(task3.title);

    expect(task2Index).toBeGreaterThan(-1);
    expect(task1Index).toBeGreaterThan(-1);
    expect(task3Index).toBeGreaterThan(-1);

    expect(task2Index).toBeLessThan(task1Index); // Task 2 (High Prio) should appear before Task 1 (Medium Prio)
    expect(task1Index).toBeLessThan(task3Index); // Task 1 (Medium Prio) should appear before Task 3 (Low Prio)

    // Also check for specific details (e.g., priority emoji, deadline for task2)
    expect(replyText).toContain(`🔴 ${task2.title}`); // High priority emoji
    expect(replyText).toContain(`Estimated: ${task2.estimatedTime} minutes`);
    // Add check for deadline formatting if necessary, using formatInUserTz from test-utils or re-importing
    
    jest.restoreAllMocks(); // Clean up spy
  });
  
  it('should list tasks for a user who is not registered (user not found by authService)', async () => {
    const NON_EXISTENT_USER_ID = 7890;
    const mockCtx = createMockContext(
      { id: NON_EXISTENT_USER_ID, username: 'nosuchuser' },
      { text: '/list' },
    );

    // Spy on authService.getUser to simulate user not found
    const authServiceInstance = app.get<AuthService>(AuthService);
    jest.spyOn(authServiceInstance, 'getUser').mockResolvedValue(null);

    await tasksHandler.handleListTasks(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      'Could not find your user information. Please try /start again.'
    );
    
    jest.restoreAllMocks(); // Clean up spy
  });

});
