import { sql } from "../config/db.js";

const normalizeRows = (result) => result?.rows ?? result;

export const getResidentLogs = async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const result = await sql.query(
      `
      SELECT
        rl.id,
        rl.subject_resident_id,
        rl.resident_id,
        rl.household_id_before,
        rl.household_id_after,
        hb.household_code AS household_code_before,
        ha.household_code AS household_code_after,
        hb.house_number AS house_number_before,
        hb.street AS street_before,
        ha.house_number AS house_number_after,
        ha.street AS street_after,
        rhb.full_name AS head_name_before,
        rha.full_name AS head_name_after,
        rl.change_type,
        rl.change_details,
        rl.note,
        rl.changed_by_account_id,
        rl.change_date,
        COALESCE(r.full_name, rl.change_details->'new'->>'full_name', rl.change_details->'old'->>'full_name') AS resident_name,
        COALESCE(r.id_number, rl.change_details->'new'->>'id_number', rl.change_details->'old'->>'id_number') AS id_number
      FROM residentlog rl
      LEFT JOIN resident r ON r.id = rl.subject_resident_id
      LEFT JOIN household hb ON hb.id = rl.household_id_before
      LEFT JOIN household ha ON ha.id = rl.household_id_after
      LEFT JOIN resident rhb ON rhb.id = hb.head_id
      LEFT JOIN resident rha ON rha.id = ha.head_id
      WHERE rl.subject_resident_id = $1
      ORDER BY rl.change_date DESC, rl.id DESC
      LIMIT $2 OFFSET $3
      `,
      [id, limit, offset]
    );

    res.status(200).json({ success: true, data: normalizeRows(result) });
  } catch (error) {
    console.error("getResidentLogs error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getHouseholdResidentLogs = async (req, res) => {
  const { id } = req.params;
  const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const q = qRaw.length ? qRaw : null;
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const result = await sql.query(
      `
      SELECT
        rl.id,
        rl.subject_resident_id,
        rl.resident_id,
        rl.household_id_before,
        rl.household_id_after,
        hb.household_code AS household_code_before,
        ha.household_code AS household_code_after,
        hb.house_number AS house_number_before,
        hb.street AS street_before,
        ha.house_number AS house_number_after,
        ha.street AS street_after,
        rhb.full_name AS head_name_before,
        rha.full_name AS head_name_after,
        rl.change_type,
        rl.change_details,
        rl.note,
        rl.changed_by_account_id,
        rl.change_date,
        COALESCE(r.full_name, rl.change_details->'new'->>'full_name', rl.change_details->'old'->>'full_name') AS resident_name,
        COALESCE(r.id_number, rl.change_details->'new'->>'id_number', rl.change_details->'old'->>'id_number') AS id_number
      FROM residentlog rl
      LEFT JOIN resident r ON r.id = rl.subject_resident_id
      LEFT JOIN household hb ON hb.id = rl.household_id_before
      LEFT JOIN household ha ON ha.id = rl.household_id_after
      LEFT JOIN resident rhb ON rhb.id = hb.head_id
      LEFT JOIN resident rha ON rha.id = ha.head_id
      WHERE (rl.household_id_before = $1 OR rl.household_id_after = $1)
        AND (
          $2::text IS NULL
          OR COALESCE(r.full_name, rl.change_details->'new'->>'full_name', rl.change_details->'old'->>'full_name') ILIKE ('%' || $2 || '%')
          OR COALESCE(r.id_number, rl.change_details->'new'->>'id_number', rl.change_details->'old'->>'id_number') ILIKE ('%' || $2 || '%')
          OR rl.change_type ILIKE ('%' || $2 || '%')
        )
      ORDER BY rl.change_date DESC, rl.id DESC
      LIMIT $3 OFFSET $4
      `,
      [id, q, limit, offset]
    );

    res.status(200).json({ success: true, data: normalizeRows(result) });
  } catch (error) {
    console.error("getHouseholdResidentLogs error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
