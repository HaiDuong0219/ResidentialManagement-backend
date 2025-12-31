import { sql } from "../config/db.js";

const isValidDate = (value) => {
  if (!value) return false;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
};

const normalizeOptionalDate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value);
  const trimmed = s.length >= 10 ? s.slice(0, 10) : s;
  if (!isValidDate(trimmed)) return undefined;
  return trimmed;
};

const normalizeRequiredDate = (value) => {
  const normalized = normalizeOptionalDate(value);
  if (!normalized) return undefined;
  return normalized;
};

const normalizeRows = (result) => result?.rows ?? result;

const buildPaperNote = ({
  paperType,
  startDate,
  endDate,
  temporaryAddress,
  temporaryHouseholdId,
}) => {
  const typeText = paperType === "TemporaryStay" ? "tạm trú" : "tạm vắng";
  const rangeText = endDate ? `từ ${startDate} đến ${endDate}` : `từ ${startDate}`;
  const extra =
    paperType === "TemporaryStay"
      ? [
          temporaryAddress ? `địa chỉ: ${temporaryAddress}` : null,
          temporaryHouseholdId ? `hộ tạm trú: #${temporaryHouseholdId}` : null,
        ]
          .filter(Boolean)
          .join(", ")
      : null;
  return `Tạo giấy ${typeText} ${rangeText}${extra ? ` (${extra})` : ""}`;
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
    const residentId = normalizeOptionalInt(resident_id);
    if (!residentId) {
      return res.status(400).json({ success: false, error: "resident_id is required" });
    }

    const startDate = normalizeRequiredDate(start_date);
    if (!startDate) {
      return res.status(400).json({ success: false, error: "start_date is required" });
    }

    const endDate = normalizeOptionalDate(end_date);
    if (endDate === undefined) {
      return res.status(400).json({ success: false, error: "end_date is invalid" });
    }

    const paperType = paper_type || "TemporaryLeave";
    if (paperType !== "TemporaryLeave" && paperType !== "TemporaryStay") {
      return res.status(400).json({ success: false, error: "paper_type is invalid" });
    }

    const temporaryHouseholdId = normalizeOptionalInt(temporary_household_id);
    const temporaryAddress =
      paperType === "TemporaryStay" ? (temporary_address ?? null) : null;

    // Fetch resident + household snapshot for logging
    const residentResult = await sql.query(
      `SELECT id, household_id, full_name, id_number FROM resident WHERE id = $1`,
      [residentId]
    );
    const residentRows = normalizeRows(residentResult);
    if (!Array.isArray(residentRows) || residentRows.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid resident_id" });
    }
    const residentRow = residentRows[0];
    const householdIdBefore = residentRow?.household_id ?? null;
    const householdIdAfter =
      paperType === "TemporaryStay" && temporaryHouseholdId
        ? temporaryHouseholdId
        : householdIdBefore;

    const created = await sql.query(
      `INSERT INTO temporarystayleave
        (resident_id, declarant_name, paper_type, temporary_address, temporary_household_id, start_date, end_date, reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        residentId,
        declarant_name ?? null,
        paperType,
        temporaryAddress,
        temporaryHouseholdId,
        startDate,
        endDate,
        reason ?? null,
      ]
    );

    // Write resident log for household history
    const createdRows = normalizeRows(created);
    const createdRow = Array.isArray(createdRows) ? createdRows[0] : createdRows;
    const changeType = paperType === "TemporaryStay" ? "TEMPORARY_STAY" : "TEMPORARY_LEAVE";
    const note = buildPaperNote({
      paperType,
      startDate,
      endDate,
      temporaryAddress,
      temporaryHouseholdId,
    });

    await sql.query(
      `
      INSERT INTO residentlog (
        subject_resident_id,
        resident_id,
        household_id_before,
        household_id_after,
        change_type,
        change_details,
        note
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
      `,
      [
        residentId,
        residentId,
        householdIdBefore,
        householdIdAfter,
        changeType,
        JSON.stringify({
          old: null,
          new: null,
          meta: {
            source: "createTemporaryStayLeave",
            temporary_stay_leave_id: createdRow?.id ?? null,
            paper_type: paperType,
            resident: {
              id: residentRow?.id ?? residentId,
              full_name: residentRow?.full_name ?? null,
              id_number: residentRow?.id_number ?? null,
              household_id_before: householdIdBefore,
              household_id_after: householdIdAfter,
            },
            record: createdRow ?? null,
          },
        }),
        note,
      ]
    );

    // If user registers temporary stay into an existing household, move resident into that household
    // and mark status as TemporaryStay so the resident appears under the household.
    if (paperType === "TemporaryStay" && temporaryHouseholdId) {
      try {
        await sql.query(
          `
          WITH old AS (
            SELECT
              id,
              household_id AS household_id_before,
              to_jsonb(resident.*) AS old_data
            FROM resident
            WHERE id = $1
          ), upd AS (
            UPDATE resident
            SET household_id = $2,
                status = 'TemporaryStay'
            WHERE id = $1
            RETURNING id, household_id AS household_id_after, to_jsonb(resident.*) AS new_data
          ), log AS (
            INSERT INTO residentlog (
              subject_resident_id,
              resident_id,
              household_id_before,
              household_id_after,
              change_type,
              change_details,
              note
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
                'meta', jsonb_build_object(
                  'source', 'createTemporaryStayLeave',
                  'temporary_stay_leave_id', $3::int,
                  'paper_type', 'TemporaryStay'
                )
              ),
              'Tự động cập nhật hộ/tình trạng theo giấy tạm trú'
            FROM old
            JOIN upd ON upd.id = old.id
            RETURNING id
          )
          SELECT (SELECT COUNT(*) FROM old) AS old_exists;
          `,
          [residentId, temporaryHouseholdId, createdRow?.id ?? null]
        );
      } catch (moveErr) {
        // If the move fails (e.g., invalid household FK), surface a 400 error.
        if (moveErr && moveErr.code === "23503") {
          return res.status(400).json({ success: false, error: "Invalid temporary_household_id" });
        }
        throw moveErr;
      }
    }

    // If user registers temporary leave, mark resident status as TemporaryLeave.
    // (No household move for leave.)
    if (paperType === "TemporaryLeave") {
      await sql.query(
        `
        WITH old AS (
          SELECT
            id,
            household_id AS household_id_before,
            to_jsonb(resident.*) AS old_data
          FROM resident
          WHERE id = $1
        ), upd AS (
          UPDATE resident
          SET status = 'TemporaryLeave'
          WHERE id = $1
          RETURNING id, household_id AS household_id_after, to_jsonb(resident.*) AS new_data
        ), log AS (
          INSERT INTO residentlog (
            subject_resident_id,
            resident_id,
            household_id_before,
            household_id_after,
            change_type,
            change_details,
            note
          )
          SELECT
            upd.id,
            upd.id,
            old.household_id_before,
            upd.household_id_after,
            'UPDATE',
            jsonb_build_object(
              'old', old.old_data,
              'new', upd.new_data,
              'meta', jsonb_build_object(
                'source', 'createTemporaryStayLeave',
                'temporary_stay_leave_id', $2::int,
                'paper_type', 'TemporaryLeave'
              )
            ),
            'Tự động cập nhật trạng thái theo giấy tạm vắng'
          FROM old
          JOIN upd ON upd.id = old.id
          RETURNING id
        )
        SELECT (SELECT COUNT(*) FROM old) AS old_exists;
        `,
        [residentId, createdRow?.id ?? null]
      );
    }

    res.status(201).json({ success: true, data: createdRow });
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
    const existingResult = await sql.query(
      `SELECT id, resident_id, paper_type, temporary_household_id, start_date, end_date FROM temporarystayleave WHERE id = $1`,
      [id]
    );
    const existingRows = normalizeRows(existingResult);
    const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });

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

    const residentId = normalizeOptionalInt(resident_id);
    if (!residentId) {
      return res.status(400).json({ success: false, error: "resident_id is required" });
    }

    const startDate = normalizeRequiredDate(start_date);
    if (!startDate) {
      return res.status(400).json({ success: false, error: "start_date is required" });
    }

    const endDate = normalizeOptionalDate(end_date);
    if (endDate === undefined) {
      return res.status(400).json({ success: false, error: "end_date is invalid" });
    }

    const paperType = paper_type || "TemporaryLeave";
    if (paperType !== "TemporaryLeave" && paperType !== "TemporaryStay") {
      return res.status(400).json({ success: false, error: "paper_type is invalid" });
    }

    const temporaryHouseholdId = normalizeOptionalInt(temporary_household_id);
    const temporaryAddress =
      paperType === "TemporaryStay" ? (temporary_address ?? null) : null;

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
      [
        residentId,
        declarant_name ?? null,
        paperType,
        temporaryAddress,
        temporaryHouseholdId,
        startDate,
        endDate,
        reason ?? null,
        id,
      ]
    );

    if (!Array.isArray(updated) || updated.length === 0) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const updatedRow = updated[0];

    // If a TemporaryStay is ended (end_date transitions from NULL -> non-NULL) and it was tied to an existing household,
    // move the resident back to their original household and reset status.
    const wasActiveStay =
      String(existing?.paper_type || "") === "TemporaryStay" && existing?.end_date == null;
    const isNowEndedStay =
      String(updatedRow?.paper_type || "") === "TemporaryStay" && updatedRow?.end_date != null;
    const hasTempHousehold = updatedRow?.temporary_household_id != null;

    if (wasActiveStay && isNowEndedStay && hasTempHousehold) {
      // Find the original household from the TEMPORARY_STAY log we wrote at creation time.
      const originalResult = await sql.query(
        `
        SELECT household_id_before
        FROM residentlog
        WHERE change_type = 'TEMPORARY_STAY'
          AND (
            NULLIF(change_details->'meta'->>'temporary_stay_leave_id','')::int = $1
            OR NULLIF(change_details->'meta'->'record'->>'id','')::int = $1
          )
        ORDER BY id ASC
        LIMIT 1
        `,
        [id]
      );
      const originalRows = normalizeRows(originalResult);
      const originalHouseholdId = Array.isArray(originalRows)
        ? originalRows?.[0]?.household_id_before ?? null
        : originalRows?.household_id_before ?? null;

      if (originalHouseholdId != null) {
        await sql.query(
          `
          WITH old AS (
            SELECT
              id,
              household_id AS household_id_before,
              to_jsonb(resident.*) AS old_data
            FROM resident
            WHERE id = $1
          ), upd AS (
            UPDATE resident
            SET household_id = $2,
                status = 'Permanent'
            WHERE id = $1
            RETURNING id, household_id AS household_id_after, to_jsonb(resident.*) AS new_data
          ), log AS (
            INSERT INTO residentlog (
              subject_resident_id,
              resident_id,
              household_id_before,
              household_id_after,
              change_type,
              change_details,
              note
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
                'meta', jsonb_build_object(
                  'source', 'endTemporaryStay',
                  'temporary_stay_leave_id', $3::int,
                  'paper_type', 'TemporaryStay'
                )
              ),
              'Kết thúc tạm trú: tự động trả về hộ cũ'
            FROM old
            JOIN upd ON upd.id = old.id
            RETURNING id
          )
          SELECT (SELECT COUNT(*) FROM old) AS old_exists;
          `,
          [residentId, originalHouseholdId, id]
        );
      }
    }

    // If a TemporaryLeave is ended (end_date transitions from NULL -> non-NULL), reset status to Permanent.
    const wasActiveLeave =
      String(existing?.paper_type || "") === "TemporaryLeave" && existing?.end_date == null;
    const isNowEndedLeave =
      String(updatedRow?.paper_type || "") === "TemporaryLeave" && updatedRow?.end_date != null;

    if (wasActiveLeave && isNowEndedLeave) {
      await sql.query(
        `
        WITH old AS (
          SELECT
            id,
            household_id AS household_id_before,
            to_jsonb(resident.*) AS old_data
          FROM resident
          WHERE id = $1
        ), upd AS (
          UPDATE resident
          SET status = 'Permanent'
          WHERE id = $1
          RETURNING id, household_id AS household_id_after, to_jsonb(resident.*) AS new_data
        ), log AS (
          INSERT INTO residentlog (
            subject_resident_id,
            resident_id,
            household_id_before,
            household_id_after,
            change_type,
            change_details,
            note
          )
          SELECT
            upd.id,
            upd.id,
            old.household_id_before,
            upd.household_id_after,
            'UPDATE',
            jsonb_build_object(
              'old', old.old_data,
              'new', upd.new_data,
              'meta', jsonb_build_object(
                'source', 'endTemporaryLeave',
                'temporary_stay_leave_id', $2::int,
                'paper_type', 'TemporaryLeave'
              )
            ),
            'Kết thúc tạm vắng: tự động trả trạng thái thường trú'
          FROM old
          JOIN upd ON upd.id = old.id
          RETURNING id
        )
        SELECT (SELECT COUNT(*) FROM old) AS old_exists;
        `,
        [residentId, id]
      );
    }

    res.status(200).json({ success: true, data: updatedRow });
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

// Thống kê biến động tạm trú và tạm vắng theo thời gian
export const getTemporaryStayLeaveStatistics = async (req, res) => {
  console.log('getTemporaryStayLeaveStatistics called');
  try {
    const { year } = req.query;
    const yearNum = year ? parseInt(year) : null;

    // Lấy tất cả các tháng có dữ liệu (từ start_date đầu tiên đến hiện tại)
    let dateRangeResult;
    if (yearNum) {
      // Nếu có chọn năm, chỉ lấy dữ liệu trong năm đó (từ tháng 1 đến tháng 12)
      dateRangeResult = await sql.query(`
        SELECT 
          DATE_TRUNC('month', $1::date)::date as min_month,
          DATE_TRUNC('month', ($1::date + INTERVAL '1 year' - INTERVAL '1 day'))::date as max_month
      `, [`${yearNum}-01-01`]);
    } else {
      // Nếu không chọn năm, lấy tất cả dữ liệu
      dateRangeResult = await sql.query(`
        SELECT 
          DATE_TRUNC('month', MIN(start_date))::date as min_month,
          DATE_TRUNC('month', MAX(COALESCE(end_date, CURRENT_DATE)))::date as max_month
        FROM temporarystayleave
        WHERE start_date IS NOT NULL
      `);
    }

    const dateRange = Array.isArray(dateRangeResult) ? dateRangeResult : (dateRangeResult?.rows || []);
    console.log('Date range result:', dateRange);
    
    if (!dateRange || dateRange.length === 0 || !dateRange[0]?.min_month) {
      console.log('No date range found, returning empty data');
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const minMonth = dateRange[0].min_month;
    const maxMonth = dateRange[0].max_month;

    // Sử dụng generate_series để tạo tất cả các tháng và tính số lượng đang hoạt động
    const monthlyStatsResult = await sql.query(`
      WITH month_series AS (
        SELECT generate_series(
          $1::date,
          $2::date,
          '1 month'::interval
        )::date as month_date
      )
      SELECT 
        EXTRACT(YEAR FROM ms.month_date)::int as year,
        EXTRACT(MONTH FROM ms.month_date)::int as month,
        COUNT(CASE WHEN tsl.paper_type = 'TemporaryStay' 
          AND tsl.start_date <= (ms.month_date + INTERVAL '1 month' - INTERVAL '1 day')
          AND (tsl.end_date IS NULL OR tsl.end_date >= ms.month_date)
          THEN 1 END) as temporary_stay,
        COUNT(CASE WHEN tsl.paper_type = 'TemporaryLeave'
          AND tsl.start_date <= (ms.month_date + INTERVAL '1 month' - INTERVAL '1 day')
          AND (tsl.end_date IS NULL OR tsl.end_date >= ms.month_date)
          THEN 1 END) as temporary_leave
      FROM month_series ms
      LEFT JOIN temporarystayleave tsl ON 1=1
      GROUP BY ms.month_date
      ORDER BY ms.month_date ASC
    `, [minMonth, maxMonth]);

    const monthlyStats = Array.isArray(monthlyStatsResult) ? monthlyStatsResult : (monthlyStatsResult?.rows || []);
    
    let chartData = monthlyStats.map(stat => ({
      year: parseInt(stat.year) || 0,
      month: parseInt(stat.month) || 0,
      monthLabel: `Tháng ${stat.month}/${stat.year}`,
      temporaryStay: parseInt(stat.temporary_stay) || 0,
      temporaryLeave: parseInt(stat.temporary_leave) || 0
    }));

    // Nếu có chọn năm, đảm bảo có đủ 12 tháng (từ tháng 1 đến 12)
    if (yearNum) {
      const monthMap = new Map();
      chartData.forEach(month => {
        monthMap.set(month.month, month);
      });

      // Tạo đầy đủ 12 tháng
      const fullYearData = [];
      for (let m = 1; m <= 12; m++) {
        if (monthMap.has(m)) {
          fullYearData.push(monthMap.get(m));
        } else {
          // Tháng chưa có dữ liệu, tạo với giá trị 0
          fullYearData.push({
            year: yearNum,
            month: m,
            monthLabel: `Tháng ${m}/${yearNum}`,
            temporaryStay: 0,
            temporaryLeave: 0
          });
        }
      }
      chartData = fullYearData;
    } else {
      // Nếu không chọn năm, chỉ hiển thị tháng có dữ liệu
      chartData = chartData.filter(month => month.temporaryStay > 0 || month.temporaryLeave > 0);
    }

    res.status(200).json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('TemporaryStayLeave statistics error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
};