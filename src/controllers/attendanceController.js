import { sql } from "../config/db.js";

export const getAllAttendance = async (req, res) => {
  try {
    const result = await sql.query("SELECT * FROM attendance");
    res.status(200).json({success: true, data: result});
  } catch (error) {
    //console.error("Error fetching attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const createAttendance = async (req, res) => {
  const { meeting_id, household_id, attended } = req.body;
  if (!meeting_id || !household_id || attended === undefined) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    await sql.query(
      "INSERT INTO attendance (meeting_id, household_id, attended) VALUES ($1, $2, $3)",
      [meeting_id, household_id, attended]
    );
    res.status(201).json({ success: true, message: "Attendance record created successfully" });
  } catch (error) {
    //console.error("Error creating attendance record:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 

export const updateAttendance = async (req, res) => {
  const { meeting_id, household_id, attended } = req.body;
  if (!meeting_id || !household_id || attended === undefined) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    await sql.query(
      "UPDATE attendance SET meeting_id = $1, household_id = $2, attended = $3 WHERE meeting_id = $1 AND household_id = $2",
      [meeting_id, household_id, attended]
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