// Authentication and Authorization types

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

export interface APIKeyPayload {
  keyId: string;
  tenantId: string;
  permissions?: string[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface AuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    tenantId: string;
    email?: string;
    roles?: string[];
  };
  apiKey?: {
    keyId: string;
    tenantId: string;
    permissions?: string[];
  };
  method: 'jwt' | 'api-key' | 'none';
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

