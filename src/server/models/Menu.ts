import mongoose, { type InferSchemaType, type Model } from "mongoose";

// Recursive tree stored as plain embedded data; shape and depth (≤3) are enforced by zod at the API boundary.
const menuSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    items: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true, minimize: false },
);

export type MenuDoc = Omit<InferSchemaType<typeof menuSchema>, "items"> & {
  _id: mongoose.Types.ObjectId;
  items: import("@/lib/validation/menus").MenuItemInput[];
  createdAt: Date;
  updatedAt: Date;
};

if (process.env.NODE_ENV !== "production") delete mongoose.models.Menu;
export const Menu: Model<MenuDoc> = (mongoose.models.Menu as Model<MenuDoc>) || mongoose.model<MenuDoc>("Menu", menuSchema as never);
