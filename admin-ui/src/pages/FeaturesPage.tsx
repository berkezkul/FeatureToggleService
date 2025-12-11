import { useEffect, useState } from 'react';

interface FeatureFlag {
  id: string;
  featureName: string;
  featureId: string;
  env: string;
  enabled: boolean;
  strategy_type: string;
}

export const FeaturesPage = () => {
  const [items, setItems] = useState<FeatureFlag[]>([]);
  const [envFilter, setEnvFilter] = useState<'all' | 'dev' | 'staging' | 'prod'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [formEnv, setFormEnv] = useState<'dev' | 'staging' | 'prod'>('dev');
  const [formFeatureId, setFormFeatureId] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formStrategy, setFormStrategy] = useState<'boolean' | 'percentage' | 'user_targeting'>(
    'boolean'
  );
  const [formPercentage, setFormPercentage] = useState(50);
  const [formUserIds, setFormUserIds] = useState('');

  const fetchFeatures = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const tenantId = localStorage.getItem('tenantId');
      const userId = localStorage.getItem('userId');

      if (!token || !tenantId) {
        throw new Error('Önce login olmalısın');
      }

      const params = new URLSearchParams();
      params.set('tenant', tenantId);
      params.set('page', '1');
      params.set('limit', '20');
      if (envFilter !== 'all') {
        params.set('env', envFilter);
      }
      if (userId) {
        params.set('userId', userId);
      }

      const response = await fetch(`/api/v1/features?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const resp = await response.json().catch(() => null);
        throw new Error(resp?.error?.message || 'Liste alınamadı');
      }

      const json = (await response.json()) as {
        success: boolean;
        data?: {
          data?: any[];
          pagination?: unknown;
        };
        error?: { message?: string };
      };

      if (!json.success) {
        throw new Error(json.error?.message || 'Liste alınamadı');
      }

      const rawItems = Array.isArray(json.data?.data) ? json.data?.data : [];

      const mapped: FeatureFlag[] = rawItems.map((item) => ({
        id: item.id,
        featureId: item.feature_id,
        featureName:
          item.feature_name ??
          item.feature?.name ??
          item.featureName ??
          item.feature_id ??
          'unknown',
        env: item.env,
        enabled: item.enabled,
        strategy_type: item.strategy_type,
      }));

      setItems(mapped);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFeatures();
  }, [envFilter]);

  const openCreateForm = () => {
    setEditing(null);
    setFormEnv(envFilter === 'all' ? 'dev' : envFilter);
    setFormFeatureId('');
    setFormEnabled(true);
    setFormStrategy('boolean');
    setFormPercentage(50);
    setFormUserIds('');
    setShowForm(true);
  };

  const openEditForm = (item: FeatureFlag) => {
    setEditing(item);
    setFormEnv(item.env as 'dev' | 'staging' | 'prod');
    setFormFeatureId(item.featureId);
    setFormEnabled(item.enabled);
    setFormStrategy(item.strategy_type as 'boolean' | 'percentage' | 'user_targeting');
    setFormPercentage(50);
    setFormUserIds('');
    setShowForm(true);
  };

  const submitForm = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const tenantId = localStorage.getItem('tenantId');

      if (!token || !tenantId) {
        throw new Error('Önce login olmalısın');
      }

      if (!formFeatureId) {
        throw new Error('Feature ID zorunlu');
      }

      const strategy_config: any = {};

      if (formStrategy === 'percentage') {
        strategy_config.percentage = {
          rollout: formPercentage,
          salt: 'ui',
        };
      } else if (formStrategy === 'user_targeting') {
        const includes = formUserIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        strategy_config.userTargeting = {
          include: includes,
          exclude: [],
        };
      } else {
        strategy_config.boolean = { enabled: formEnabled };
      }

      const response = await fetch('/api/v1/features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          feature_id: formFeatureId,
          env: formEnv,
          enabled: formEnabled,
          strategy_type: formStrategy,
          strategy_config,
        }),
      });

      if (!response.ok) {
        const resp = await response.json().catch(() => null);
        throw new Error(resp?.error?.message || 'Kaydedilemedi');
      }

      setShowForm(false);
      await fetchFeatures();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="page">
      <h1>Feature Flags</h1>
      <p className="muted">
        Mevcut tenant için feature flag listesini backend API üzerinden çekiyoruz.
      </p>
      <div className="page-actions">
        <select
          value={envFilter}
          onChange={(e) =>
            setEnvFilter(e.target.value as 'all' | 'dev' | 'staging' | 'prod')
          }
        >
          <option value="all">Tüm env</option>
          <option value="dev">dev</option>
          <option value="staging">staging</option>
          <option value="prod">prod</option>
        </select>
        <button onClick={() => void fetchFeatures()} disabled={loading}>
          Yenile
        </button>
        <button onClick={openCreateForm}>Yeni Flag</button>
      </div>
      {error && <div className="error">{error}</div>}
      {loading && <div>Yükleniyor...</div>}
      {!loading && !error && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Env</th>
                <th>Enabled</th>
                <th>Strategy</th>
                <th>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.featureName}</td>
                  <td>{item.env}</td>
                  <td>{item.enabled ? 'ON' : 'OFF'}</td>
                  <td>{item.strategy_type}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => openEditForm(item)}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            'Bu feature flag kaydını silmek istediğine emin misin?'
                          );
                          if (!confirmed) return;

                          try {
                            const token = localStorage.getItem('accessToken');
                            if (!token) {
                              throw new Error('Önce login olmalısın');
                            }

                            const response = await fetch(
                              `/api/v1/features/${item.id}`,
                              {
                                method: 'DELETE',
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                },
                              }
                            );

                            if (!response.ok) {
                              const resp = await response
                                .json()
                                .catch(() => null);
                              throw new Error(
                                resp?.error?.message || 'Silme işlemi başarısız'
                              );
                            }

                            await fetchFeatures();
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center' }}>
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal card">
            <h2>{editing ? 'Flag Düzenle' : 'Yeni Flag'}</h2>
            <div className="form">
              <label>
                Feature ID (UUID)
                <input
                  value={formFeatureId}
                  onChange={(e) => setFormFeatureId(e.target.value)}
                  required
                />
              </label>
              <label>
                Env
                <select
                  value={formEnv}
                  onChange={(e) =>
                    setFormEnv(e.target.value as 'dev' | 'staging' | 'prod')
                  }
                >
                  <option value="dev">dev</option>
                  <option value="staging">staging</option>
                  <option value="prod">prod</option>
                </select>
              </label>
              <label className="inline-label">
                <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                />
              </label>
              <label>
                Strategy
                <select
                  value={formStrategy}
                  onChange={(e) =>
                    setFormStrategy(
                      e.target.value as 'boolean' | 'percentage' | 'user_targeting'
                    )
                  }
                >
                  <option value="boolean">boolean</option>
                  <option value="percentage">percentage</option>
                  <option value="user_targeting">user_targeting</option>
                </select>
              </label>
              {formStrategy === 'percentage' && (
                <label>
                  Percentage rollout (0-100)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formPercentage}
                    onChange={(e) => setFormPercentage(Number(e.target.value) || 0)}
                  />
                </label>
              )}
              {formStrategy === 'user_targeting' && (
                <label>
                  User IDs (virgülle ayrılmış)
                  <input
                    value={formUserIds}
                    onChange={(e) => setFormUserIds(e.target.value)}
                    placeholder="uuid1, uuid2"
                  />
                </label>
              )}
              <div className="page-actions">
                <button type="button" onClick={submitForm}>
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


