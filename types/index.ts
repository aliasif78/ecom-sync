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
  role: 'admin' | 'user';
  status: 'active' | 'banned';
  lastActive: string;
  profilePicture?: string;
};
