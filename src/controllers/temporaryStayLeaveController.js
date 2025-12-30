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