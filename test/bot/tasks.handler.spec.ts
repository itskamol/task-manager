import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { ConfigModule } from '@nestjs/config';
import { TasksHandler } from '../../src/tasks/handlers/tasks.handler';
import { PrismaClient, User, Task, Priority, Status } from '@prisma/client';
import { 
    clearDatabase, 
    createMockContext, 
    createUser as dbCreateUser,
    createTask as dbCreateTask 
} from '../utils/test-utils';
import { DeepMocked } from 'jest-mock-extended';
import { Context } from 'grammy';
import { formatInUserTz } from '../../src/tasks/utils/time.utils'; // For verifying date formats
import { AiService } from '../../src/ai/ai.service';

describe('TasksHandler Bot Interactions', () => {
  let app: TestingModule;
  let tasksHandler: TasksHandler;
  let prisma: PrismaClient;
  let testUser: User;
  let mockCtx: DeepMocked<Context>;
  let aiService: AiService; // To mock optimizeSchedule for predictable list order

  const USER_TELEGRAM_ID = 789;
  const USER_USERNAME = 'taskhandleruser';
  const USER_TIMEZONE = 'America/Los_Angeles';

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        AppModule, // Provides TasksHandler, TasksService, AuthService, AiService, PrismaClient, etc.
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
      ],
    }).compile();

    tasksHandler = app.get<TasksHandler>(TasksHandler);
    prisma = app.get<PrismaClient>(PrismaClient);
    aiService = app.get<AiService>(AiService);

    // Create a user once for all tests in this suite
    await clearDatabase(prisma); // Clear before creating the initial user
    testUser = await dbCreateUser(prisma, { 
      telegramId: BigInt(USER_TELEGRAM_ID), 
      username: USER_USERNAME,
      timezone: USER_TIMEZONE,
      firstName: "TaskTest"
    });
  });

  beforeEach(async () => {
    // Clear only tasks and reminders before each test, user remains
    await prisma.reminder.deleteMany({});
    await prisma.task.deleteMany({ where: { userId: testUser.id } });
    
    mockCtx = createMockContext({ id: USER_TELEGRAM_ID, username: USER_USERNAME });
  });

  afterAll(async () => {
    await clearDatabase(prisma); // Clean up the user
    await app.close();
  });

  describe('handleAddTask', () => {
    it('should reply with correctly formatted success message for a new task', async () => {
      const taskText = '/add Urgent meeting about project X tomorrow at 2pm';
      mockCtx.message = {
        ...mockCtx.message!,
        text: taskText,
      };

      // Mock the result of createTaskWithAISuggestions to have predictable output for formatting checks
      // This focuses the test on the handler's formatting, not the service's AI logic.
      const tasksService = app.get<TasksService>(TasksService);
      const mockCreatedTask: Task = {
        id: 'task-id-1',
        userId: testUser.id,
        title: 'Urgent meeting about project X tomorrow at 2pm',
        description: null,
        status: Status.PENDING,
        priority: Priority.HIGH, // Assuming AI determined this
        deadline: new Date('2024-07-26T14:00:00.000Z'), // Assuming AI parsed this
        timezone: USER_TIMEZONE,
        repeat: 'NONE',
        estimatedTime: 60, // Assuming AI determined this
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.spyOn(tasksService, 'createTaskWithAISuggestions').mockResolvedValue(mockCreatedTask);

      await tasksHandler.handleAddTask(mockCtx);

      const expectedPriorityEmoji = '🔴'; // From tasksHandler.getPriorityEmoji(Priority.HIGH)
      const formattedDeadline = formatInUserTz(mockCreatedTask.deadline, USER_TIMEZONE);
      
      const expectedReply = 
        `✅ Task created: ${mockCreatedTask.title}\n` +
        `Priority: ${expectedPriorityEmoji} ${mockCreatedTask.priority}\n` +
        `Deadline: ${formattedDeadline} (${USER_TIMEZONE})\n` +
        `Estimated time: ${mockCreatedTask.estimatedTime} minutes\n\n` +
        'Use /set_deadline or /set_priority to adjust these suggestions.';

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(expectedReply);
      
      jest.restoreAllMocks();
    });

    it('should reply with "Please provide a task title" if title is missing', async () => {
        mockCtx.message = { ...mockCtx.message!, text: '/add' };
        await tasksHandler.handleAddTask(mockCtx);
        expect(mockCtx.reply).toHaveBeenCalledWith('Please provide a task title. Example: /add Buy groceries');
    });
  });

  describe('handleListTasks', () => {
    it('should reply with "You have no tasks..." if no tasks exist for the user', async () => {
      mockCtx.message = { ...mockCtx.message!, text: '/list' };
      await tasksHandler.handleListTasks(mockCtx);
      expect(mockCtx.reply).toHaveBeenCalledWith('You have no tasks. Use /add to create one!');
    });

    it('should list tasks with correct formatting for status, priority, title, deadline, and estimated time', async () => {
      const task1Date = new Date('2024-08-01T10:00:00.000Z');
      const task1: Task = await dbCreateTask(prisma, {
        userId: testUser.id, title: 'Task One (High)', priority: Priority.HIGH, status: Status.PENDING,
        deadline: task1Date, estimatedTime: 30, timezone: USER_TIMEZONE,
      });
      const task2: Task = await dbCreateTask(prisma, {
        userId: testUser.id, title: 'Task Two (Medium, Done)', priority: Priority.MEDIUM, status: Status.DONE,
        deadline: null, estimatedTime: 60, timezone: USER_TIMEZONE,
      });
      const task3: Task = await dbCreateTask(prisma, {
        userId: testUser.id, title: 'Task Three (Low)', priority: Priority.LOW, status: Status.PENDING,
        deadline: null, estimatedTime: null, timezone: USER_TIMEZONE,
      });

      // Mock optimizeSchedule to return tasks in a fixed order for predictable assertions
      const orderedTasks = [task1, task2, task3]; // Example order
      jest.spyOn(aiService, 'optimizeSchedule').mockResolvedValue(orderedTasks);

      mockCtx.message = { ...mockCtx.message!, text: '/list' };
      await tasksHandler.handleListTasks(mockCtx);

      const statusEmojiPending = '⏳';
      const statusEmojiDone = '✅';
      const prioEmojiHigh = '🔴';
      const prioEmojiMedium = '🟡';
      const prioEmojiLow = '🟢';

      const formattedDeadlineTask1 = formatInUserTz(task1.deadline, USER_TIMEZONE);

      const expectedTask1Str = `${statusEmojiPending} ${prioEmojiHigh} ${task1.title}\nDeadline: ${formattedDeadlineTask1} (${USER_TIMEZONE})\nEstimated: ${task1.estimatedTime} minutes`;
      const expectedTask2Str = `${statusEmojiDone} ${prioEmojiMedium} ${task2.title}\nEstimated: ${task2.estimatedTime} minutes`; // No deadline
      const expectedTask3Str = `${statusEmojiPending} ${prioEmojiLow} ${task3.title}`; // No deadline, no estimated time

      const expectedReply = 
        '📋 Your tasks (optimized by priority and deadline):\n\n' +
        `${expectedTask1Str}\n\n` +
        `${expectedTask2Str}\n\n` +
        `${expectedTask3Str}\n\n` +
        'Use /add to create a new task.';
        
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(expectedReply);
      
      jest.restoreAllMocks();
    });
  });
});
