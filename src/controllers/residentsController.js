import { sql } from "../config/db.js";

export const createResident = async (req, res) => {
  const { household_id, full_name, date_of_birth, place_of_birth, native_place, ethnicity, occupation, id_number, id_issue_date, id_issue_place, registration_date, previous_address, relation_to_head, gender, status } = req.body;
  if(!household_id || !full_name || !date_of_birth) {
    return res.status(400).json({ error: 'Please fill all required fields' });
  }
  try {
    await sql.query("INSERT INTO resident (household_id, full_name, date_of_birth, place_of_birth, native_place, ethnicity, occupation, id_number, id_issue_date, id_issue_place, registration_date, previous_address, relation_to_head, gender, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)", [household_id, full_name, date_of_birth, place_of_birth, native_place, ethnicity, occupation, id_number, id_issue_date, id_issue_place, registration_date, previous_address, relation_to_head, gender, status]);
    res.status(201).json({ success: true, message: 'Resident created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const getAllResidents = async (req, res) => {
  try {
    const residents = await sql.query('SELECT * FROM resident');
    res.status(200).json({ success: true, data: residents });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const getResidentById = async (req, res) => {
  const { id } = req.params;
  try {
    const resident = await sql.query('SELECT * FROM resident WHERE id = $1', [id]);
    res.status(200).json({ success: true, data: resident });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const getResidentsByHouseholdId = async (req, res) => {
  const { household_id } = req.params;
  try {
    const residents = await sql.query('SELECT * FROM resident WHERE household_id = $1', [household_id]);
    res.status(200).json({ success: true, data: residents });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const updateResident = async (req, res) => {
  const { id } = req.params;
  try {
    const { household_id, full_name, date_of_birth, place_of_birth, native_place, ethnicity, occupation, id_number, id_issue_date, id_issue_place, registration_date, previous_address, relation_to_head, gender, status } = req.body;
    await sql.query("UPDATE resident SET household_id = $1, full_name = $2, date_of_birth = $3, place_of_birth = $4, native_place = $5, ethnicity = $6, occupation = $7, id_number = $8, id_issue_date = $9, id_issue_place = $10, registration_date = $11, previous_address = $12, relation_to_head = $13, gender = $14, status = $15 WHERE id = $16", [household_id, full_name, date_of_birth, place_of_birth, native_place, ethnicity, occupation, id_number, id_issue_date, id_issue_place, registration_date, previous_address, relation_to_head, gender, status, id]);
    res.status(200).json({ success: true, message: 'Resident updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' }); 
  }
}

export const deleteResident = async (req, res) => {
  const { id } = req.params;
  try {
    await sql.query("DELETE FROM resident WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: 'Resident deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}