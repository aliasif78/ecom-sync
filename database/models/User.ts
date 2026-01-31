// ==========================================
// ⚠️ CONSTRAINTS
// ==========================================

// We need the unique Supabase ID for each user
// We need the E-commerce Platforms' information as well
// Add-ons: Email verification, forgot password, OAuth, admin portal, profile picture & payment credentials

// ==========================================
// 📦 Imports
// ==========================================

// Dependencies
import { Schema, models, model, Document } from 'mongoose';

// Constants
import { ROLES } from '../../lib/globalConstants';

// ==========================================
// 💿 CONSTANTS
// ==========================================

// ==========================================
// 🚓 INTERFACES
// ==========================================
type TPlatform = { accessToken: string; shopName: string } | undefined;

interface IUser extends Document {
  // General
  name: string;
  email: string;
  profilePicture?: string;
  role?: (typeof ROLES)[number];
  paymentCredentials?: { stripe: { customerId: string; subscriptionId: string } };

  // Supabase
  supabaseId: string;

  // E-commerce Platforms' information
  shopify?: TPlatform;
  amazon?: TPlatform;
  woocommerce?: TPlatform;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// 🏛️ SCHEMA
// ==========================================

const UserSchema = new Schema<IUser>(
  {
    // General
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    profilePicture: { type: String },
    role: { type: String, enum: ROLES, default: 'USER' },
    paymentCredentials: { stripe: { customerId: String, subscriptionId: String } },

    // Supabase ID
    supabaseId: { type: String, required: true, unique: true, index: true },

    // E-commerce Platforms' information
    // These should be encrypted later
    // Select (false) tells Mongoose: "When I ask for a User, DO NOT give me this field unless I explicitly ask for it
    shopify: { accessToken: { type: String, select: false }, shopName: String },
    amazon: { accessToken: { type: String, select: false }, shopName: String },
    woocommerce: { accessToken: { type: String, select: false }, shopName: String },
  },

  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ==========================================
// ⛑️ HELPERS
// ==========================================

const tokenExists = (platform: TPlatform) => {
  if (!platform) return false; // Platform configuration not found
  return !['', null, undefined].includes(platform.accessToken); // Platform found, check token
};

// ==========================================
// ⚡️ VIRTUALS - Variables on the fly
// ==========================================

UserSchema.virtual('hasShopify').get(function () {
  return tokenExists(this.shopify);
});

UserSchema.virtual('hasAmazon').get(function () {
  return tokenExists(this.amazon);
});

UserSchema.virtual('hasWooCommerce').get(function () {
  return tokenExists(this.woocommerce);
});

// ==========================================
// 🛡 PRE-HOOKS - The integrity guard
// ==========================================

// ==========================================
// 🔧 METHODS (Instance Logic)
// ==========================================

UserSchema.methods.getAccountAge = function () {
  // In years, months and days
  const diffInMs = Date.now() - this.createdAt.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInMonths / 12);
  return { years: diffInYears, months: diffInMonths % 12, days: diffInDays % 30 };
};

// ==========================================
// 🔍 STATICS (Model Queries)
// ==========================================

// ==========================================
// 🏎️ INDEXES - Speed up queries
// ==========================================

// Done inside the model definition using the 'index' or 'sparse' options

const User = models.User || model<IUser>('User', UserSchema);
export default User;
