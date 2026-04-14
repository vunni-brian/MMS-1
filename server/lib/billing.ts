import { all, get, run } from "./db.ts";
import { HttpError } from "./http.ts";
import { nowIso } from "./security.ts";
import type { ChargeType, ChargeTypeName } from "../types.ts";

const chargeTypeSelect = `
  SELECT charge_types.id,
         charge_types.name,
         charge_types.display_name,
         charge_types.scope,
         charge_types.market_id,
         charge_types.is_enabled,
         charge_types.updated_by,
         charge_types.updated_at,
         users.name AS updated_by_name
  FROM charge_types
  LEFT JOIN users ON users.id = charge_types.updated_by
`;

const mapChargeType = (row: {
  id: string;
  name: ChargeTypeName;
  display_name: string;
  scope: "global" | "market";
  market_id: string | null;
  is_enabled: number;
  updated_by: string | null;
  updated_at: string;
  updated_by_name: string | null;
}): ChargeType => ({
  id: row.id,
  name: row.name,
  displayName: row.display_name,
  scope: row.scope,
  marketId: row.market_id,
  isEnabled: Boolean(row.is_enabled),
  updatedBy: row.updated_by,
  updatedByName: row.updated_by_name,
  updatedAt: row.updated_at,
});

export const listChargeTypes = async (marketId?: string | null) => {
  const globalRows = await all<{
    id: string;
    name: ChargeTypeName;
    display_name: string;
    scope: "global" | "market";
    market_id: string | null;
    is_enabled: number;
    updated_by: string | null;
    updated_at: string;
    updated_by_name: string | null;
  }>(`${chargeTypeSelect} WHERE charge_types.scope = 'global' ORDER BY charge_types.display_name ASC`);

  if (!marketId) {
    return globalRows.map(mapChargeType);
  }

  const overrideRows = await all<{
    id: string;
    name: ChargeTypeName;
    display_name: string;
    scope: "global" | "market";
    market_id: string | null;
    is_enabled: number;
    updated_by: string | null;
    updated_at: string;
    updated_by_name: string | null;
  }>(`${chargeTypeSelect} WHERE charge_types.scope = 'market' AND charge_types.market_id = ?`, [marketId]);

  const overrides = new Map(overrideRows.map((row) => [row.name, mapChargeType(row)]));
  return globalRows.map((row) => overrides.get(row.name) || mapChargeType(row));
};

export const getChargeTypeById = async (chargeTypeId: string) => {
  const row = await get<{
    id: string;
    name: ChargeTypeName;
    display_name: string;
    scope: "global" | "market";
    market_id: string | null;
    is_enabled: number;
    updated_by: string | null;
    updated_at: string;
    updated_by_name: string | null;
  }>(`${chargeTypeSelect} WHERE charge_types.id = ?`, [chargeTypeId]);

  return row ? mapChargeType(row) : null;
};

export const getResolvedChargeType = async ({
  name,
  marketId,
}: {
  name: ChargeTypeName;
  marketId?: string | null;
}) => {
  if (marketId) {
    const marketRow = await get<{
      id: string;
      name: ChargeTypeName;
      display_name: string;
      scope: "global" | "market";
      market_id: string | null;
      is_enabled: number;
      updated_by: string | null;
      updated_at: string;
      updated_by_name: string | null;
    }>(
      `${chargeTypeSelect}
       WHERE charge_types.name = ? AND charge_types.scope = 'market' AND charge_types.market_id = ?
       LIMIT 1`,
      [name, marketId],
    );

    if (marketRow) {
      return mapChargeType(marketRow);
    }
  }

  const globalRow = await get<{
    id: string;
    name: ChargeTypeName;
    display_name: string;
    scope: "global" | "market";
    market_id: string | null;
    is_enabled: number;
    updated_by: string | null;
    updated_at: string;
    updated_by_name: string | null;
  }>(
    `${chargeTypeSelect}
     WHERE charge_types.name = ? AND charge_types.scope = 'global'
     LIMIT 1`,
    [name],
  );

  return globalRow ? mapChargeType(globalRow) : null;
};

export const assertChargeEnabled = async (name: ChargeTypeName, marketId?: string | null) => {
  const chargeType = await getResolvedChargeType({ name, marketId });
  if (!chargeType) {
    throw new HttpError(500, `Charge type "${name}" is not configured.`);
  }
  if (!chargeType.isEnabled) {
    throw new HttpError(409, `${chargeType.displayName} is currently disabled.`);
  }
  return chargeType;
};

export const updateChargeType = async ({
  chargeTypeId,
  isEnabled,
  actorUserId,
}: {
  chargeTypeId: string;
  isEnabled: boolean;
  actorUserId: string;
}) => {
  await run(
    `UPDATE charge_types
     SET is_enabled = ?,
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`,
    [Number(isEnabled), actorUserId, nowIso(), chargeTypeId],
  );

  return await getChargeTypeById(chargeTypeId);
};
