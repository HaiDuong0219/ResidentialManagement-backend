import { sql } from "../config/db.js";

const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const normalizeOptionalInt = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

export const createTemporaryStayLeave = async (req, res) => {
  const {
    resident_id,
    declarant_name,
    paper_type,
    temporary_address,
    temporary_household_id,
    start_date,
    end_date,
    reason,
  } = req.body;

  try {
    const created = await sql.query(
      `INSERT INTO temporarystayleave
        (resident_id, declarant_name, paper_type, temporary_address, temporary_household_id, start_date, end_date, reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [resident_id, declarant_name ?? null, paper_type, temporary_address ?? null, temporary_household_id ?? null, start_date, end_date ?? null, reason ?? null]
    );

    res.status(201).json({ success: true, data: Array.isArray(created) ? created[0] : created });
  } catch (error) {
    console.error("createTemporaryStayLeave error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const getAllTemporaryStayLeave = async (req, res) => {
  const resident_id = normalizeOptionalInt(req.query.resident_id);
  const paper_type = req.query.paper_type;

  try {
    const conditions = [];
    const params = [];

    if (resident_id !== null) {
      params.push(resident_id);
      conditions.push(`tsl.resident_id = $${params.length}`);
    }

    if (paper_type) {
      params.push(paper_type);
      conditions.push(`tsl.paper_type = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await sql.query(
      `SELECT
        tsl.*, 
        r.full_name AS resident_full_name,
        r.id_number AS resident_id_number,
        r.household_id AS resident_household_id,
        h.household_code AS resident_household_code,
        th.household_code AS temporary_household_code
      FROM temporarystayleave tsl
      JOIN resident r ON r.id = tsl.resident_id
      LEFT JOIN household h ON h.id = r.household_id
      LEFT JOIN household th ON th.id = tsl.temporary_household_id
      ${whereClause}
      ORDER BY tsl.id DESC`,
      params
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("getAllTemporaryStayLeave error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const getTemporaryStayLeaveById = async (req, res) => {
  const id = normalizeOptionalInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: "Invalid id" });

  try {
    const rows = await sql.query(
      `SELECT
        tsl.*, 
        r.full_name AS resident_full_name,
        r.id_number AS resident_id_number,
        r.household_id AS resident_household_id,
        h.household_code AS resident_household_code,
        th.household_code AS temporary_household_code
      FROM temporarystayleave tsl
      JOIN resident r ON r.id = tsl.resident_id
      LEFT JOIN household h ON h.id = r.household_id
      LEFT JOIN household th ON th.id = tsl.temporary_household_id
      WHERE tsl.id = $1`,
      [id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("getTemporaryStayLeaveById error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const updateTemporaryStayLeave = async (req, res) => {
  const id = normalizeOptionalInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: "Invalid id" });

  try {
    const {
      resident_id,
      declarant_name,
      paper_type,
      temporary_address,
      temporary_household_id,
      start_date,
      end_date,
      reason,
    } = req.body;

    const updated = await sql.query(
      `UPDATE temporarystayleave
      SET resident_id = $1,
          declarant_name = $2,
          paper_type = $3,
          temporary_address = $4,
          temporary_household_id = $5,
          start_date = $6,
          end_date = $7,
          reason = $8
      WHERE id = $9
      RETURNING *`,
      [resident_id, declarant_name ?? null, paper_type, temporary_address ?? null, temporary_household_id ?? null, start_date, end_date ?? null, reason ?? null, id]
    );

    if (!Array.isArray(updated) || updated.length === 0) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    res.status(200).json({ success: true, data: updated[0] });
  } catch (error) {
    console.error("updateTemporaryStayLeave error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const deleteTemporaryStayLeave = async (req, res) => {
  const id = normalizeOptionalInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: "Invalid id" });

  try {
    const deleted = await sql.query("DELETE FROM temporarystayleave WHERE id = $1 RETURNING id", [id]);
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    console.error("deleteTemporaryStayLeave error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
