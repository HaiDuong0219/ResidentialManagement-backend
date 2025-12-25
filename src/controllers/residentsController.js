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

export const getResidentStatistics = async (req, res) => {
  try {
    // Thống kê theo giới tính
    const genderStats = await sql.query(`
      SELECT 
        gender,
        COUNT(*) as count
      FROM resident
      WHERE gender IN ('Male', 'Female')
      GROUP BY gender
    `);

    // Thống kê theo độ tuổi - dùng CTE để tránh lỗi GROUP BY
    const ageStats = await sql.query(`
      WITH age_categories AS (
        SELECT 
          id,
          gender,
          date_of_birth,
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 6 THEN 'Mầm non'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 6 AND 10 THEN 'Cấp 1'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 11 AND 14 THEN 'Cấp 2'
            WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 15 AND 17 THEN 'Cấp 3'
            WHEN (gender = 'Male' AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 60) 
              OR (gender = 'Female' AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 55) 
              THEN 'Lao động'
            WHEN (gender = 'Male' AND EXTRACT(YEAR FROM AGE(date_of_birth)) > 60) 
              OR (gender = 'Female' AND EXTRACT(YEAR FROM AGE(date_of_birth)) > 55) 
              THEN 'Nghỉ hưu'
            ELSE 'Khác'
          END as age_group
        FROM resident
        WHERE date_of_birth IS NOT NULL
      )
      SELECT 
        age_group,
        COUNT(*) as count
      FROM age_categories
      GROUP BY age_group
      ORDER BY 
        CASE age_group
          WHEN 'Mầm non' THEN 1
          WHEN 'Cấp 1' THEN 2
          WHEN 'Cấp 2' THEN 3
          WHEN 'Cấp 3' THEN 4
          WHEN 'Lao động' THEN 5
          WHEN 'Nghỉ hưu' THEN 6
          ELSE 7
        END
    `);

    // Tổng số nhân khẩu
    const totalResidents = await sql.query(`
      SELECT COUNT(*) as total FROM resident
    `);

    // Format dữ liệu giới tính
    const genderData = {
      male: 0,
      female: 0
    };
    const genderArray = Array.isArray(genderStats) ? genderStats : [];
    genderArray.forEach(stat => {
      if (stat && stat.gender === 'Male') {
        genderData.male = parseInt(stat.count) || 0;
      } else if (stat && stat.gender === 'Female') {
        genderData.female = parseInt(stat.count) || 0;
      }
    });

    // Format dữ liệu độ tuổi
    const ageData = {};
    const ageArray = Array.isArray(ageStats) ? ageStats : [];
    ageArray.forEach(stat => {
      if (stat && stat.age_group) {
        ageData[stat.age_group] = parseInt(stat.count) || 0;
      }
    });

    // Xử lý tổng số nhân khẩu
    const totalArray = Array.isArray(totalResidents) ? totalResidents : [];
    const total = totalArray.length > 0 && totalArray[0] ? parseInt(totalArray[0].total) || 0 : 0;

    res.status(200).json({
      success: true,
      data: {
        total: total,
        byGender: genderData,
        byAge: ageData
      }
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}