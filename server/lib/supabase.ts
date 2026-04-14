import { createClient, type User } from "@supabase/supabase-js";

import { config } from "../config.ts";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const allowedBucketMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

const publicClient =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey, clientOptions)
    : null;

const adminClient =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, clientOptions)
    : null;

export const findSupabaseAuthUser = async ({
  phone,
  email,
}: {
  phone?: string | null;
  email?: string | null;
}) => {
  if (!adminClient) {
    return null;
  }

  const normalizedPhone = phone?.trim() || null;
  const normalizedEmail = email?.trim().toLowerCase() || null;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new Error(`Unable to query Supabase Auth users: ${error.message}`);
    }

    const match =
      data.users.find((candidate) => {
        const candidateEmail = candidate.email?.trim().toLowerCase() || null;
        const candidatePhone = candidate.phone?.trim() || null;
        return (normalizedPhone && candidatePhone === normalizedPhone) || (normalizedEmail && candidateEmail === normalizedEmail);
      }) || null;

    if (match) {
      return match;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }
};

export const createSupabaseAuthUser = async ({
  email,
  phone,
  password,
  localUserId,
  name,
  role,
  marketId,
}: {
  email: string;
  phone: string;
  password: string;
  localUserId: string;
  name: string;
  role: "vendor" | "manager" | "official" | "admin";
  marketId: string | null;
}) => {
  if (!adminClient) {
    return null;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    phone,
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      appUserId: localUserId,
      marketId,
      name,
      role,
    },
    app_metadata: {
      appUserId: localUserId,
      marketId,
      mmsRole: role,
    },
  });

  if (error || !data.user) {
    throw new Error(`Unable to create Supabase Auth user: ${error?.message || "Unknown error."}`);
  }

  return data.user;
};

export const updateSupabaseAuthUser = async (
  authUserId: string,
  {
    email,
    phone,
    password,
    localUserId,
    name,
    role,
    marketId,
  }: {
    email: string;
    phone: string;
    password?: string;
    localUserId: string;
    name: string;
    role: "vendor" | "manager" | "official" | "admin";
    marketId: string | null;
  },
) => {
  if (!adminClient) {
    return null;
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(authUserId, {
    email,
    phone,
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      appUserId: localUserId,
      marketId,
      name,
      role,
    },
    app_metadata: {
      appUserId: localUserId,
      marketId,
      mmsRole: role,
    },
  });

  if (error || !data.user) {
    throw new Error(`Unable to update Supabase Auth user: ${error?.message || "Unknown error."}`);
  }

  return data.user;
};

export const deleteSupabaseAuthUser = async (authUserId: string) => {
  if (!adminClient) {
    return;
  }

  const { error } = await adminClient.auth.admin.deleteUser(authUserId);
  if (error) {
    console.error(`Unable to delete Supabase Auth user ${authUserId}: ${error.message}`);
  }
};

export const verifySupabaseCredentials = async ({
  phone,
  password,
}: {
  phone: string;
  password: string;
}) => {
  if (!publicClient) {
    return null;
  }

  const { data, error } = await publicClient.auth.signInWithPassword({
    phone,
    password,
  });

  if (error || !data.user) {
    return null;
  }

  if (data.session) {
    const { error: signOutError } = await publicClient.auth.signOut();
    if (signOutError) {
      console.warn(`Unable to clear Supabase sign-in session: ${signOutError.message}`);
    }
  }

  return data.user;
};

const ensureStorageBucket = async () => {
  if (!adminClient || !config.supabaseStorageEnabled) {
    return false;
  }

  const { data, error } = await adminClient.storage.getBucket(config.supabaseStorageBucket);
  if (!error && data) {
    return true;
  }

  const { error: createError } = await adminClient.storage.createBucket(config.supabaseStorageBucket, {
    public: false,
    allowedMimeTypes: allowedBucketMimeTypes,
    fileSizeLimit: MAX_UPLOAD_BYTES,
  });

  if (createError && !/exists/i.test(createError.message)) {
    throw new Error(`Unable to create Supabase Storage bucket "${config.supabaseStorageBucket}": ${createError.message}`);
  }

  return true;
};

export const uploadSupabaseStorageObject = async ({
  objectPath,
  body,
  contentType,
}: {
  objectPath: string;
  body: Buffer;
  contentType: string;
}) => {
  if (!adminClient) {
    throw new Error("Supabase Storage is not configured.");
  }

  await ensureStorageBucket();
  const { error } = await adminClient.storage.from(config.supabaseStorageBucket).upload(objectPath, body, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Unable to upload file to Supabase Storage: ${error.message}`);
  }

  return `supabase://${config.supabaseStorageBucket}/${objectPath}`;
};

const parseSupabaseStoragePath = (storagePath: string) => {
  const prefix = "supabase://";
  if (!storagePath.startsWith(prefix)) {
    return null;
  }

  const remainder = storagePath.slice(prefix.length);
  const slashIndex = remainder.indexOf("/");
  if (slashIndex < 0) {
    return null;
  }

  const bucket = remainder.slice(0, slashIndex);
  const objectPath = remainder.slice(slashIndex + 1);
  return bucket && objectPath ? { bucket, objectPath } : null;
};

export const deleteSupabaseStorageObject = async (storagePath: string) => {
  if (!adminClient) {
    return;
  }

  const parsed = parseSupabaseStoragePath(storagePath);
  if (!parsed) {
    return;
  }

  const { error } = await adminClient.storage.from(parsed.bucket).remove([parsed.objectPath]);
  if (error) {
    console.error(`Unable to delete Supabase Storage object ${storagePath}: ${error.message}`);
  }
};

export const syncSeedUserToSupabase = async ({
  email,
  phone,
  password,
  localUserId,
  name,
  role,
  marketId,
}: {
  email: string;
  phone: string;
  password: string;
  localUserId: string;
  name: string;
  role: "vendor" | "manager" | "official" | "admin";
  marketId: string | null;
}) => {
  if (!adminClient) {
    return null;
  }

  const existing = await findSupabaseAuthUser({ phone, email });
  if (existing) {
    return await updateSupabaseAuthUser(existing.id, {
      email,
      phone,
      password,
      localUserId,
      name,
      role,
      marketId,
    });
  }

  return await createSupabaseAuthUser({
    email,
    phone,
    password,
    localUserId,
    name,
    role,
    marketId,
  });
};

export type SupabaseAuthUser = User;
