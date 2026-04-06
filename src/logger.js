const config = require('./config.js');

class Logger {
  httpLogger = (req, res, next) => {
    const originalSend = res.send;
    let responseBody;

    res.send = (body) => {
      responseBody = body;
      return originalSend.call(res, body);
    };

    res.on('finish', () => {
      const logData = {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        hasAuth: !!req.headers.authorization,
        reqBody: this.sanitize(req.body),
        resBody: this.sanitizeResponseBody(responseBody),
      };
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      this.log(level, 'http', logData);
    });

    next();
  };

  dbLogger(sql) {
    this.log('info', 'db', { query: this.sanitizeSql(sql) });
  }

  factoryLogger(orderReq, orderRes) {
    this.log('info', 'factory', {
      reqBody: this.sanitize(orderReq),
      resBody: this.sanitize(orderRes),
    });
  }

  unhandledErrorLogger(err) {
    this.log('error', 'unhandled', {
      message: err.message,
      stack: err.stack,
    });
  }

  log(level, type, logData) {
    const logEntry = {
      ...logData,
      timestamp: new Date().toISOString(),
    };

    const labels = {
      component: config.logging?.source || 'jwt-pizza-service',
      level,
      type,
    };

    const values = [[`${Date.now() * 1000000}`, JSON.stringify(logEntry)]];

    const body = { streams: [{ stream: labels, values }] };
    this.sendLogToGrafana(body);
  }

  sendLogToGrafana(body) {
    if (!config.logging || !config.logging.apiKey) {
      return;
    }

    const endpointUrl = config.logging.endpointUrl.replace(/\/$/, '');
    fetch(`${endpointUrl}/loki/api/v1/push`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.logging.accountId}:${config.logging.apiKey}`).toString('base64')}`,
      },
    })
      .then((res) => {
        if (!res.ok) console.error('Failed to send log to Grafana:', res.status);
      })
      .catch((err) => {
        console.error('Error sending log to Grafana:', err);
      });
  }

  sanitize(data) {
    if (!data || typeof data !== 'object') return data;
    const sanitized = JSON.parse(JSON.stringify(data));
    const sensitiveKeys = ['password', 'token', 'apiKey', 'apikey', 'api_key', 'secret', 'authorization'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '***';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }
    return sanitized;
  }

  sanitizeSql(sql) {
    return sql.replace(/password\s*=\s*'[^']*'/gi, "password='***'");
  }

  sanitizeResponseBody(body) {
    if (!body) return body;
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      return this.sanitize(parsed);
    } catch {
      return body;
    }
  }
}

const logger = new Logger();
module.exports = logger;
