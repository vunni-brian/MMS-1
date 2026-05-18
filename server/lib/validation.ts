import { z } from "zod";
import { HttpError } from "./http.ts";

// Common validation schemas
export const phoneSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format");

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .min(5, "Email must be at least 5 characters")
  .max(255, "Email must be less than 255 characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const idSchema = z
  .string()
  .min(1, "ID is required")
  .max(100, "ID is too long");

export const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(255, "Name must be less than 255 characters");

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Request validation middleware
export const validateBody = <T>(schema: z.ZodSchema<T>) => {
  return (body: unknown): T => {
    try {
      return schema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        throw new HttpError(400, "Validation failed", { errors });
      }
      throw new HttpError(400, "Invalid request body");
    }
  };
};

export const validateQuery = <T>(schema: z.ZodSchema<T>) => {
  return (query: Record<string, string | string[] | undefined>): T => {
    try {
      return schema.parse(query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        throw new HttpError(400, "Invalid query parameters", { errors });
      }
      throw new HttpError(400, "Invalid query parameters");
    }
  };
};

export const validateParams = <T>(schema: z.ZodSchema<T>) => {
  return (params: Record<string, string>): T => {
    try {
      return schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        throw new HttpError(400, "Invalid path parameters", { errors });
      }
      throw new HttpError(400, "Invalid path parameters");
    }
  };
};

// Sanitization utilities
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};

export const sanitizeHtml = (input: string): string => {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

// File validation
export const validateFileSize = (size: number, maxSize: number = 5 * 1024 * 1024): boolean => {
  return size <= maxSize;
};

export const validateFileType = (mimeType: string, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(mimeType);
};

// Common request schemas
export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerVendorSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  marketId: idSchema,
  nationalIdNumber: z.string().min(1, "NIN is required").max(50),
  district: z.string().min(1, "District is required").max(100),
  productSection: z.string().min(1, "Product section is required").max(100),
});

export const otpVerifySchema = z.object({
  challengeId: idSchema,
  code: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "OTP must contain only digits"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

export const createStallSchema = z.object({
  number: z.string().min(1, "Stall number is required").max(50),
  marketId: idSchema,
  section: z.string().min(1, "Section is required").max(100),
  monthlyFee: z.number().positive("Monthly fee must be positive"),
});

export const createTicketSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(255),
  category: z.string().min(1, "Category is required").max(100),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
});

export const initiatePaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  type: z.string().min(1, "Payment type is required").max(50),
  description: z.string().min(1, "Description is required").max(500),
});
