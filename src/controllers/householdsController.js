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
    const residents = await sql.query(`
      SELECT * FROM resident 
      WHERE household_id = $1 
      ORDER BY relation_to_head, full_name
    `, [household_code]);
    
    res.status(200).json({ success: true, data: residents });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
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
    const residents = await sql.query('SELECT COUNT(*) FROM resident WHERE household_id = (SELECT household_code FROM household WHERE id = $1)', [id]);
    
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


