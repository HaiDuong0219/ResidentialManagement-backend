import { sql } from "../config/db.js";

export const createHousehold = async (req, res) => {
  const { household_code, head_id, house_number, street } = req.body;
  
  if (!household_code) {
    return res.status(400).json({ error: 'Household code is required' });
  }
  
  try {
    await sql.query(
      "INSERT INTO household (household_code, head_id, house_number, street) VALUES ($1, $2, $3, $4)", 
      [household_code, head_id, house_number, street]
    );
    res.status(201).json({ success: true, message: 'Household created successfully' });
  } catch (error) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Household code already exists' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

export const getAllHouseholds = async (req, res) => {
  try {
    const households = await sql.query(`
      SELECT h.*, r.full_name as head_name 
      FROM household h 
      LEFT JOIN resident r ON h.head_id = r.id
      ORDER BY h.household_code
    `);
    res.status(200).json({ success: true, data: households });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getHouseholdById = async (req, res) => {
  const { id } = req.params;
  try {
    const household = await sql.query(`
      SELECT h.*, r.full_name as head_name 
      FROM household h 
      LEFT JOIN resident r ON h.head_id = r.id
      WHERE h.id = $1
    `, [id]);
    
    if (household.length === 0) {
      return res.status(404).json({ error: 'Household not found' });
    }
    
    res.status(200).json({ success: true, data: household[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getHouseholdByCode = async (req, res) => {
  const { household_code } = req.params;
  try {
    const household = await sql.query(`
      SELECT h.*, r.full_name as head_name 
      FROM household h 
      LEFT JOIN resident r ON h.head_id = r.id
      WHERE h.household_code = $1
    `, [household_code]);
    
    if (household.length === 0) {
      return res.status(404).json({ error: 'Household not found' });
    }
    
    res.status(200).json({ success: true, data: household[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getHouseholdResidents = async (req, res) => {
  const { household_code } = req.params;
  try {
    const household = await sql.query(
      `SELECT id FROM household WHERE household_code = $1`,
      [household_code]
    );

    if (household.length === 0) {
      return res.status(404).json({ error: "Household not found" });
    }

    const residents = await sql.query(
      `
      SELECT *
      FROM resident
      WHERE household_id = $1
      ORDER BY relation_to_head, full_name
      `,
      [household[0].id]
    );
    
    res.status(200).json({ success: true, data: residents });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const splitHousehold = async (req, res) => {
  const { id } = req.params;
  const {
    new_household_code,
    house_number,
    street,
    resident_ids,
    head_id,
    relations,
  } = req.body;

  const ALLOWED_RELATIONS = [
    "Vợ",
    "Chồng",
    "Cha đẻ",
    "Mẹ đẻ",
    "Cha vợ",
    "Mẹ vợ",
    "Cha chồng",
    "Mẹ chồng",
    "Cha nuôi",
    "Mẹ nuôi",
    "Cha dượng",
    "Mẹ kế",
    "Con đẻ",
    "Con dâu",
    "Con rể",
    "Con nuôi",
    "Con riêng của vợ hoặc chồng",
    "Ông nội",
    "Bà nội",
    "Ông ngoại",
    "Bà ngoại",
    "Anh ruột",
    "Chị ruột",
    "Em ruột",
    "Cháu ruột",
    "Anh, chị, em cùng cha khác mẹ",
    "Anh, chị, em cùng mẹ khác cha",
    "Anh rể",
    "Em rể",
    "Chị dâu",
    "Em dâu",
    "Cụ nội",
    "Cụ ngoại",
    "Cháu nội",
    "Cháu ngoại",
    "Bác ruột",
    "Chú ruột",
    "Cậu ruột",
    "Cô ruột",
    "Dì ruột",
    "Chắt ruột",
    "Người giám hộ",
    "Người được giám hộ",
    "Ở nhờ",
    "Ở mượn",
    "Ở thuê",
    "Cùng ở nhờ",
    "Cùng ở thuê",
    "Cùng ở mượn",
  ];
  const allowedRelationByLower = new Map(
    ALLOWED_RELATIONS.map((r) => [r.toLocaleLowerCase("vi").trim(), r])
  );

  if (!new_household_code) {
    return res.status(400).json({ error: "new_household_code is required" });
  }
  if (!Array.isArray(resident_ids) || resident_ids.length === 0) {
    return res.status(400).json({ error: "resident_ids is required" });
  }
  if (head_id !== undefined && head_id !== null) {
    const headIdNum = Number(head_id);
    if (Number.isNaN(headIdNum)) {
      return res.status(400).json({ error: "head_id must be a number" });
    }
    if (!resident_ids.map(Number).includes(headIdNum)) {
      return res.status(400).json({ error: "head_id must be one of resident_ids" });
    }
  }

  try {
    const residentIdsNum = resident_ids.map(Number).filter((n) => !Number.isNaN(n));
    if (residentIdsNum.length !== resident_ids.length) {
      return res.status(400).json({ error: "resident_ids must be numbers" });
    }

    // relations: optional, array of { resident_id, relation_to_head }
    const relationsArray = Array.isArray(relations) ? relations : [];
    const relationMap = new Map();
    for (const item of relationsArray) {
      const rid = Number(item?.resident_id);
      const relRaw = typeof item?.relation_to_head === "string" ? item.relation_to_head.trim() : "";
      if (Number.isNaN(rid) || !relRaw) continue;
      if (!residentIdsNum.includes(rid)) {
        return res.status(400).json({ error: "relations must be subset of resident_ids" });
      }

      const canonical = allowedRelationByLower.get(relRaw.toLocaleLowerCase("vi").trim());
      if (!canonical) {
        return res.status(400).json({
          error: "relation_to_head is not allowed",
          allowed_relations: ALLOWED_RELATIONS,
        });
      }

      relationMap.set(rid, canonical);
    }

    // Do not allow overriding head relation via relations
    if (head_id !== undefined && head_id !== null) {
      const hid = Number(head_id);
      relationMap.delete(hid);
    }

    const relationsJson = JSON.stringify(
      Array.from(relationMap.entries()).map(([resident_id, relation_to_head]) => ({
        resident_id,
        relation_to_head,
      }))
    );

    // One statement to ensure: old household exists, all residents belong to old household (by household.id),
    // then insert new household and move residents. If any condition fails, nothing changes.
    const result = await sql.query(
      `
      WITH old_household AS (
        SELECT id, household_code, head_id
        FROM household
        WHERE id = $1
      ),
      selected AS (
        SELECT r.id
        FROM resident r
        JOIN old_household oh ON TRUE
        WHERE r.id = ANY($2::int[]) AND r.household_id = oh.id
      ),
      valid AS (
        SELECT
          (SELECT COUNT(*) FROM old_household) AS old_exists,
          (SELECT COUNT(*) FROM selected) AS selected_count,
          (SELECT COUNT(*) FROM unnest($2::int[])) AS requested_count
      ),
      ins AS (
        INSERT INTO household (household_code, head_id, house_number, street)
        SELECT $3, $4, $5, $6
        WHERE (SELECT old_exists FROM valid) = 1
          AND (SELECT selected_count FROM valid) = (SELECT requested_count FROM valid)
        RETURNING id, household_code
      ),
      rel_map AS (
        SELECT *
        FROM jsonb_to_recordset($7::jsonb) AS x(resident_id int, relation_to_head text)
      ),
      upd AS (
        UPDATE resident r
        SET
          household_id = (SELECT id FROM ins),
          relation_to_head = CASE
            WHEN $4::int IS NOT NULL AND r.id = $4::int THEN 'Chủ hộ'
            ELSE COALESCE(
              (SELECT rm.relation_to_head FROM rel_map rm WHERE rm.resident_id = r.id),
              r.relation_to_head
            )
          END
        WHERE r.id = ANY($2::int[])
          AND r.household_id = (SELECT id FROM old_household)
          AND EXISTS (SELECT 1 FROM ins)
        RETURNING r.id
      ),
      fix_old AS (
        UPDATE household
        SET head_id = NULL
        WHERE id = $1
          AND head_id = ANY($2::int[])
          AND EXISTS (SELECT 1 FROM ins)
        RETURNING id
      )
      SELECT
        (SELECT old_exists FROM valid) AS old_exists,
        (SELECT selected_count FROM valid) AS moved_count,
        (SELECT requested_count FROM valid) AS requested_count,
        (SELECT COUNT(*) FROM ins) AS inserted_count,
        (SELECT COUNT(*) FROM upd) AS moved_rows,
        (SELECT COUNT(*) FROM rel_map) AS provided_rel_rows,
        (SELECT COUNT(*) FROM fix_old) AS cleared_old_head_rows,
        (SELECT household_code FROM old_household) AS old_household_code,
        (SELECT household_code FROM ins) AS new_household_code;
      `,
      [
        id,
        residentIdsNum,
        new_household_code,
        head_id ?? null,
        house_number ?? null,
        street ?? null,
        relationsJson,
      ]
    );

    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (!row || Number(row.old_exists) !== 1) {
      return res.status(404).json({ error: "Household not found" });
    }
    if (Number(row.inserted_count) !== 1) {
      return res.status(400).json({
        error:
          "Cannot split household. Ensure selected residents belong to the household.",
      });
    }

    res.status(201).json({
      success: true,
      message: "Household split successfully",
      data: {
        old_household_code: row.old_household_code,
        new_household_code: row.new_household_code,
        moved_count: Number(row.moved_count) || 0,
        _debug: {
          moved_rows: Number(row.moved_rows) || 0,
          provided_rel_rows: Number(row.provided_rel_rows) || 0,
          cleared_old_head_rows: Number(row.cleared_old_head_rows) || 0,
        },
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "Household code already exists" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateHousehold = async (req, res) => {
  const { id } = req.params;
  const { household_code, head_id, house_number, street } = req.body;
  
  try {
    const existingHousehold = await sql.query('SELECT id FROM household WHERE id = $1', [id]);
    
    if (existingHousehold.length === 0) {
      return res.status(404).json({ error: 'Household not found' });
    }
    
    await sql.query(
      "UPDATE household SET household_code = $1, head_id = $2, house_number = $3, street = $4 WHERE id = $5",
      [household_code, head_id, house_number, street, id]
    );
    
    res.status(200).json({ success: true, message: 'Household updated successfully' });
  } catch (error) {
    if (error.code === '23505') { 
      res.status(400).json({ error: 'Household code already exists' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

export const deleteHousehold = async (req, res) => {
  const { id } = req.params;
  
  try {
    const existing = await sql.query('SELECT id FROM household WHERE id = $1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Household not found' });
    }

    const residents = await sql.query('SELECT COUNT(*) FROM resident WHERE household_id = $1', [id]);
    
    if (residents[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete household with existing residents. Please move residents to another household first.' 
      });
    }
    
    const result = await sql.query("DELETE FROM household WHERE id = $1", [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Household not found' });
    }
    
    res.status(200).json({ success: true, message: 'Household deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


