import mongoose, { type Model } from "mongoose";

// Atomic sequences (order numbers). One document per sequence, incremented with a single $inc upsert.
const counterSchema = new mongoose.Schema({ _id: { type: String, required: true }, n: { type: Number, default: 0 } }, { versionKey: false });
export type CounterDoc = { _id: string; n: number };
if (process.env.NODE_ENV !== "production") delete mongoose.models.Counter;
export const Counter: Model<CounterDoc> = (mongoose.models.Counter as Model<CounterDoc>) || mongoose.model<CounterDoc>("Counter", counterSchema as never);
