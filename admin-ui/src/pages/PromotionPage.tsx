import { useState } from 'react';

export const PromotionPage = () => {
  const [sourceEnv, setSourceEnv] = useState<'dev' | 'staging' | 'prod'>('staging');
  const [targetEnv, setTargetEnv] = useState<'dev' | 'staging' | 'prod'>('prod');
  const [featureIds, setFeatureIds] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [conflictResolution, setConflictResolution] =
    useState<'skip' | 'overwrite' | 'merge'>('skip');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const submitPromotion = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('accessToken');
      const tenantId = localStorage.getItem('tenantId');

      if (!token || !tenantId) {
        throw new Error('Önce login olmalısın');
      }

      if (sourceEnv === targetEnv) {
        throw new Error('Kaynak ve hedef env farklı olmalı');
      }

      const body: any = {
        tenant_id: tenantId,
        source_env: sourceEnv,
        target_env: targetEnv,
        dry_run: dryRun,
        conflict_resolution: conflictResolution,
      };

      if (featureIds.trim().length > 0) {
        body.feature_ids = featureIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
      }

      const response = await fetch('/api/v1/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Promotion isteği başarısız');
      }

      setResult(JSON.stringify(json.data ?? json, null, 2));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Environment Promotion</h1>
      <p className="muted">
        Örneğin staging &rarr; prod arası feature flag promotion yapabilirsin. Varsayılan
        olarak dry-run modunda yalnızca sonucu görürsün.
      </p>
      <div className="card form">
        <label>
          Source env
          <select
            value={sourceEnv}
            onChange={(e) =>
              setSourceEnv(e.target.value as 'dev' | 'staging' | 'prod')
            }
          >
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
          </select>
        </label>
        <label>
          Target env
          <select
            value={targetEnv}
            onChange={(e) =>
              setTargetEnv(e.target.value as 'dev' | 'staging' | 'prod')
            }
          >
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
          </select>
        </label>
        <label>
          Feature IDs (opsiyonel, virgülle ayrılmış UUID)
          <input
            value={featureIds}
            onChange={(e) => setFeatureIds(e.target.value)}
            placeholder="3333-..., 4444-..."
          />
        </label>
        <label className="inline-label">
          <span>Dry run</span>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
        </label>
        <label>
          Conflict resolution
          <select
            value={conflictResolution}
            onChange={(e) =>
              setConflictResolution(
                e.target.value as 'skip' | 'overwrite' | 'merge'
              )
            }
          >
            <option value="skip">skip</option>
            <option value="overwrite">overwrite</option>
            <option value="merge">merge</option>
          </select>
        </label>
        <div className="page-actions">
          <button type="button" onClick={submitPromotion} disabled={loading}>
            {dryRun ? 'Dry-run' : 'Promote'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {result && (
          <pre className="code-block">
{result}
          </pre>
        )}
      </div>
    </div>
  );
};


