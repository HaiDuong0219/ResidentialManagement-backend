import { sql } from "../config/db.js";

function normalizeRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

const SAFE_COLUMNS = "id, email, full_name, role, status";

function parseStatusFilter(status) {
  if (status === undefined || status === null || status === "") return null;
  const s = String(status).toLowerCase();
  if (s === "active" || s === "true" || s === "1") return true;
  if (s === "inactive" || s === "false" || s === "0") return false;
  return null;
}

function normalizeRole(role) {
  if (role === undefined || role === null || role === "") return null;
  return String(role).trim();
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  const s = String(v ?? "").toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

export const getUserRoles = async (req, res) => {
  return res.status(200).json({ success: true, data: ["leader", "deputy", "officer"] });
};

export const getUserStats = async (req, res) => {
  try {
    const rows = normalizeRows(
      await sql.query(
        `
        SELECT
          role,
          status,
          COUNT(*)::int AS count
        FROM account
        GROUP BY role, status
        ORDER BY role, status DESC
        `
      )
    );

    const totals = normalizeRows(
      await sql.query(
        `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = TRUE)::int AS active,
          COUNT(*) FILTER (WHERE status = FALSE)::int AS inactive
        FROM account
        `
      )
    );

    return res.status(200).json({ success: true, data: { breakdown: rows, totals: totals[0] || { total: 0, active: 0, inactive: 0 } } });
  } catch (error) {
    console.error("getUserStats error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// List / search users (safe fields only)
export const listUsers = async (req, res) => {
  const q = String(req.query?.q ?? "").trim();
  const role = normalizeRole(req.query?.role);
  const status = parseStatusFilter(req.query?.status);

  const limitRaw = Number(req.query?.limit ?? 200);
  const offsetRaw = Number(req.query?.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const conditions = [];
  const params = [];

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    conditions.push(`(LOWER(email) LIKE $${params.length} OR LOWER(full_name) LIKE $${params.length})`);
  }

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }

  if (typeof status === "boolean") {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    params.push(limit);
    params.push(offset);

    const rows = normalizeRows(
      await sql.query(
        `SELECT ${SAFE_COLUMNS} FROM account ${whereClause} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      )
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("listUsers error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const getUserById = async (req, res) => {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: "Invalid id" });
  }

  try {
    const rows = normalizeRows(
      await sql.query(`SELECT ${SAFE_COLUMNS} FROM account WHERE id = $1`, [id])
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("getUserById error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const getAllUsers = async (req, res) => {
  // Backward-compatible alias
  return listUsers(req, res);
};

export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, error: "email is required" });

    const rows = normalizeRows(
      await sql.query(
        `SELECT ${SAFE_COLUMNS} FROM account WHERE email = $1`,
        [email]
      )
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password_hash, full_name, role } = req.body || {};
    const statusRaw = req.body?.status;

    if (!email || !password_hash || !full_name || !role) {
      return res.status(400).json({ success: false, error: "email, password_hash, full_name, role are required" });
    }

    const status = toBool(statusRaw);

    const rows = normalizeRows(
      await sql.query(
        `
        INSERT INTO account (email, password_hash, full_name, role, status)
        VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
        RETURNING ${SAFE_COLUMNS}
        `,
        [email, password_hash, full_name, role, status]
      )
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(400).json({ success: false, error: "Email đã tồn tại" });
    }
    console.error("createUser error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const updateUserByEmail =  async (req, res) => {
  // Backward-compatible endpoint (email in body)
  try {
    const { email, full_name, role, status } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: "email is required" });

    const statusBool = toBool(status);

    const rows = normalizeRows(
      await sql.query(
        `
        UPDATE account
        SET
          full_name = COALESCE($2, full_name),
          role = COALESCE($3, role),
          status = COALESCE($4, status)
        WHERE email = $1
        RETURNING ${SAFE_COLUMNS}
        `,
        [email, full_name ?? null, role ?? null, statusBool]
      )
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("updateUserByEmail error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const updateUserById = async (req, res) => {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: "Invalid id" });
  }

  try {
    const { email, full_name, role, status } = req.body || {};
    const statusBool = toBool(status);

    const rows = normalizeRows(
      await sql.query(
        `
        UPDATE account
        SET
          email = COALESCE($2, email),
          full_name = COALESCE($3, full_name),
          role = COALESCE($4, role),
          status = COALESCE($5, status)
        WHERE id = $1
        RETURNING ${SAFE_COLUMNS}
        `,
        [id, email ?? null, full_name ?? null, role ?? null, statusBool]
      )
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(400).json({ success: false, error: "Email đã tồn tại" });
    }
    console.error("updateUserById error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const setUserStatusById = async (req, res) => {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: "Invalid id" });
  }

  const statusBool = toBool(req.body?.status);
  if (typeof statusBool !== "boolean") {
    return res.status(400).json({ success: false, error: "status must be boolean" });
  }

  try {
    const rows = normalizeRows(
      await sql.query(
        `UPDATE account SET status = $2 WHERE id = $1 RETURNING ${SAFE_COLUMNS}`,
        [id, statusBool]
      )
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("setUserStatusById error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const setUserPasswordById = async (req, res) => {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: "Invalid id" });
  }

  const password_hash = req.body?.password_hash;
  if (!password_hash) {
    return res.status(400).json({ success: false, error: "password_hash is required" });
  }

  try {
    const rows = normalizeRows(
      await sql.query(
        `UPDATE account SET password_hash = $2 WHERE id = $1 RETURNING ${SAFE_COLUMNS}`,
        [id, password_hash]
      )
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("setUserPasswordById error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const bulkSetUserStatus = async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const statusBool = toBool(req.body?.status);

  const normalizedIds = ids
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!normalizedIds.length) {
    return res.status(400).json({ success: false, error: "ids must be a non-empty array" });
  }
  if (typeof statusBool !== "boolean") {
    return res.status(400).json({ success: false, error: "status must be boolean" });
  }

  try {
    const rows = normalizeRows(
      await sql.query(
        `UPDATE account SET status = $2 WHERE id = ANY($1::int[]) RETURNING ${SAFE_COLUMNS}`,
        [normalizedIds, statusBool]
      )
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("bulkSetUserStatus error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const deleteUserByEmail = async (req, res) => {
  // Backward-compatible "delete" = deactivate
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: "email is required" });

    const rows = normalizeRows(
      await sql.query(
        `UPDATE account SET status = FALSE WHERE email = $1 RETURNING ${SAFE_COLUMNS}`,
        [email]
      )
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("deleteUserByEmail error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const deleteUserById = async (req, res) => {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: "Invalid id" });
  }

  try {
    const rows = normalizeRows(
      await sql.query(`DELETE FROM account WHERE id = $1 RETURNING ${SAFE_COLUMNS}`, [id])
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("deleteUserById error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};