import { sql } from "../config/db.js";

export const getAllMeetings = async (req, res) => {
  try {
    const meetings = await sql.query('SELECT * FROM meeting');
    //console.log(meetings);
    res.status(200).json({ success: true, data: meetings });
  } catch (error) {
    //console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const getMeetingById = async (req, res) => {
  const { id } = req.params;
  try {
    const meeting = await sql.query('SELECT * FROM meeting WHERE id = $1', [id]);
    if (meeting.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.status(200).json({ success: true, data: meeting });
  } catch (error) {
    //console.error('Error fetching meeting:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const createMeeting = async (req, res) => {
  const { topic, content, tasks, location, time, creator_id } = req.body;
  if(!topic || !content || !tasks || !location || !time || !creator_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    await sql.query("INSERT INTO meeting (topic, content, tasks, location, time, creator_id) VALUES ($1, $2, $3, $4, $5, $6)", [topic, content, tasks, location, time, creator_id]);
    res.status(201).json({ success: true, message: 'Meeting created successfully' });
  } catch (error) {
    //console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const updateMeeting = async (req, res) => {
  const { id } = req.params;
  try {
    const { topic, content, tasks, location, time, creator_id } = req.body;
    if (!topic || !content || !tasks || !location || !time || !creator_id) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    await sql.query("UPDATE meeting SET topic = $1, content = $2, tasks = $3, location = $4, time = $5, creator_id = $6 WHERE id = $7", [topic, content, tasks, location, time, creator_id, id]);
    res.status(200).json({ success: true, message: 'Meeting updated successfully' });
  } catch (error) {
    //console.error('Error updating meeting:', error);
    res.status(500).json({ error: 'Internal Server Error' }); 
  }
}

export const deleteMeeting = async (req, res) => {
  const { id } = req.params;
  try {
    await sql.query("DELETE FROM meeting WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    //console.error('Error deleting meeting:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
