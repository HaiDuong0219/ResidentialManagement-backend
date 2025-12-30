import { sql } from "../config/db.js";

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

  if (!household_id || !full_name || !date_of_birth) {
    return res.status(400).json({ error: "Please fill all required fields" });
  }

  try {
    await sql.query(
      `INSERT INTO resident (
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        household_id,
        full_name,
        date_of_birth,
        place_of_birth ?? null,
        native_place ?? null,
        ethnicity ?? null,
        occupation ?? null,
        id_number ?? null,
        id_issue_date ?? null,
        id_issue_place ?? null,
        registration_date ?? null,
        relation_to_head ?? null,
        gender ?? null,
        status ?? 'Permanent',
      ]
    );

    res.status(201).json({ success: true, message: "Resident created successfully" });
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
    const rows = await sql.query("SELECT * FROM resident ORDER BY id");
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("getAllResidents error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getResidentById = async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql.query(`SELECT * FROM resident WHERE id = $1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Resident not found" });
    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getResidentsByHouseholdId = async (req, res) => {
  const { household_id } = req.params;
  try {
    const rows = await sql.query(
      "SELECT * FROM resident WHERE household_id = $1 ORDER BY relation_to_head, full_name",
      [household_id]
    );
    res.status(200).json({ success: true, data: rows });
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

  try {
    const existing = await sql.query("SELECT id FROM resident WHERE id = $1", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Resident not found" });

    await sql.query(
      `UPDATE resident SET
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
      WHERE id = $15`,
      [
        household_id ?? null,
        full_name ?? null,
        date_of_birth ?? null,
        place_of_birth ?? null,
        native_place ?? null,
        ethnicity ?? null,
        occupation ?? null,
        id_number ?? null,
        id_issue_date ?? null,
        id_issue_place ?? null,
        registration_date ?? null,
        relation_to_head ?? null,
        gender ?? null,
        status ?? null,
        id,
      ]
    );

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
    const existing = await sql.query("SELECT id FROM resident WHERE id = $1", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Resident not found" });

    await sql.query("DELETE FROM resident WHERE id = $1", [id]);
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