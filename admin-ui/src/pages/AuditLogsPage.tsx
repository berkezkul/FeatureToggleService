import { useEffect, useState } from 'react';

interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  actor: string | null;
  created_at: string;
}

export const AuditLogsPage = () => {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('feature_flag');
  const [action, setAction] = useState<'all' | 'CREATE' | 'UPDATE' | 'DELETE'>('all');

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Önce login olmalısın');
      }

      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '20');
      if (entityType) {
        params.set('entity_type', entityType);
      }
      if (action !== 'all') {
        params.set('action', action);
      }

      const response = await fetch(`/api/v1/audit-logs?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const resp = await response.json().catch(() => null);
        throw new Error(resp?.error?.message || 'Audit log listesi alınamadı');
      }

      const json = (await response.json()) as {
        success: boolean;
        data?: { data?: any[] };
        error?: { message?: string };
      };

      if (!json.success) {
        throw new Error(json.error?.message || 'Audit log listesi alınamadı');
      }

      const rawItems = Array.isArray(json.data?.data) ? json.data?.data : [];

      const mapped: AuditLog[] = rawItems.map((item) => ({
        id: item.id,
        action: item.action,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        actor: item.actor,
        created_at: item.created_at,
      }));

      setItems(mapped);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, [entityType, action]);

  return (
    <div className="page">
      <h1>Audit Logs</h1>
      <p className="muted">
        Feature flag değişiklikleri için oluşturulan audit log kayıtlarını görüntülersin.
      </p>
      <div className="page-actions">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">Tüm entity</option>
          <option value="feature_flag">feature_flag</option>
        </select>
        <select
          value={action}
          onChange={(e) =>
            setAction(e.target.value as 'all' | 'CREATE' | 'UPDATE' | 'DELETE')
          }
        >
          <option value="all">Tüm aksiyonlar</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <button onClick={() => void fetchLogs()} disabled={loading}>
          Yenile
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {loading && <div>Yükleniyor...</div>}
      {!loading && !error && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Aksiyon</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.action}</td>
                  <td>{log.entity_type}</td>
                  <td>{log.entity_id}</td>
                  <td>{log.actor ?? '-'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


