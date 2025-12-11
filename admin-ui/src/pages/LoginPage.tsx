import { FormEvent, useState } from 'react';

const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_TENANT_ID = '22222222-2222-2222-2222-222222222222';

export const LoginPage = () => {
  const [userId, setUserId] = useState(DEMO_USER_ID);
  const [tenantId, setTenantId] = useState(DEMO_TENANT_ID);
  const [email, setEmail] = useState('demo@tenant.local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          tenantId,
          email,
        }),
      });

      if (!response.ok) {
        const resp = await response.json().catch(() => null);
        throw new Error(resp?.error?.message || 'Login failed');
      }

      const data = await response.json();
      const { accessToken, refreshToken } = data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tenantId', tenantId);
      localStorage.setItem('userId', userId);

      window.location.href = '/features';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Login</h1>
      <p className="muted">
        Demo için aşağıdaki hazır değerlerle giriş yapabilirsin. Token localStorage&apos;a
        yazılır ve API çağrılarında kullanılacak.
      </p>
      <form onSubmit={handleSubmit} className="card form">
        <label>
          User ID
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
        </label>
        <label>
          Tenant ID
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
          />
        </label>
        <label>
          Email (opsiyonel)
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Giriş yapılıyor...' : 'Login'}
        </button>
      </form>
    </div>
  );
};


