const os = require('os');
const config = require('./config.js');

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.getRequests = 0;
    this.postRequests = 0;
    this.putRequests = 0;
    this.deleteRequests = 0;

    this.activeUsers = new Set();

    this.authSuccessCount = 0;
    this.authFailureCount = 0;

    this.pizzasSold = 0;
    this.pizzaFailures = 0;
    this.revenue = 0;

    this.latencySum = 0;
    this.latencyCount = 0;
    this.pizzaLatencySum = 0;
    this.pizzaLatencyCount = 0;

    this.sendMetricsPeriodically(10000);
  }

  requestTracker = (req, res, next) => {
    this.totalRequests++;

    switch (req.method) {
      case 'GET':
        this.getRequests++;
        break;
      case 'POST':
        this.postRequests++;
        break;
      case 'PUT':
        this.putRequests++;
        break;
      case 'DELETE':
        this.deleteRequests++;
        break;
    }

    const startTime = Date.now();
    res.on('finish', () => {
      const latency = Date.now() - startTime;
      this.latencySum += latency;
      this.latencyCount++;
    });

    next();
  };

  trackActiveUser(userId) {
    if (userId) {
      this.activeUsers.add(userId);
    }
  }

  removeActiveUser(userId) {
    if (userId) {
      this.activeUsers.delete(userId);
    }
  }

  trackAuthAttempt(success) {
    if (success) {
      this.authSuccessCount++;
    } else {
      this.authFailureCount++;
    }
  }

  trackPizzaPurchase(success, latency, price, count = 1) {
    if (success) {
      this.pizzasSold += count;
      this.revenue += price;
    } else {
      this.pizzaFailures++;
    }
    this.pizzaLatencySum += latency;
    this.pizzaLatencyCount++;
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return (cpuUsage * 100).toFixed(2);
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  getAverageLatency() {
    if (this.latencyCount === 0) return 0;
    return (this.latencySum / this.latencyCount).toFixed(2);
  }

  getPizzaLatency() {
    if (this.pizzaLatencyCount === 0) return 0;
    return (this.pizzaLatencySum / this.pizzaLatencyCount).toFixed(2);
  }

  httpMetrics(buf) {
    buf.addMetric('request', 'total', 'total', this.totalRequests);
    buf.addMetric('request', 'get', 'get', this.getRequests);
    buf.addMetric('request', 'post', 'post', this.postRequests);
    buf.addMetric('request', 'put', 'put', this.putRequests);
    buf.addMetric('request', 'delete', 'delete', this.deleteRequests);
  }

  systemMetrics(buf) {
    buf.addMetric('system', 'cpu', 'usage', this.getCpuUsagePercentage());
    buf.addMetric('system', 'memory', 'usage', this.getMemoryUsagePercentage());
  }

  userMetrics(buf) {
    buf.addMetric('user', 'active', 'count', this.activeUsers.size);
  }

  authMetrics(buf) {
    buf.addMetric('auth', 'success', 'count', this.authSuccessCount);
    buf.addMetric('auth', 'failure', 'count', this.authFailureCount);
  }

  purchaseMetrics(buf) {
    buf.addMetric('pizza', 'sold', 'count', this.pizzasSold);
    buf.addMetric('pizza', 'failure', 'count', this.pizzaFailures);
    buf.addMetric('pizza', 'revenue', 'total', this.revenue);
  }

  latencyMetrics(buf) {
    buf.addMetric('latency', 'service', 'avg', this.getAverageLatency());
    buf.addMetric('latency', 'pizza', 'avg', this.getPizzaLatency());
  }

  sendMetricsPeriodically(period) {
    setInterval(() => {
      try {
        const buf = new MetricBuilder();
        this.httpMetrics(buf);
        this.systemMetrics(buf);
        this.userMetrics(buf);
        this.authMetrics(buf);
        this.purchaseMetrics(buf);
        this.latencyMetrics(buf);

        this.sendMetricsToGrafana(buf.toJSON());
      } catch (error) {
        console.log('Error sending metrics', error);
      }
    }, period);
  }

  sendMetricsToGrafana(metricData) {
    if (!config.metrics || !config.metrics.apiKey) {
      return;
    }

    fetch(config.metrics.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.metrics.accountId}:${config.metrics.apiKey}`).toString('base64')}`,
      },
      body: JSON.stringify(metricData),
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics:', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

class MetricBuilder {
  constructor() {
    this.metrics = [];
  }

  addMetric(prefix, category, type, value) {
    const source = config.metrics?.source || 'jwt-pizza-service';
    this.metrics.push({
      name: prefix,
      gauge: {
        dataPoints: [
          {
            asDouble: parseFloat(value),
            timeUnixNano: String(Date.now() * 1000000),
            attributes: [
              { key: 'source', value: { stringValue: source } },
              { key: 'category', value: { stringValue: category } },
              { key: 'type', value: { stringValue: type } },
            ],
          },
        ],
      },
    });
  }

  toJSON() {
    return {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: this.metrics,
            },
          ],
        },
      ],
    };
  }
}

const metrics = new Metrics();
module.exports = metrics;
