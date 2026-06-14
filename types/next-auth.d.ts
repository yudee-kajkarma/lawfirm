import 'next-auth';
import 'next-auth/jwt';

// Module augmentation — every place Auth.js types appear, our extra fields
// (id, isAdmin, businessUnits) come along too.

declare module 'next-auth' {
  interface User {
    isAdmin: boolean;
    tenantId: string;
    businessUnits: string[];
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isAdmin: boolean;
      tenantId: string;
      businessUnits: string[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin: boolean;
    tenantId: string;
    businessUnits: string[];
  }
}
