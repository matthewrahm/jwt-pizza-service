const { StatusCodeError, asyncHandler } = require('./endpointHelper.js');

describe('endpointHelper', () => {
  describe('StatusCodeError', () => {
    test('sets message and statusCode', () => {
      const err = new StatusCodeError('not found', 404);
      expect(err.message).toBe('not found');
      expect(err.statusCode).toBe(404);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('asyncHandler', () => {
    test('calls the handler and resolves', async () => {
      const handler = jest.fn((req, res) => {
        res.json({ ok: true });
        return Promise.resolve();
      });
      const wrapped = asyncHandler(handler);
      const req = {};
      const res = { json: jest.fn() };
      const next = jest.fn();
      await wrapped(req, res, next);
      expect(handler).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    test('catches errors and calls next', async () => {
      const error = new Error('fail');
      const handler = jest.fn(() => Promise.reject(error));
      const wrapped = asyncHandler(handler);
      const next = jest.fn();
      await wrapped({}, {}, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
