import { sql } from "../config/db.js";

const normalizeRows = (result) => result?.rows ?? result;

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
      ORDER BY h.id
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

    const rows = normalizeRows(residents);
    res.status(200).json({ success: true, data: Array.isArray(rows) ? rows.map(normalizeResidentDates) : rows });
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

    const result = await sql.query(
      `
      WITH old_household AS (
        SELECT id, household_code, head_id
        FROM household
        WHERE id = $1
      ),
      pre AS (
        SELECT r.id,
               r.household_id AS household_id_before,
               to_jsonb(r.*) AS old_data
        FROM resident r
        JOIN old_household oh ON TRUE
        WHERE r.id = ANY($2::int[]) AND r.household_id = oh.id
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
        RETURNING r.id, r.household_id AS household_id_after, to_jsonb(r.*) AS new_data
      ),
      log_move AS (
        INSERT INTO residentlog (
          subject_resident_id,
          resident_id,
          household_id_before,
          household_id_after,
          change_type,
          change_details
        )
        SELECT
          pre.id,
          pre.id,
          pre.household_id_before,
          upd.household_id_after,
          'HOUSEHOLD_SPLIT',
          jsonb_build_object(
            'old', pre.old_data,
            'new', upd.new_data,
            'meta', jsonb_build_object(
              'source', 'splitHousehold',
              'old_household_id', (SELECT id FROM old_household),
              'new_household_id', (SELECT id FROM ins),
              'new_household_code', (SELECT household_code FROM ins)
            )
          )
        FROM pre
        JOIN upd ON upd.id = pre.id
        RETURNING id
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
        (SELECT COUNT(*) FROM log_move) AS log_rows,
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

    const rows = normalizeRows(result);
    const row = rows?.[0];
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
    const existingHouseholdResult = await sql.query(
      'SELECT id, household_code, head_id, house_number, street FROM household WHERE id = $1',
      [id]
    );
    const existingHousehold = normalizeRows(existingHouseholdResult);
    if (existingHousehold.length === 0) return res.status(404).json({ error: 'Household not found' });
    const old = existingHousehold[0];

    const updateResult = await sql.query(
      "UPDATE household SET household_code = $1, head_id = $2, house_number = $3, street = $4 WHERE id = $5 RETURNING id, household_code, head_id, house_number, street",
      [household_code, head_id, house_number, street, id]
    );
    const updatedRows = normalizeRows(updateResult);
    const updated = updatedRows?.[0];

    // Log head change as ONE ResidentLog row (avoid duplicated rows)
    const oldHead = old?.head_id ?? null;
    const newHead = updated?.head_id ?? null;
    if (oldHead !== newHead && (oldHead !== null || newHead !== null)) {
      const meta = {
        source: 'updateHousehold',
        household_id: Number(id),
        household_code_before: old?.household_code ?? null,
        household_code_after: updated?.household_code ?? null,
        head_id_before: oldHead,
        head_id_after: newHead,
      };

      // Choose a stable subject for the log (prefer new head, fallback to old head)
      const subjectId = newHead ?? oldHead;

      // Capture both before/after head identities for UI
      const headInfoResult = await sql.query(
        `
        SELECT
          (SELECT jsonb_build_object('id', r1.id, 'full_name', r1.full_name, 'id_number', r1.id_number)
           FROM resident r1 WHERE r1.id = $1) AS before_head,
          (SELECT jsonb_build_object('id', r2.id, 'full_name', r2.full_name, 'id_number', r2.id_number)
           FROM resident r2 WHERE r2.id = $2) AS after_head
        `,
        [oldHead, newHead]
      );
      const headInfoRows = normalizeRows(headInfoResult);
      const beforeHead = headInfoRows?.[0]?.before_head ?? null;
      const afterHead = headInfoRows?.[0]?.after_head ?? null;

      await sql.query(
        `
        INSERT INTO residentlog (
          subject_resident_id,
          resident_id,
          household_id_before,
          household_id_after,
          change_type,
          change_details
        ) VALUES ($1, $1, $2, $2, 'HEAD_CHANGED', $3::jsonb)
        `,
        [
          subjectId,
          Number(id),
          JSON.stringify({ old: null, new: null, meta, before_head: beforeHead, after_head: afterHead }),
        ]
      );
    }

    res.status(200).json({ success: true, message: 'Household updated successfully' });
  } catch (error) {
    if (error.code === '23505') { 
      res.status(400).json({ error: 'Household code already exists' });
    } else {
      console.error('updateHousehold error:', error);
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


