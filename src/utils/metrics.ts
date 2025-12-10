// Prometheus-style metrics collection

interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter metric
   */
  increment(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.getKey(name, labels);
    const existing = this.metrics.get(key);
    
    if (existing) {
      existing.value += value;
    } else {
      this.metrics.set(key, {
        name,
        help: `Counter for ${name}`,
        type: 'counter',
        value,
        labels,
      });
    }
  }

  /**
   * Set a gauge metric
   */
  set(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.metrics.set(key, {
      name,
      help: `Gauge for ${name}`,
      type: 'gauge',
      value,
      labels,
    });
  }

  /**
   * Record a histogram value
   */
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters and Gauges
    for (const [, metric] of this.metrics.entries()) {
      const labelsStr = metric.labels
        ? `{${Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
        : '';
      
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      lines.push(`${metric.name}${labelsStr} ${metric.value}`);
    }

    // Histograms (simplified - calculate sum, count, avg)
    for (const [key, values] of this.histograms.entries()) {
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      const avg = count > 0 ? sum / count : 0;

      const metricName = key.split('{')[0];
      const labelsStr = key.includes('{') ? `{${key.split('{')[1]}` : '';

      lines.push(`# HELP ${metricName}_sum Sum of ${metricName}`);
      lines.push(`# TYPE ${metricName}_sum counter`);
      lines.push(`${metricName}_sum${labelsStr} ${sum}`);

      lines.push(`# HELP ${metricName}_count Count of ${metricName}`);
      lines.push(`# TYPE ${metricName}_count counter`);
      lines.push(`${metricName}_count${labelsStr} ${count}`);

      lines.push(`# HELP ${metricName}_avg Average of ${metricName}`);
      lines.push(`# TYPE ${metricName}_avg gauge`);
      lines.push(`${metricName}_avg${labelsStr} ${avg}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Get metrics as JSON
   */
  getJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, metric] of this.metrics.entries()) {
      result[key] = {
        name: metric.name,
        type: metric.type,
        value: metric.value,
        labels: metric.labels,
      };
    }

    for (const [key, values] of this.histograms.entries()) {
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      const avg = count > 0 ? sum / count : 0;

      result[key] = {
        type: 'histogram',
        sum,
        count,
        avg,
        values,
      };
    }

    return result;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.histograms.clear();
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) {
      return name;
    }
    const labelsStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelsStr}}`;
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Predefined metric names
export const METRIC_NAMES = {
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
  FEATURE_FLAG_FETCHES_TOTAL: 'feature_flag_fetches_total',
  FEATURE_FLAG_UPDATES_TOTAL: 'feature_flag_updates_total',
  FEATURE_FLAG_DELETES_TOTAL: 'feature_flag_deletes_total',
  CACHE_HITS_TOTAL: 'cache_hits_total',
  CACHE_MISSES_TOTAL: 'cache_misses_total',
  AUTH_FAILURES_TOTAL: 'auth_failures_total',
  RATE_LIMIT_EXCEEDED_TOTAL: 'rate_limit_exceeded_total',
  DATABASE_QUERIES_TOTAL: 'database_queries_total',
  DATABASE_QUERY_DURATION_MS: 'database_query_duration_ms',
  REDIS_OPERATIONS_TOTAL: 'redis_operations_total',
  ERRORS_TOTAL: 'errors_total',
} as const;

