-- =========================================================
-- ACCOUNT & ROLE MANAGEMENT
-- =========================================================

-- Enum định nghĩa vai trò tài khoản trong hệ thống
-- leader  : tổ trưởng / trưởng khu
-- deputy  : tổ phó
-- officer : cán bộ phụ trách
CREATE TYPE USER_ROLE AS ENUM ('leader', 'deputy', 'officer');

-- Bảng Account: lưu thông tin đăng nhập cán bộ
CREATE TABLE Account (
    id SERIAL PRIMARY KEY,                 -- Khóa chính
    email VARCHAR(100) UNIQUE NOT NULL,    -- Email / tên đăng nhập
    password_hash VARCHAR(255) NOT NULL,   -- Mật khẩu đã băm
    full_name VARCHAR(150) NOT NULL,       -- Họ tên cán bộ
    role USER_ROLE NOT NULL,               -- Vai trò (leader, deputy, officer)
    status BOOLEAN DEFAULT TRUE            -- Trạng thái: TRUE = hoạt động, FALSE = khóa
);



-- =========================================================
-- HOUSEHOLD & RESIDENT MANAGEMENT
-- =========================================================

-- Bảng Household: lưu thông tin hộ gia đình
CREATE TABLE Household (
    id SERIAL PRIMARY KEY,                 -- Khóa chính (ID nội bộ)
    household_code VARCHAR(10) UNIQUE NOT NULL,
                                           -- Mã hộ khẩu (HK001, HK002...)
                                           -- Chỉ dùng cho nghiệp vụ / hiển thị
    house_number VARCHAR(50),              -- Số nhà
    street VARCHAR(150),                   -- Tên đường
    head_id INT                            -- ID nhân khẩu là chủ hộ (FK thêm sau)
);

-- Bảng Resident: lưu thông tin nhân khẩu
CREATE TABLE Resident (
    id SERIAL PRIMARY KEY,                 -- Khóa chính nhân khẩu
    household_id INT NOT NULL,             -- FK → Household.id (nhân khẩu thường trú tại hộ nào)

    full_name VARCHAR(150) NOT NULL,       -- Họ tên
    date_of_birth DATE NOT NULL,            -- Ngày sinh
    place_of_birth TEXT,                    -- Nơi sinh
    native_place TEXT,                      -- Quê quán
    ethnicity VARCHAR(50),                  -- Dân tộc
    occupation VARCHAR(150),                -- Nghề nghiệp

    id_number VARCHAR(20) UNIQUE,           -- CMND / CCCD
    id_issue_date DATE,                     -- Ngày cấp CCCD
    id_issue_place TEXT,                    -- Nơi cấp CCCD

    registration_date DATE,                 -- Ngày đăng ký thường trú
    relation_to_head VARCHAR(100),          -- Quan hệ với chủ hộ
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female')), -- Giới tính
    status VARCHAR(50) DEFAULT 'Permanent', -- Trạng thái cư trú (TemporaryStay, TemporaryLeave, Thường trú, Tạm trú, Tạm vắng)

    -- Khóa ngoại: nhân khẩu thuộc về 1 hộ gia đình
    CONSTRAINT fk_resident_household
        FOREIGN KEY (household_id)
        REFERENCES Household(id)
        ON DELETE RESTRICT
);

-- Thêm khóa ngoại cho chủ hộ
-- Nếu xóa nhân khẩu là chủ hộ → head_id sẽ về NULL
ALTER TABLE Household
ADD CONSTRAINT fk_household_head
FOREIGN KEY (head_id)
REFERENCES Resident(id)
ON DELETE SET NULL;



-- =========================================================
-- RESIDENT CHANGE HISTORY
-- =========================================================

-- Bảng ResidentLog: lưu lịch sử thay đổi thông tin nhân khẩu
CREATE TABLE ResidentLog (
    id SERIAL PRIMARY KEY,                 -- Khóa chính log
    resident_id INT NOT NULL,              -- FK → Resident.id
    change_type VARCHAR(100) NOT NULL,     -- Loại thay đổi (Thêm mới, Cập nhật, Chuyển đi...)
    change_details JSONB,                  -- Chi tiết thay đổi (dữ liệu cũ/mới)
    note TEXT,                             -- Ghi chú thêm
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Khi xóa nhân khẩu → xóa luôn log
    FOREIGN KEY (resident_id)
    REFERENCES Resident(id)
    ON DELETE CASCADE
);



-- =========================================================
-- TEMPORARY STAY / TEMPORARY LEAVE
-- =========================================================

-- Bảng TemporaryStayLeave: quản lý tạm trú / tạm vắng
CREATE TABLE TemporaryStayLeave (
    id SERIAL PRIMARY KEY,

    resident_id INT NOT NULL,              -- Nhân khẩu nào
    declarant_name VARCHAR(150),           -- Người khai báo

    paper_type VARCHAR(20) NOT NULL
        CHECK (paper_type IN ('TemporaryStay', 'TemporaryLeave')),

    -- Thông tin tạm trú (chỉ dùng khi TemporaryStay)
    temporary_address TEXT,
    temporary_household_id INT,

    start_date DATE NOT NULL,
    end_date DATE,
    reason TEXT,

    approval_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (resident_id)
        REFERENCES Resident(id)
        ON DELETE CASCADE,

    FOREIGN KEY (temporary_household_id)
        REFERENCES Household(id)
        ON DELETE SET NULL
);



-- =========================================================
-- COMMUNITY MEETING MANAGEMENT
-- =========================================================

-- Bảng Meeting: quản lý các cuộc họp tổ dân phố
CREATE TABLE Meeting (
    id SERIAL PRIMARY KEY,                 -- Khóa chính
    topic VARCHAR(255) NOT NULL,           -- Chủ đề họp
    content TEXT,                          -- Nội dung chi tiết
    tasks TEXT[],                          -- Danh sách công việc
    location TEXT NOT NULL,                -- Địa điểm
    time TIMESTAMP NOT NULL,               -- Thời gian họp
    creator_id INT,                        -- Người tạo cuộc họp (Account)

    FOREIGN KEY (creator_id)
    REFERENCES Account(id)
);

-- Bảng Attendance: điểm danh hộ gia đình trong cuộc họp
CREATE TABLE Attendance (
    meeting_id INT NOT NULL,               -- FK → Meeting.id
    household_id INT NOT NULL,              -- FK → Household.id
    attended BOOLEAN DEFAULT FALSE,         -- TRUE: tham dự, FALSE: vắng

    -- Mỗi hộ chỉ có 1 bản ghi điểm danh / cuộc họp
    PRIMARY KEY (meeting_id, household_id),

    FOREIGN KEY (meeting_id)
        REFERENCES Meeting(id)
        ON DELETE CASCADE,

    FOREIGN KEY (household_id)
        REFERENCES Household(id)
        ON DELETE CASCADE
);
