// ==========================================
// 🔎 CONTEXT
// ==========================================

// This basically exists to keep logs of WHY a stock changed
// For example, if a product's stock goes from 10 to 8, this log will tell you that it was because of a sale.
// Or if it goes from 8 to 12, it will tell you that it was because of a restock.

// ==========================================
// 📦 Imports
// ==========================================

// Dependencies
import mongoose, { model, models, Schema } from 'mongoose';

// Types
import { InventoryReason } from '@/types';

// Constants
import { PLATFORMS } from '@/lib/globalConstants';

// ==========================================
// 💿 CONSTANTS
// ==========================================

// ==========================================
// 🚓 INTERFACES
// ==========================================

interface IInventoryLedger extends Document {
  // Ids
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  locationId: string;

  // Math
  newStock: number;
  oldStock: number;
  change: number;

  // Metadata
  platform: (typeof PLATFORMS)[number];
  reason: string;
  description: string;
  createdAt: Date;
}

// ==========================================
// 🏛️ SCHEMA
// ==========================================

const InventoryLedgerSchema = new Schema<IInventoryLedger>(
  {
    // Ids
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    locationId: { type: String, required: true, index: true },

    // The Math
    newStock: { type: Number, required: true },
    oldStock: { type: Number, required: true },
    change: { type: Number, required: true },

    // Metadata
    platform: { type: String, enum: PLATFORMS, required: true, index: true },
    reason: { type: String, enum: Object.values(InventoryReason), required: true },
    description: { type: String },
  },

  // Enable timestamps
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ==========================================
// ⚡️ VIRTUALS - Variables on the fly
// ==========================================

// ==========================================
// 🛡 PRE-SAVE HOOKS - The integrity guard
// ==========================================

// ✅ This runs BEFORE the 'required' check in the 'save' hook
InventoryLedgerSchema.pre('validate', function () {
  this.change = this.newStock - this.oldStock;

  // Do we allow the stock to fall below 0?
  // Answer: Yes, record the -ve value. The order service is responsible for checking if the stock is available.
});

// ==========================================
// 🔧 METHODS (Instance Logic)
// ==========================================

InventoryLedgerSchema.methods.getMessage = function () {
  return `Stock changed from ${this.oldStock} to ${this.newStock} due to "${this.reason}"`;
};

// ==========================================
// 🔍 STATICS (Model Queries)
// ==========================================

InventoryLedgerSchema.statics.findAllByProductId = function (productId: string) {
  return this.find({ product: productId });
};

InventoryLedgerSchema.statics.findAllByPlatform = function (platform: string) {
  return this.find({ platform });
};

InventoryLedgerSchema.statics.findAllByLocationId = function (locationId: string) {
  return this.find({ locationId });
};

// ==========================================
// 🏎️ INDEXES - Speed up queries
// ==========================================

// Already done in the schema

// ==========================================
// ⛩️ The Next.js Singleton Pattern (CRITICAL)
// ==========================================
// Check if model exists before compiling to prevent hot-reload crashes
const InventoryLedger = models.InventoryLedger || model<IInventoryLedger>('InventoryLedger', InventoryLedgerSchema);
export default InventoryLedger;
