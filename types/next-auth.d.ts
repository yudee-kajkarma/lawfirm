import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    kind: 'tenant_user' | 'operator';
    isAdmin?: boolean;
    tenantId?: string;
    businessUnits?: string[];
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      kind: 'tenant_user' | 'operator';
      isAdmin?: boolean;
      tenantId?: string;
      businessUnits?: string[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    kind?: 'tenant_user' | 'operator';
    isAdmin?: boolean;
    tenantId?: string;
    businessUnits?: string[];
  }
}
