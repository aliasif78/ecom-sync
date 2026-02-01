// Constants
import { VERIFICATION, ROLES } from '@/lib/globalConstants';

export type LoginFormValues = {
  email: string;
  password: string;
};

export type SignUpFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;

  stores: {
    shopify?: string;
    amazon?: string;
    woocommerce?: string;
  };
};

export type UserTableRow = {
  _id: string;
  name: string;
  email: string;
  role: (typeof ROLES)[number];
  status: (typeof VERIFICATION)[number];
  lastActive: string;
  createdAt: string;
  profilePicture?: string;
};
