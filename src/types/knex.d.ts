// Type declaration for knexfile
declare module '../../knexfile' {
  import { Knex } from 'knex';
  
  const config: {
    development: Knex.Config;
    staging: Knex.Config;
    production: Knex.Config;
  };
  
  export default config;
}

