import { sql } from "../config/db.js";
import crypto from "crypto";

const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const getCheckinSecret = () => process.env.CHECKIN_SECRET || "dev-checkin-secret";

const signMeetingToken = (meetingId) => {
  return crypto
    .createHmac("sha256", getCheckinSecret())
    .update(String(meetingId))
    .digest("hex")
    .slice(0, 24);
};

const validateMeetingToken = (meetingId, token) => {
  if (typeof token !== "string" || token.length < 12) return false;
  const expected = signMeetingToken(meetingId);
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
};

export const getAllAttendance = async (req, res) => {
  try {
    const result = await sql.query("SELECT * FROM attendance");
    res.status(200).json({success: true, data: result});
  } catch (error) {
    //console.error("Error fetching attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// List attendance for a specific meeting, including all households.
// NOTE: If there is no attendance row yet, attended defaults to FALSE.
export const getAttendanceByMeetingId = async (req, res) => {
  const meetingId = toInt(req.params.meetingId);
  if (!meetingId) {
    return res.status(400).json({ error: "meetingId is required" });
  }

  try {
    const rows = await sql.query(
      `
      SELECT
        h.id AS household_id,
        h.household_code,
        h.house_number,
        h.street,
        r.full_name AS head_name,
        COALESCE(a.attended, FALSE) AS attended,
        a.absence_reason,
        a.checked_at
      FROM household h
      LEFT JOIN resident r ON r.id = h.head_id
      LEFT JOIN attendance a
        ON a.household_id = h.id
       AND a.meeting_id = $1
      ORDER BY h.household_code
      `,
      [meetingId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Bulk upsert attendance for a meeting
// Body: { items: [{ household_id, attended, absence_reason? }, ...] } OR an array directly
export const upsertAttendanceByMeetingId = async (req, res) => {
  const meetingId = toInt(req.params.meetingId);
  if (!meetingId) {
    return res.status(400).json({ error: "meetingId is required" });
  }

  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  // minimal validation & normalization
  const normalized = [];
  for (const raw of items) {
    const householdId = toInt(raw?.household_id);
    const attended = raw?.attended;
    if (!householdId || typeof attended !== "boolean") continue;
    const absence_reason = typeof raw?.absence_reason === "string" ? raw.absence_reason.trim() : null;
    normalized.push({
      household_id: householdId,
      attended,
      absence_reason: attended ? null : (absence_reason || null),
    });
  }

  try {
    // Use JSONB recordset to upsert in one statement
    await sql.query(
      `
      INSERT INTO attendance (meeting_id, household_id, attended, absence_reason, checked_at)
      SELECT
        $1,
        x.household_id,
        x.attended,
        CASE WHEN x.attended THEN NULL ELSE NULLIF(x.absence_reason, '') END,
        CURRENT_DATE
      FROM jsonb_to_recordset($2::jsonb)
        AS x(household_id int, attended boolean, absence_reason text)
      ON CONFLICT (meeting_id, household_id)
      DO UPDATE SET
        attended = EXCLUDED.attended,
        absence_reason = EXCLUDED.absence_reason,
        checked_at = EXCLUDED.checked_at
      `,
      [meetingId, JSON.stringify(normalized)]
    );

    res.status(200).json({ success: true, message: "Attendance saved" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Return a deterministic token so frontend can build a QR check-in URL.
export const getMeetingCheckinToken = async (req, res) => {
  const meetingId = toInt(req.params.meetingId);
  if (!meetingId) {
    return res.status(400).json({ error: "meetingId is required" });
  }

  try {
    const meeting = await sql.query("SELECT id FROM meeting WHERE id = $1", [meetingId]);
    if (!Array.isArray(meeting) || meeting.length === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    return res.status(200).json({ success: true, data: { token: signMeetingToken(meetingId) } });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Public: get check-in info (meeting + households) after validating token
export const getCheckinInfo = async (req, res) => {
  const meetingId = toInt(req.params.meetingId);
  const token = req.query?.token;

  if (!meetingId) return res.status(400).json({ error: "meetingId is required" });
  if (!validateMeetingToken(meetingId, token)) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const meetingRows = await sql.query(
      `SELECT id, topic, location, time FROM meeting WHERE id = $1`,
      [meetingId]
    );
    if (!Array.isArray(meetingRows) || meetingRows.length === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const households = await sql.query(
      `
      SELECT
        h.id AS household_id,
        h.household_code,
        h.house_number,
        h.street,
        r.full_name AS head_name
      FROM household h
      LEFT JOIN resident r ON r.id = h.head_id
      ORDER BY h.household_code
      `
    );

    return res.status(200).json({
      success: true,
      data: {
        meeting: meetingRows[0],
        households,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Public: confirm participation (upsert attended=true)
export const confirmCheckin = async (req, res) => {
  const meetingId = toInt(req.params.meetingId);
  const { token, household_id } = req.body || {};
  const householdId = toInt(household_id);

  if (!meetingId) return res.status(400).json({ error: "meetingId is required" });
  if (!validateMeetingToken(meetingId, token)) {
    return res.status(401).json({ error: "Invalid token" });
  }
  if (!householdId) return res.status(400).json({ error: "household_id is required" });

  try {
    // validate household exists
    const household = await sql.query("SELECT id FROM household WHERE id = $1", [householdId]);
    if (!Array.isArray(household) || household.length === 0) {
      return res.status(404).json({ error: "Household not found" });
    }

    await sql.query(
      `
      INSERT INTO attendance (meeting_id, household_id, attended, absence_reason, checked_at)
      VALUES ($1, $2, TRUE, NULL, CURRENT_DATE)
      ON CONFLICT (meeting_id, household_id)
      DO UPDATE SET
        attended = TRUE,
        absence_reason = NULL,
        checked_at = EXCLUDED.checked_at
      `,
      [meetingId, householdId]
    );

    return res.status(200).json({ success: true, message: "Check-in confirmed" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const createAttendance = async (req, res) => {
  const { meeting_id, household_id, attended, absence_reason } = req.body;
  if (!meeting_id || !household_id || typeof attended !== "boolean") {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    await sql.query(
      `
      INSERT INTO attendance (meeting_id, household_id, attended, absence_reason, checked_at)
      VALUES ($1, $2, $3, $4, CURRENT_DATE)
      ON CONFLICT (meeting_id, household_id)
      DO UPDATE SET
        attended = EXCLUDED.attended,
        absence_reason = EXCLUDED.absence_reason,
        checked_at = EXCLUDED.checked_at
      `,
      [meeting_id, household_id, attended, attended ? null : (absence_reason || null)]
    );
    res.status(201).json({ success: true, message: "Attendance record created successfully" });
  } catch (error) {
    //console.error("Error creating attendance record:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 

export const updateAttendance = async (req, res) => {
  const { meeting_id, household_id, attended, absence_reason } = req.body;
  if (!meeting_id || !household_id || typeof attended !== "boolean") {
    return res.status(400).json({ error: "meeting_id, household_id, attended are required" });
  }
  try {
    await sql.query(
      `
      UPDATE attendance
      SET attended = $3,
          absence_reason = $4,
          checked_at = CURRENT_DATE
      WHERE meeting_id = $1 AND household_id = $2
      `,
      [meeting_id, household_id, attended, attended ? null : (absence_reason || null)]
    );
    res.status(200).json({ success: true, message: "Attendance record updated successfully" });
  } catch (error) {
    //console.error("Error updating attendance record:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteAttendance = async (req, res) => {
  const { meeting_id, household_id } = req.query;
  if (!meeting_id || !household_id) {
    console.log("Request body:", req.body);
    return res.status(400).json({ error: "Meeting ID and household ID are required" });
  }
  try {
    await sql.query("DELETE FROM attendance WHERE meeting_id = $1 AND household_id = $2", [meeting_id, household_id]);
    res.status(200).json({ success: true, message: "Attendance record deleted successfully" });
  } catch (error) {
    //console.error("Error deleting attendance record:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Thống kê mức độ tham gia họp theo thời gian
export const getAttendanceStatistics = async (req, res) => {
  try {
    // Lấy tổng số hộ gia đình
    const totalHouseholds = await sql.query(`
      SELECT COUNT(*) as total FROM household
    `);

    // Thống kê tham gia theo từng cuộc họp, sắp xếp theo thời gian
    const attendanceStats = await sql.query(`
      SELECT 
        m.id as meeting_id,
        m.topic,
        m.time,
        (SELECT COUNT(*) FROM household) as total_households,
        COUNT(CASE WHEN a.attended = TRUE THEN 1 END) as attended_count,
        COUNT(CASE WHEN a.attended = FALSE THEN 1 END) as absent_count,
        ROUND(
          COUNT(CASE WHEN a.attended = TRUE THEN 1 END)::numeric / 
          NULLIF((SELECT COUNT(*) FROM household), 0) * 100, 
          2
        ) as attendance_rate
      FROM meeting m
      LEFT JOIN attendance a ON a.meeting_id = m.id
      GROUP BY m.id, m.topic, m.time
      ORDER BY m.time ASC
    `);

    // Format dữ liệu cho biểu đồ đường
    const attendanceArray = Array.isArray(attendanceStats) ? attendanceStats : [];
    const totalHouseholdsCount = Array.isArray(totalHouseholds) && totalHouseholds.length > 0 
      ? parseInt(totalHouseholds[0].total) || 0 
      : 0;

    const chartData = attendanceArray.map(stat => {
      const meetingDate = stat.time ? new Date(stat.time) : null;
      const dateLabel = meetingDate 
        ? `${meetingDate.getDate()}/${meetingDate.getMonth() + 1}/${meetingDate.getFullYear()}`
        : 'N/A';
      
      const attended = parseInt(stat.attended_count) || 0;
      const absent = parseInt(stat.absent_count) || 0;
      const totalForMeeting = attended + absent;
      const totalHouseholdsForMeeting = totalForMeeting > 0 ? totalForMeeting : totalHouseholdsCount;
      
      return {
        date: dateLabel,
        time: stat.time, // Giữ nguyên time để filter
        meetingId: stat.meeting_id,
        topic: stat.topic || 'Không có chủ đề',
        totalHouseholds: totalHouseholdsForMeeting,
        attended: attended,
        absent: absent,
        attendanceRate: parseFloat(stat.attendance_rate) || 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalHouseholds: totalHouseholdsCount,
        meetings: chartData
      }
    });
  } catch (error) {
    console.error('Attendance statistics error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Thống kê top 3 hộ gia đình đi họp nhiều nhất
export const getTopAttendingHouseholds = async (req, res) => {
  try {
    // Lấy tổng số cuộc họp
    const totalMeetingsResult = await sql.query(`SELECT COUNT(*) as total FROM meeting`);
    const totalMeetings = Array.isArray(totalMeetingsResult) && totalMeetingsResult.length > 0
      ? parseInt(totalMeetingsResult[0].total) || 0
      : 0;

    const topHouseholds = await sql.query(`
      SELECT 
        h.id as household_id,
        h.household_code,
        r.full_name as head_name,
        COUNT(CASE WHEN a.attended = TRUE THEN 1 END) as attendance_count
      FROM household h
      LEFT JOIN resident r ON r.id = h.head_id
      LEFT JOIN attendance a ON a.household_id = h.id AND a.attended = TRUE
      GROUP BY h.id, h.household_code, r.full_name
      HAVING COUNT(CASE WHEN a.attended = TRUE THEN 1 END) > 0
      ORDER BY attendance_count DESC
      LIMIT 3
    `);

    const topHouseholdsArray = Array.isArray(topHouseholds) ? topHouseholds : [];
    
    const result = topHouseholdsArray.map((household, index) => {
      const attendanceCount = parseInt(household.attendance_count) || 0;
      const attendanceRate = totalMeetings > 0 
        ? (attendanceCount / totalMeetings * 100).toFixed(2)
        : 0;
      
      return {
        rank: index + 1,
        householdId: parseInt(household.household_id) || 0,
        householdCode: household.household_code || '',
        headName: household.head_name || 'Chưa có chủ hộ',
        attendanceCount: attendanceCount,
        totalMeetings: totalMeetings,
        attendanceRate: parseFloat(attendanceRate)
      };
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Top attending households error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};