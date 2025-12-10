import { metrics, METRIC_NAMES } from '../../../src/utils/metrics';

describe('Metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('Counter metrics', () => {
    it('should increment counter', () => {
      metrics.increment('test_counter');
      const prometheus = metrics.getPrometheusFormat();
      expect(prometheus).toContain('test_counter 1');
    });

    it('should increment counter with labels', () => {
      metrics.increment('test_counter', { method: 'GET', status: '200' });
      const prometheus = metrics.getPrometheusFormat();
      expect(prometheus).toContain('test_counter{method="GET",status="200"} 1');
    });

    it('should accumulate counter values', () => {
      metrics.increment('test_counter');
      metrics.increment('test_counter');
      metrics.increment('test_counter', undefined, 2);
      const prometheus = metrics.getPrometheusFormat();
      expect(prometheus).toContain('test_counter 4');
    });
  });

  describe('Gauge metrics', () => {
    it('should set gauge value', () => {
      metrics.set('test_gauge', 42);
      const prometheus = metrics.getPrometheusFormat();
      expect(prometheus).toContain('test_gauge 42');
    });

    it('should update gauge value', () => {
      metrics.set('test_gauge', 10);
      metrics.set('test_gauge', 20);
      const prometheus = metrics.getPrometheusFormat();
      expect(prometheus).toContain('test_gauge 20');
    });
  });

  describe('Histogram metrics', () => {
    it('should observe histogram values', () => {
      metrics.observe('test_histogram', 100);
      metrics.observe('test_histogram', 200);
      metrics.observe('test_histogram', 300);

      const prometheus = metrics.getPrometheusFormat();
      expect(prometheus).toContain('test_histogram_sum 600');
      expect(prometheus).toContain('test_histogram_count 3');
      expect(prometheus).toContain('test_histogram_avg 200');
    });
  });

  describe('JSON format', () => {
    it('should export metrics as JSON', () => {
      metrics.increment('test_counter');
      metrics.set('test_gauge', 42);
      metrics.observe('test_histogram', 100);

      const json = metrics.getJSON();
      expect(json).toHaveProperty('test_counter');
      expect(json).toHaveProperty('test_gauge');
      expect(json).toHaveProperty('test_histogram');
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      metrics.increment('test_counter');
      metrics.set('test_gauge', 42);
      
      metrics.reset();
      
      const prometheus = metrics.getPrometheusFormat();
      expect(prometheus).not.toContain('test_counter');
      expect(prometheus).not.toContain('test_gauge');
    });
  });
});

