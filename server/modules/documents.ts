import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { validateFilePayload } from "../lib/storage.ts";
import type { FilePayload } from "../types.ts";

type NationalIdOcrFields = {
  fullName: string | null;
  nin: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  district: string | null;
};

const emptyFields: NationalIdOcrFields = {
  fullName: null,
  nin: null,
  dateOfBirth: null,
  gender: null,
  nationality: null,
  district: null,
};

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
};

const readNestedValue = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
};

const normalizeOcrPayload = (payload: unknown): NationalIdOcrFields => {
  if (!payload || typeof payload !== "object") {
    return emptyFields;
  }

  const record = payload as Record<string, unknown>;
  const data = (record.data && typeof record.data === "object" ? record.data : record) as Record<string, unknown>;
  const fields = (data.fields && typeof data.fields === "object" ? data.fields : data) as Record<string, unknown>;

  return {
    fullName: normalizeString(readNestedValue(fields, ["fullName", "full_name", "name", "surname"])),
    nin: normalizeString(readNestedValue(fields, ["nin", "nationalIdNumber", "national_id_number", "idNumber", "id_number"])),
    dateOfBirth: normalizeString(readNestedValue(fields, ["dateOfBirth", "date_of_birth", "dob"])),
    gender: normalizeString(readNestedValue(fields, ["gender", "sex"])),
    nationality: normalizeString(readNestedValue(fields, ["nationality", "citizenship"])),
    district: normalizeString(readNestedValue(fields, ["district", "residenceDistrict", "residence_district"])),
  };
};

const hasAnyField = (fields: NationalIdOcrFields) => Object.values(fields).some(Boolean);

export const documentRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/documents/national-id/ocr",
    handler: async ({ req, res, config }) => {
      const body = await readJsonBody<{ idDocument: FilePayload | null }>(req);
      validateFilePayload(body.idDocument, ["application/pdf", "image/jpeg", "image/png"], true);

      if (!config.ocrServiceUrl) {
        sendJson(res, 200, {
          status: "unavailable",
          fields: emptyFields,
          message: "OCR service is not configured.",
        });
        return;
      }

      const response = await fetch(config.ocrServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.ocrServiceApiKey ? { Authorization: `Bearer ${config.ocrServiceApiKey}` } : {}),
        },
        body: JSON.stringify({ idDocument: body.idDocument }),
      });

      if (!response.ok) {
        throw new HttpError(502, "Unable to read the National ID document.");
      }

      const fields = normalizeOcrPayload(await response.json());
      sendJson(res, 200, {
        status: hasAnyField(fields) ? "extracted" : "not_extracted",
        fields,
      });
    },
  },
];
