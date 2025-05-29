import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../../src/ai/ai.service';
import { AiModule } from '../../src/ai/ai.module';
import { ConfigModule } from '@nestjs/config';
import { Priority, Task } from '@prisma/client'; // Assuming Task type is used

describe('AiService (E2E-like Unit Test)', () => {
  let app: TestingModule;
  let aiService: AiService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        AiModule, // Import the module that provides AiService
        ConfigModule.forRoot({
          envFilePath: '.env.test', // Load test environment, though AiService might not use it directly
          isGlobal: true,
        }),
      ],
    }).compile();

    aiService = app.get<AiService>(AiService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('analyzePriority', () => {
    it('should return HIGH for urgent keywords', () => {
      expect(aiService.analyzePriority('Urgent task')).toBe(Priority.HIGH);
      expect(aiService.analyzePriority('ASAP meeting')).toBe(Priority.HIGH);
      expect(aiService.analyzePriority('Emergency fix required')).toBe(Priority.HIGH);
      expect(aiService.analyzePriority('Critical update')).toBe(Priority.HIGH);
      expect(aiService.analyzePriority('A task that is urgent and important', 'Needs to be done ASAP')).toBe(Priority.HIGH);
    });

    it('should return MEDIUM for important keywords (if no HIGH keywords)', () => {
      expect(aiService.analyzePriority('Important discussion')).toBe(Priority.MEDIUM);
      expect(aiService.analyzePriority('This is needed soon')).toBe(Priority.MEDIUM);
      expect(aiService.analyzePriority('Required setup for demo')).toBe(Priority.MEDIUM);
      expect(aiService.analyzePriority('Task for soon')).toBe(Priority.MEDIUM);
    });

    it('should return LOW for neutral or no keywords', () => {
      expect(aiService.analyzePriority('Regular task')).toBe(Priority.LOW);
      expect(aiService.analyzePriority('Simple chore')).toBe(Priority.LOW);
      expect(aiService.analyzePriority('')).toBe(Priority.LOW); // Empty title
      expect(aiService.analyzePriority('No keywords here', '')).toBe(Priority.LOW); // Empty description
    });
    
    it('should prioritize HIGH keywords over MEDIUM keywords', () => {
      expect(aiService.analyzePriority('Urgent and important task')).toBe(Priority.HIGH);
    });

    it('should handle undefined description', () => {
      expect(aiService.analyzePriority('Urgent task', undefined)).toBe(Priority.HIGH);
      expect(aiService.analyzePriority('Important task', undefined)).toBe(Priority.MEDIUM);
      expect(aiService.analyzePriority('Low priority task', undefined)).toBe(Priority.LOW);
    });
  });

  describe('suggestDeadline', () => {
    const now = Date.now();
    const mockTask = (priority: Priority): Task => ({
      id: 'mock-task-id',
      userId: 'mock-user-id',
      title: 'Mock Task',
      description: null,
      status: 'PENDING',
      priority, // Key field for this test
      deadline: null,
      timezone: 'UTC',
      repeat: 'NONE',
      estimatedTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should suggest ~24 hours for HIGH priority tasks', () => {
      const task = mockTask(Priority.HIGH);
      const suggested = aiService.suggestDeadline(task);
      expect(suggested).not.toBeNull();
      const expectedDeadline = new Date(now + 24 * 60 * 60 * 1000);
      // Allow a small buffer for execution time variance
      expect(suggested!.getTime()).toBeGreaterThanOrEqual(expectedDeadline.getTime() - 1000);
      expect(suggested!.getTime()).toBeLessThanOrEqual(expectedDeadline.getTime() + 1000);
    });

    it('should suggest ~3 days for MEDIUM priority tasks', () => {
      const task = mockTask(Priority.MEDIUM);
      const suggested = aiService.suggestDeadline(task);
      expect(suggested).not.toBeNull();
      const expectedDeadline = new Date(now + 3 * 24 * 60 * 60 * 1000);
      expect(suggested!.getTime()).toBeGreaterThanOrEqual(expectedDeadline.getTime() - 1000);
      expect(suggested!.getTime()).toBeLessThanOrEqual(expectedDeadline.getTime() + 1000);
    });

    it('should suggest ~7 days for LOW priority tasks', () => {
      const task = mockTask(Priority.LOW);
      const suggested = aiService.suggestDeadline(task);
      expect(suggested).not.toBeNull();
      const expectedDeadline = new Date(now + 7 * 24 * 60 * 60 * 1000);
      expect(suggested!.getTime()).toBeGreaterThanOrEqual(expectedDeadline.getTime() - 1000);
      expect(suggested!.getTime()).toBeLessThanOrEqual(expectedDeadline.getTime() + 1000);
    });
  });

  describe('estimateTaskDuration', () => {
    it('should return 30 mins for "quick" or "simple" keywords', () => {
      expect(aiService.estimateTaskDuration('Quick email')).toBe(30);
      expect(aiService.estimateTaskDuration('Simple update', 'Just a quick change')).toBe(30);
    });

    it('should return 60 mins for "meeting" or "call" keywords', () => {
      expect(aiService.estimateTaskDuration('Team meeting')).toBe(60);
      expect(aiService.estimateTaskDuration('Client call', 'Discuss project updates')).toBe(60);
    });

    it('should return 120 mins for other text', () => {
      expect(aiService.estimateTaskDuration('Plan project phase')).toBe(120);
      expect(aiService.estimateTaskDuration('Develop new feature', 'Complex logic involved')).toBe(120);
    });

    it('should return 120 mins for empty or undefined inputs', () => {
      expect(aiService.estimateTaskDuration('')).toBe(120); // Default for empty title
      expect(aiService.estimateTaskDuration('Generic task', '')).toBe(120); // Empty description
      expect(aiService.estimateTaskDuration('Generic task', undefined)).toBe(120);
    });
  });
  
  describe('optimizeSchedule', () => {
    const createMockTask = (
        id: string, 
        priority: Priority, 
        deadline?: Date | null, 
        estimatedTime?: number | null
    ): Task => ({
        id, userId: 'user1', title: `Task ${id}`, priority, 
        deadline: deadline || null, 
        estimatedTime: estimatedTime || null,
        description: null, status: 'PENDING', timezone: 'UTC', repeat: 'NONE',
        createdAt: new Date(), updatedAt: new Date(),
    });

    it('should sort by priority (HIGH > MEDIUM > LOW)', async () => {
        const tasks: Task[] = [
            createMockTask('1', Priority.MEDIUM),
            createMockTask('2', Priority.HIGH),
            createMockTask('3', Priority.LOW),
        ];
        const optimized = await aiService.optimizeSchedule(tasks);
        expect(optimized.map(t => t.id)).toEqual(['2', '1', '3']);
    });

    it('should sort by deadline (earlier first) for same priority', async () => {
        const now = new Date();
        const tasks: Task[] = [
            createMockTask('1', Priority.HIGH, new Date(now.getTime() + 2 * 60 * 60 * 1000)), // +2h
            createMockTask('2', Priority.HIGH, new Date(now.getTime() + 1 * 60 * 60 * 1000)), // +1h
        ];
        const optimized = await aiService.optimizeSchedule(tasks);
        expect(optimized.map(t => t.id)).toEqual(['2', '1']);
    });

    it('should sort by estimatedTime (shorter first) for same priority and deadline', async () => {
        const now = new Date();
        const deadline = new Date(now.getTime() + 1 * 60 * 60 * 1000);
        const tasks: Task[] = [
            createMockTask('1', Priority.HIGH, deadline, 60),
            createMockTask('2', Priority.HIGH, deadline, 30),
        ];
        const optimized = await aiService.optimizeSchedule(tasks);
        expect(optimized.map(t => t.id)).toEqual(['2', '1']);
    });

    it('should handle tasks with missing deadlines or estimated times correctly', async () => {
        const now = new Date();
        const tasks: Task[] = [
            createMockTask('1', Priority.HIGH, new Date(now.getTime() + 1 * 60 * 60 * 1000)), // Has deadline
            createMockTask('2', Priority.HIGH, null, 30), // No deadline, has time
            createMockTask('3', Priority.HIGH, null, 60), // No deadline, has time
            createMockTask('4', Priority.HIGH, new Date(now.getTime() + 2 * 60 * 60 * 1000)), // Has deadline
        ];
        // Expected: Task1 (deadline), Task4 (deadline), Task2 (no deadline, shorter time), Task3 (no deadline, longer time)
        // The AI logic sorts tasks with deadlines before tasks without deadlines (if both are same priority).
        // Then, for tasks without deadlines, it sorts by estimatedTime if available.
        const optimized = await aiService.optimizeSchedule(tasks);
        expect(optimized.map(t => t.id)).toEqual(['1', '4', '2', '3']);
    });

    it('should maintain original order for tasks with same priority, deadline, and estimated time', async () => {
        const tasks: Task[] = [
            createMockTask('1', Priority.MEDIUM),
            createMockTask('2', Priority.MEDIUM),
        ];
        const optimized = await aiService.optimizeSchedule(tasks);
        // Current sort is stable for items that are "equal" according to criteria.
        expect(optimized.map(t => t.id)).toEqual(['1', '2']);
    });
  });
});
