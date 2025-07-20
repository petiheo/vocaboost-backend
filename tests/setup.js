beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.FROM_EMAIL = 'test@vocaboost.com';
});

afterAll(() => {
  // Cleanup
  jest.clearAllTimers();
  jest.clearAllMocks();
});
