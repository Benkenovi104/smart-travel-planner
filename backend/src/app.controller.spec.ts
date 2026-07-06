import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

describe('AppController', () => {
  let appController: AppController;
  const getHealth = jest.fn();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: { getHealth } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should delegate to AppService#getHealth', async () => {
      getHealth.mockResolvedValue({
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
      });

      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
      });
    });
  });
});
