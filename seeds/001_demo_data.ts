import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing demo data (id sabitlerini kullandığımız için çakışma olmasın)
  await knex('feature_flags').del();
  await knex('features').del();
  await knex('tenants').del();

  // Demo tenant
  const demoTenantId = '22222222-2222-2222-2222-222222222222';

  await knex('tenants').insert({
    id: demoTenantId,
    name: 'demo-tenant',
  });

  // Demo features
  const featureNewDashboardId = '33333333-3333-3333-3333-333333333333';
  const featureBetaSearchId = '44444444-4444-4444-4444-444444444444';

  await knex('features').insert([
    {
      id: featureNewDashboardId,
      name: 'new-dashboard',
      description: 'Yeni dashboard deneyimi',
    },
    {
      id: featureBetaSearchId,
      name: 'beta-search',
      description: 'Geliştirilmiş arama deneyimi (beta)',
    },
  ]);

  // Demo feature flags (dev/staging/prod + farklı stratejiler)
  await knex('feature_flags').insert([
    {
      // Boolean strategy – dev ortamında tamamen açık
      id: '55555555-5555-5555-5555-555555555555',
      tenant_id: demoTenantId,
      feature_id: featureNewDashboardId,
      env: 'dev',
      enabled: true,
      strategy_type: 'boolean',
      strategy_config: {
        boolean: {
          enabled: true,
        },
      },
    },
    {
      // Percentage rollout – staging ortamında %30 kullanıcıya açık
      id: '66666666-6666-6666-6666-666666666666',
      tenant_id: demoTenantId,
      feature_id: featureNewDashboardId,
      env: 'staging',
      enabled: true,
      strategy_type: 'percentage',
      strategy_config: {
        percentage: {
          rollout: 30,
          salt: 'demo-salt',
        },
      },
    },
    {
      // Prod ortamında kapalı (boolean)
      id: '77777777-7777-7777-7777-777777777777',
      tenant_id: demoTenantId,
      feature_id: featureNewDashboardId,
      env: 'prod',
      enabled: false,
      strategy_type: 'boolean',
      strategy_config: {
        boolean: {
          enabled: false,
        },
      },
    },
    {
      // User targeting – sadece belirli kullanıcılar için açık
      id: '88888888-8888-8888-8888-888888888888',
      tenant_id: demoTenantId,
      feature_id: featureBetaSearchId,
      env: 'dev',
      enabled: true,
      strategy_type: 'user_targeting',
      strategy_config: {
        userTargeting: {
          include: [
            '11111111-1111-1111-1111-111111111111', // demo user
            '99999999-9999-9999-9999-999999999999',
          ],
          exclude: [],
        },
      },
    },
  ]);
}


