import { sql } from "../config/db.js";

const normalizeRows = (result) => result?.rows ?? result;

const pad2 = (n) => String(n).padStart(2, "0");

// Convert a Date/ISO value into local YYYY-MM-DD (date-only).
// This avoids the common off-by-one-day bug when DATE columns are serialized as JS Date.
const toLocalYmd = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const normalizeResidentDates = (row) => {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    date_of_birth: toLocalYmd(row.date_of_birth),
    id_issue_date: toLocalYmd(row.id_issue_date),
    registration_date: toLocalYmd(row.registration_date),
  };
};

export const createResident = async (req, res) => {
  const {
    household_id,
    full_name,
    date_of_birth,
    place_of_birth,
    native_place,
    ethnicity,
    occupation,
    id_number,
    id_issue_date,
    id_issue_place,
    registration_date,
    relation_to_head,
    gender,
    status,
  } = req.body;

  const fullName = typeof full_name === "string" ? full_name.trim() : full_name;
  const dateOfBirthYmd = toLocalYmd(date_of_birth);
  const idIssueDateYmd = toLocalYmd(id_issue_date);
  const registrationDateYmd = toLocalYmd(registration_date);

  const missingFields = [];
  if (!fullName) missingFields.push("full_name");
  if (!dateOfBirthYmd) missingFields.push("date_of_birth");
  if (missingFields.length > 0) {
    return res.status(400).json({ error: "Please fill all required fields", missing_fields: missingFields });
  }

  // Validate optional date fields if provided.
  if (id_issue_date !== null && id_issue_date !== undefined && id_issue_date !== "" && !idIssueDateYmd) {
    return res.status(400).json({ error: "Invalid id_issue_date" });
  }
  if (registration_date !== null && registration_date !== undefined && registration_date !== "" && !registrationDateYmd) {
    return res.status(400).json({ error: "Invalid registration_date" });
  }

  // household_id is optional (schema allows NULL). If provided, it must be a positive integer.
  let householdId = household_id;
  if (typeof householdId === "string") householdId = householdId.trim();
  if (householdId === "") householdId = null;
  if (householdId !== null && householdId !== undefined) {
    const n = Number(householdId);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ error: "Invalid household_id" });
    }
    householdId = n;
  } else {
    householdId = null;
  }

  try {
    const result = await sql.query(
      `
      WITH ins AS (
        INSERT INTO resident (
          household_id,
          full_name,
          date_of_birth,
          place_of_birth,
          native_place,
          ethnicity,
          occupation,
          id_number,
          id_issue_date,
          id_issue_place,
          registration_date,
          relation_to_head,
          gender,
          status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id, household_id, to_jsonb(resident.*) AS new_data
      ), log AS (
        INSERT INTO residentlog (
          subject_resident_id,
          resident_id,
          household_id_before,
          household_id_after,
          change_type,
          change_details
        )
        SELECT
          ins.id,
          ins.id,
          NULL,
          ins.household_id,
          'CREATE',
          jsonb_build_object('old', NULL, 'new', ins.new_data, 'meta', jsonb_build_object('source', 'createResident'))
        FROM ins
        RETURNING id
      )
      SELECT ins.id AS resident_id FROM ins;
      `,
      [
        householdId,
        fullName,
        dateOfBirthYmd,
        place_of_birth ?? null,
        native_place ?? null,
        ethnicity ?? null,
        occupation ?? null,
        id_number ?? null,
        idIssueDateYmd,
        id_issue_place ?? null,
        registrationDateYmd,
        relation_to_head ?? null,
        gender ?? null,
        status ?? "Permanent",
      ]
    );

    const rows = normalizeRows(result);
    res.status(201).json({
      success: true,
      message: "Resident created successfully",
      data: { id: rows?.[0]?.resident_id ?? null },
    });
  } catch (error) {
    if (error && error.code === "23505") {
      return res.status(400).json({ error: "ID number already exists" });
    }
    if (error && error.code === "23503") {
      return res.status(400).json({ error: "Invalid household_id" });
    }
    console.error("createResident error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllResidents = async (req, res) => {
  try {
    const result = await sql.query("SELECT * FROM resident ORDER BY id");
    const rows = normalizeRows(result);
    res.status(200).json({ success: true, data: Array.isArray(rows) ? rows.map(normalizeResidentDates) : rows });
  } catch (error) {
    console.error("getAllResidents error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getResidentById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sql.query(`SELECT * FROM resident WHERE id = $1`, [id]);
    const rows = normalizeRows(result);
    if (rows.length === 0) return res.status(404).json({ error: "Resident not found" });
    res.status(200).json({ success: true, data: normalizeResidentDates(rows[0]) });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getResidentsByHouseholdId = async (req, res) => {
  const { household_id } = req.params;
  try {
    const result = await sql.query(
      "SELECT * FROM resident WHERE household_id = $1 ORDER BY relation_to_head, full_name",
      [household_id]
    );
    const rows = normalizeRows(result);
    res.status(200).json({ success: true, data: Array.isArray(rows) ? rows.map(normalizeResidentDates) : rows });
  } catch (error) {
    console.error("getResidentsByHouseholdId error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateResident = async (req, res) => {
  const { id } = req.params;
  const {
    household_id,
    full_name,
    date_of_birth,
    place_of_birth,
    native_place,
    ethnicity,
    occupation,
    id_number,
    id_issue_date,
    id_issue_place,
    registration_date,
    relation_to_head,
    gender,
    status,
  } = req.body;

  const dateOfBirthYmd = toLocalYmd(date_of_birth);
  const idIssueDateYmd = toLocalYmd(id_issue_date);
  const registrationDateYmd = toLocalYmd(registration_date);

  // Keep existing behavior but avoid passing invalid empty strings to DATE columns.
  if (date_of_birth !== null && date_of_birth !== undefined && date_of_birth !== "" && !dateOfBirthYmd) {
    return res.status(400).json({ error: "Invalid date_of_birth" });
  }
  if (id_issue_date !== null && id_issue_date !== undefined && id_issue_date !== "" && !idIssueDateYmd) {
    return res.status(400).json({ error: "Invalid id_issue_date" });
  }
  if (registration_date !== null && registration_date !== undefined && registration_date !== "" && !registrationDateYmd) {
    return res.status(400).json({ error: "Invalid registration_date" });
  }

  try {
    const result = await sql.query(
      `
      WITH old AS (
        SELECT
          id,
          household_id AS household_id_before,
          to_jsonb(resident.*) AS old_data
        FROM resident
        WHERE id = $15
      ), upd AS (
        UPDATE resident SET
          household_id = $1,
          full_name = $2,
          date_of_birth = $3,
          place_of_birth = $4,
          native_place = $5,
          ethnicity = $6,
          occupation = $7,
          id_number = $8,
          id_issue_date = $9,
          id_issue_place = $10,
          registration_date = $11,
          relation_to_head = $12,
          gender = $13,
          status = $14
        WHERE id = $15
        RETURNING id, household_id AS household_id_after, to_jsonb(resident.*) AS new_data
      ), log AS (
        INSERT INTO residentlog (
          subject_resident_id,
          resident_id,
          household_id_before,
          household_id_after,
          change_type,
          change_details
        )
        SELECT
          upd.id,
          upd.id,
          old.household_id_before,
          upd.household_id_after,
          CASE
            WHEN old.household_id_before IS DISTINCT FROM upd.household_id_after THEN 'MOVE_HOUSEHOLD'
            ELSE 'UPDATE'
          END,
          jsonb_build_object(
            'old', old.old_data,
            'new', upd.new_data,
            'meta', jsonb_build_object('source', 'updateResident')
          )
        FROM old
        JOIN upd ON upd.id = old.id
        RETURNING id
      )
      SELECT (SELECT COUNT(*) FROM old) AS old_exists;
      `,
      [
        household_id ?? null,
        full_name ?? null,
        dateOfBirthYmd,
        place_of_birth ?? null,
        native_place ?? null,
        ethnicity ?? null,
        occupation ?? null,
        id_number ?? null,
        idIssueDateYmd,
        id_issue_place ?? null,
        registrationDateYmd,
        relation_to_head ?? null,
        gender ?? null,
        status ?? null,
        id,
      ]
    );

    const rows = normalizeRows(result);
    if (!rows?.[0] || Number(rows[0].old_exists) !== 1) {
      return res.status(404).json({ error: "Resident not found" });
    }

    res.status(200).json({ success: true, message: "Resident updated successfully" });
  } catch (error) {
    if (error && error.code === "23505") {
      return res.status(400).json({ error: "ID number already exists" });
    }
    if (error && error.code === "23503") {
      return res.status(400).json({ error: "Invalid household_id" });
    }
    console.error("updateResident error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteResident = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sql.query(
      `
      WITH old AS (
        SELECT
          id,
          household_id AS household_id_before,
          to_jsonb(resident.*) AS old_data
        FROM resident
        WHERE id = $1
      ), del AS (
        DELETE FROM resident
        WHERE id = $1
        RETURNING id
      ), log AS (
        INSERT INTO residentlog (
          subject_resident_id,
          resident_id,
          household_id_before,
          household_id_after,
          change_type,
          change_details
        )
        SELECT
          old.id,
          NULL,
          old.household_id_before,
          NULL,
          'DELETE',
          jsonb_build_object('old', old.old_data, 'new', NULL, 'meta', jsonb_build_object('source', 'deleteResident'))
        FROM old
        WHERE EXISTS (SELECT 1 FROM del)
        RETURNING id
      )
      SELECT (SELECT COUNT(*) FROM del) AS deleted_count;
      `,
      [id]
    );

    const rows = normalizeRows(result);
    if (!rows?.[0] || Number(rows[0].deleted_count) !== 1) {
      return res.status(404).json({ error: "Resident not found" });
    }

    res.status(200).json({ success: true, message: "Resident deleted successfully" });
  } catch (error) {
    console.error("deleteResident error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getResidentStatistics = async (req, res) => {
  try {
    const genderStats = await sql.query(`
      SELECT gender, COUNT(*) as count
      FROM resident
      WHERE gender IS NOT NULL
      GROUP BY gender
    `);

    const ageStats = await sql.query(`
      WITH age_categories AS (
        SELECT
          CASE
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 6 THEN 'Mầm non'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 6 AND 10 THEN 'Cấp 1'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 11 AND 14 THEN 'Cấp 2'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 15 AND 17 THEN 'Cấp 3'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 60 THEN 'Lao động'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) > 60 THEN 'Nghỉ hưu'
            ELSE 'Khác'
          END as age_group
        FROM resident
        WHERE date_of_birth IS NOT NULL
      )
      SELECT age_group, COUNT(*) as count FROM age_categories GROUP BY age_group
    `);

    const totalRows = await sql.query(`SELECT COUNT(*) as total FROM resident`);

    const genderData = { male: 0, female: 0 };
    (genderStats || []).forEach((r) => {
      if (!r || !r.gender) return;
      if (r.gender === "Nam" || r.gender === "Male") genderData.male += Number(r.count) || 0;
      else if (r.gender === "Nữ" || r.gender === "Female") genderData.female += Number(r.count) || 0;
    });

    const ageData = {};
    (ageStats || []).forEach((r) => {
      if (!r || !r.age_group) return;
      ageData[r.age_group] = Number(r.count) || 0;
    });

    const total = (totalRows && totalRows[0] && Number(totalRows[0].total)) || 0;

    res.status(200).json({
      success: true,
      data: { total, byGender: genderData, byAge: ageData },
    });
  } catch (error) {
    console.error("getResidentStatistics error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};