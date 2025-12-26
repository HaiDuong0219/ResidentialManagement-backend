import { sql } from "../config/db.js";

//import bcrypt from 'bcrypt';

// export const createAuth = async (req, res) => {

//     try{
//         const salt = await bcrypt.genSalt()
//         const hashedPassword = await bcrypt.hash(req.body.password, salt)
//         console.log(salt)
//         console.log(hashedPassword)
//         const user = {name: req.body.name, password: hashedPassword}
//         users.push(user)
//         res.status(201).send()
//     } catch {
//         res.status(500).send()
//     }
    
// }

export const login = async (req, res) => {
  const { email, password_hash } = req.body;

  // validate input
  if (!email || !password_hash) {
    return res.status(400).json({ error: 'email and password_hash are required' });
  }

  try {
    const result = await sql.query('SELECT password_hash FROM account WHERE email = $1', [email]);

    // debug: in trường hợp driver trả khác cấu trúc, in ra để kiểm tra
    console.log('SQL result:', result);

    // support both { rows: [...] } and [...] return shapes
    const rows = result?.rows ?? result;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];

    const isMatch = (password_hash === user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/*export const updateAuth = (req, res) => {
  res.status(200).json({message:""});
}



export const deleteAuth = (req, res) => {
  res.status(200).send({message:""});
}*/