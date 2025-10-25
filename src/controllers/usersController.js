import { sql } from "../config/db.js";

export const getAllUsers = async (req, res) => {
  try {
    const account = await sql.query('SELECT * FROM account');
    res.status(200).json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await sql.query('SELECT * FROM account WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ success: true, data: user.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createUser = async (req, res) => {
  try{
    const {email, password_hash, full_name, role, status} = req.body;
    await sql.query(
      'INSERT INTO account (email, password_hash, full_name, role, status) VALUES ($1, $2, $3, $4, $5)', 
      [email, password_hash, full_name, role, status]);
    res.status(201).json({ success: true, message: 'User created successfully' });
  }
  catch(error){
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateUserByEmail =  async (req, res) => {
  try{
    const { email, full_name, role, status } = req.body;
    const result = await sql.query(
      'UPDATE account SET (full_name, role, status) = ($2, $3, $4) WHERE email = $1',
      [email, full_name, role, status]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User updated successfully' });
  } catch(error){
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteUserByEmail = async (req, res) => {
  try{
    const { email } = req.body;
    console.log(email);
    const status = await sql.query('SELECT status FROM account WHERE email = $1', [email]);
    console.log(status);
    const result = await sql.query(
      'UPDATE account SET status = false WHERE email = $1', 
      [email]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User deactivated successfully' });
  } catch(error){
    res.status(500).json({ error: 'Internal Server Error' });
  }
};