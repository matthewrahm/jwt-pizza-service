jest.useFakeTimers();

jest.mock('./config.js', () => ({
  metrics: {
    source: 'test-source',
    endpointUrl: 'http://test-grafana/api/v1/push',
    apiKey: 'test-api-key',
    accountId: 'test-account-id',
  },
}));

const metrics = require('./metrics.js');

describe('Metrics', () => {
  beforeEach(() => {
    metrics.totalRequests = 0;
    metrics.getRequests = 0;
    metrics.postRequests = 0;
    metrics.putRequests = 0;
    metrics.deleteRequests = 0;
    metrics.activeUsers.clear();
    metrics.authSuccessCount = 0;
    metrics.authFailureCount = 0;
    metrics.pizzasSold = 0;
    metrics.pizzaFailures = 0;
    metrics.revenue = 0;
    metrics.latencySum = 0;
    metrics.latencyCount = 0;
    metrics.pizzaLatencySum = 0;
    metrics.pizzaLatencyCount = 0;
    jest.clearAllMocks();
  });

  describe('requestTracker', () => {
    function makeReq(method) {
      return { method };
    }
    function makeRes() {
      const listeners = {};
      return {
        on: jest.fn((event, cb) => {
          listeners[event] = cb;
        }),
        _fire: (event) => listeners[event] && listeners[event](),
      };
    }

    test('tracks GET request', () => {
      const next = jest.fn();
      const res = makeRes();
      metrics.requestTracker(makeReq('GET'), res, next);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.getRequests).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    test('tracks POST request', () => {
      const next = jest.fn();
      const res = makeRes();
      metrics.requestTracker(makeReq('POST'), res, next);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.postRequests).toBe(1);
    });

    test('tracks PUT request', () => {
      const next = jest.fn();
      const res = makeRes();
      metrics.requestTracker(makeReq('PUT'), res, next);
      expect(metrics.putRequests).toBe(1);
    });

    test('tracks DELETE request', () => {
      const next = jest.fn();
      const res = makeRes();
      metrics.requestTracker(makeReq('DELETE'), res, next);
      expect(metrics.deleteRequests).toBe(1);
    });

    test('tracks unknown method without incrementing specific counter', () => {
      const next = jest.fn();
      const res = makeRes();
      metrics.requestTracker(makeReq('PATCH'), res, next);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.getRequests).toBe(0);
      expect(metrics.postRequests).toBe(0);
      expect(metrics.putRequests).toBe(0);
      expect(metrics.deleteRequests).toBe(0);
    });

    test('tracks latency on response finish', () => {
      const next = jest.fn();
      const res = makeRes();
      metrics.requestTracker(makeReq('GET'), res, next);
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      jest.advanceTimersByTime(50);
      res._fire('finish');
      expect(metrics.latencyCount).toBe(1);
      expect(metrics.latencySum).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackActiveUser', () => {
    test('adds a user', () => {
      metrics.trackActiveUser(42);
      expect(metrics.activeUsers.size).toBe(1);
      expect(metrics.activeUsers.has(42)).toBe(true);
    });

    test('ignores falsy userId', () => {
      metrics.trackActiveUser(null);
      metrics.trackActiveUser(undefined);
      metrics.trackActiveUser(0);
      expect(metrics.activeUsers.size).toBe(0);
    });

    test('deduplicates same user', () => {
      metrics.trackActiveUser(1);
      metrics.trackActiveUser(1);
      expect(metrics.activeUsers.size).toBe(1);
    });
  });

  describe('removeActiveUser', () => {
    test('removes a user', () => {
      metrics.trackActiveUser(1);
      metrics.removeActiveUser(1);
      expect(metrics.activeUsers.size).toBe(0);
    });

    test('ignores falsy userId', () => {
      metrics.trackActiveUser(1);
      metrics.removeActiveUser(null);
      expect(metrics.activeUsers.size).toBe(1);
    });
  });

  describe('trackAuthAttempt', () => {
    test('tracks success', () => {
      metrics.trackAuthAttempt(true);
      expect(metrics.authSuccessCount).toBe(1);
      expect(metrics.authFailureCount).toBe(0);
    });

    test('tracks failure', () => {
      metrics.trackAuthAttempt(false);
      expect(metrics.authSuccessCount).toBe(0);
      expect(metrics.authFailureCount).toBe(1);
    });
  });

  describe('trackPizzaPurchase', () => {
    test('tracks successful purchase', () => {
      metrics.trackPizzaPurchase(true, 200, 5.0, 3);
      expect(metrics.pizzasSold).toBe(3);
      expect(metrics.revenue).toBe(5.0);
      expect(metrics.pizzaFailures).toBe(0);
      expect(metrics.pizzaLatencySum).toBe(200);
      expect(metrics.pizzaLatencyCount).toBe(1);
    });

    test('tracks failed purchase', () => {
      metrics.trackPizzaPurchase(false, 500, 0);
      expect(metrics.pizzasSold).toBe(0);
      expect(metrics.pizzaFailures).toBe(1);
      expect(metrics.pizzaLatencySum).toBe(500);
      expect(metrics.pizzaLatencyCount).toBe(1);
    });

    test('defaults count to 1', () => {
      metrics.trackPizzaPurchase(true, 100, 2.0);
      expect(metrics.pizzasSold).toBe(1);
    });
  });

  describe('getCpuUsagePercentage', () => {
    test('returns a numeric string', () => {
      const cpu = metrics.getCpuUsagePercentage();
      expect(Number(cpu)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMemoryUsagePercentage', () => {
    test('returns a value between 0 and 100', () => {
      const mem = Number(metrics.getMemoryUsagePercentage());
      expect(mem).toBeGreaterThan(0);
      expect(mem).toBeLessThanOrEqual(100);
    });
  });

  describe('getAverageLatency', () => {
    test('returns 0 when no data', () => {
      expect(metrics.getAverageLatency()).toBe(0);
    });

    test('returns average when data exists', () => {
      metrics.latencySum = 300;
      metrics.latencyCount = 3;
      expect(Number(metrics.getAverageLatency())).toBe(100);
    });
  });

  describe('getPizzaLatency', () => {
    test('returns 0 when no data', () => {
      expect(metrics.getPizzaLatency()).toBe(0);
    });

    test('returns average when data exists', () => {
      metrics.pizzaLatencySum = 600;
      metrics.pizzaLatencyCount = 2;
      expect(Number(metrics.getPizzaLatency())).toBe(300);
    });
  });

  describe('metric builders', () => {
    let buf;
    beforeEach(() => {
      buf = { addMetric: jest.fn() };
    });

    test('httpMetrics', () => {
      metrics.totalRequests = 10;
      metrics.getRequests = 5;
      metrics.postRequests = 2;
      metrics.putRequests = 2;
      metrics.deleteRequests = 1;
      metrics.httpMetrics(buf);
      expect(buf.addMetric).toHaveBeenCalledWith('request', 'total', 'total', 10);
      expect(buf.addMetric).toHaveBeenCalledWith('request', 'get', 'get', 5);
      expect(buf.addMetric).toHaveBeenCalledWith('request', 'post', 'post', 2);
      expect(buf.addMetric).toHaveBeenCalledWith('request', 'put', 'put', 2);
      expect(buf.addMetric).toHaveBeenCalledWith('request', 'delete', 'delete', 1);
    });

    test('systemMetrics', () => {
      metrics.systemMetrics(buf);
      expect(buf.addMetric).toHaveBeenCalledWith('system', 'cpu', 'usage', expect.any(String));
      expect(buf.addMetric).toHaveBeenCalledWith('system', 'memory', 'usage', expect.any(String));
    });

    test('userMetrics', () => {
      metrics.trackActiveUser(1);
      metrics.trackActiveUser(2);
      metrics.userMetrics(buf);
      expect(buf.addMetric).toHaveBeenCalledWith('user', 'active', 'count', 2);
    });

    test('authMetrics', () => {
      metrics.authSuccessCount = 5;
      metrics.authFailureCount = 2;
      metrics.authMetrics(buf);
      expect(buf.addMetric).toHaveBeenCalledWith('auth', 'success', 'count', 5);
      expect(buf.addMetric).toHaveBeenCalledWith('auth', 'failure', 'count', 2);
    });

    test('purchaseMetrics', () => {
      metrics.pizzasSold = 10;
      metrics.pizzaFailures = 1;
      metrics.revenue = 25.5;
      metrics.purchaseMetrics(buf);
      expect(buf.addMetric).toHaveBeenCalledWith('pizza', 'sold', 'count', 10);
      expect(buf.addMetric).toHaveBeenCalledWith('pizza', 'failure', 'count', 1);
      expect(buf.addMetric).toHaveBeenCalledWith('pizza', 'revenue', 'total', 25.5);
    });

    test('latencyMetrics', () => {
      metrics.latencySum = 500;
      metrics.latencyCount = 5;
      metrics.pizzaLatencySum = 1000;
      metrics.pizzaLatencyCount = 4;
      metrics.latencyMetrics(buf);
      expect(buf.addMetric).toHaveBeenCalledWith('latency', 'service', 'avg', '100.00');
      expect(buf.addMetric).toHaveBeenCalledWith('latency', 'pizza', 'avg', '250.00');
    });
  });

  describe('sendMetricsToGrafana', () => {
    test('sends metrics via fetch when apiKey is configured', async () => {
      global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
      metrics.sendMetricsToGrafana('test_metric value=1');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-grafana/api/v1/push',
        expect.objectContaining({
          method: 'POST',
          body: 'test_metric value=1',
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from('test-account-id:test-api-key').toString('base64')}`,
          }),
        })
      );
    });

    test('handles fetch failure gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500, statusText: 'Server Error' }));
      metrics.sendMetricsToGrafana('test_metric value=1');
      await Promise.resolve();
      await Promise.resolve();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to push metrics:', 500, 'Server Error');
      consoleSpy.mockRestore();
    });

    test('handles fetch network error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      global.fetch = jest.fn(() => Promise.reject(new Error('network error')));
      metrics.sendMetricsToGrafana('test_metric value=1');
      await Promise.resolve();
      await Promise.resolve();
      expect(consoleSpy).toHaveBeenCalledWith('Error pushing metrics:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('skips sending when apiKey is not configured', () => {
      const config = require('./config.js');
      const origKey = config.metrics.apiKey;
      config.metrics.apiKey = '';
      global.fetch = jest.fn();
      metrics.sendMetricsToGrafana('test_metric value=1');
      expect(global.fetch).not.toHaveBeenCalled();
      config.metrics.apiKey = origKey;
    });
  });

  describe('sendMetricsPeriodically', () => {
    test('sends metrics on interval', () => {
      global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
      metrics.totalRequests = 5;
      metrics.trackActiveUser(1);
      jest.advanceTimersByTime(10000);
      expect(global.fetch).toHaveBeenCalled();
      const body = global.fetch.mock.calls[0][1].body;
      expect(body).toContain('request,source=test-source');
      expect(body).toContain('value=5');
    });

    test('handles errors in periodic sending', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      global.fetch = jest.fn(() => {
        throw new Error('sync error');
      });
      jest.advanceTimersByTime(10000);
      expect(consoleSpy).toHaveBeenCalledWith('Error sending metrics', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
