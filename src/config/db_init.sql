-- ========= ACCOUNT AND ROLE MANAGEMENT =========

-- Định nghĩa ENUM cho vai trò người dùng
CREATE TYPE USER_ROLE AS ENUM ('leader', 'deputy', 'officer');

-- Bảng lưu thông tin tài khoản đăng nhập
CREATE TABLE Account (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,              -- Email hoặc số điện thoại
    password_hash VARCHAR(255) NOT NULL,             -- Chỉ lưu mật khẩu đã băm
    full_name VARCHAR(150) NOT NULL,                 -- Họ tên chủ tài khoản
    role USER_ROLE NOT NULL,                         -- Vai trò trong hệ thống
    status BOOLEAN DEFAULT TRUE                      -- TRUE: hoạt động, FALSE: vô hiệu
);

-- ========= HOUSEHOLD AND RESIDENT MANAGEMENT =========

-- Bảng lưu thông tin hộ gia đình
CREATE TABLE Household (
    id SERIAL PRIMARY KEY,
    household_code VARCHAR(10) UNIQUE NOT NULL,      -- Mã hộ (ví dụ: HK001)
    head_id INT,                                     -- ID của chủ hộ (liên kết sau)
    house_number VARCHAR(50),
    street VARCHAR(150)
);

-- Bảng lưu thông tin nhân khẩu
CREATE TABLE Resident (
    id SERIAL PRIMARY KEY,
    household_id VARCHAR(10) NOT NULL,               -- Mã hộ mà nhân khẩu thuộc về (liên kết bằng household_code)
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE NOT NULL,
    place_of_birth TEXT,
    native_place TEXT,
    ethnicity VARCHAR(50),
    occupation VARCHAR(150),
    id_number VARCHAR(20) UNIQUE,                    -- CCCD / Hộ chiếu
    id_issue_date DATE,
    id_issue_place TEXT,
    registration_date DATE,                          -- Ngày đăng ký thường trú
    previous_address TEXT,                           -- Nơi ở trước đây
    relation_to_head VARCHAR(100),                   -- Quan hệ với chủ hộ
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female')),
    status VARCHAR(50) DEFAULT 'Permanent',          -- Trạng thái: thường trú, chuyển đi, qua đời,...

    FOREIGN KEY (household_id) REFERENCES Household(household_code) ON DELETE RESTRICT
);

-- Thêm ràng buộc khóa ngoại cho chủ hộ (nếu bị xóa thì set null)
ALTER TABLE Household
ADD CONSTRAINT fk_head
FOREIGN KEY (head_id) REFERENCES Resident(id) ON DELETE SET NULL;

-- Bảng ghi nhận lịch sử thay đổi thông tin nhân khẩu
CREATE TABLE ResidentLog (
    id SERIAL PRIMARY KEY,
    resident_id INT NOT NULL,                        -- Nhân khẩu có thông tin thay đổi
    change_type VARCHAR(100) NOT NULL,               -- Ví dụ: Thêm mới, Cập nhật, Chuyển đi,...
    change_details JSONB,                            -- Dữ liệu cũ/mới ở dạng JSON
    note TEXT,
    change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (resident_id) REFERENCES Resident(id) ON DELETE CASCADE
);

-- Bảng quản lý tạm trú / tạm vắng
CREATE TABLE TemporaryStayLeave (
    id SERIAL PRIMARY KEY,
    resident_id INT NOT NULL,                        -- Người khai báo
    declarant_name VARCHAR(150),                     -- Tên người khai báo (nếu khác)
    paper_type VARCHAR(20) NOT NULL CHECK (paper_type IN ('Temporary leave', 'Temporary stay')),
    start_date DATE NOT NULL,
    end_date DATE,
    reason TEXT,
    approval_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (resident_id) REFERENCES Resident(id) ON DELETE CASCADE
);

-- ========= COMMUNITY MEETING MANAGEMENT =========

-- Bảng quản lý các cuộc họp / sự kiện cộng đồng
CREATE TABLE Meeting (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,                     -- Chủ đề cuộc họp
    content TEXT,                                    -- Nội dung chi tiết
    tasks TEXT[],                                    -- Danh sách nhiệm vụ / công việc
    location TEXT NOT NULL,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    creator_id INT,                                  -- ID người tạo (tài khoản cán bộ)

    FOREIGN KEY (creator_id) REFERENCES Account(id)
);

-- Bảng ghi nhận việc tham dự họp của các hộ gia đình
CREATE TABLE Attendance (
    meeting_id INT NOT NULL,
    household_id VARCHAR(10) NOT NULL,               -- Mã hộ tham dự (liên kết household_code)
    attended BOOLEAN DEFAULT FALSE,                  -- TRUE: có tham dự, FALSE: vắng mặt

    PRIMARY KEY (meeting_id, household_id),
    FOREIGN KEY (meeting_id) REFERENCES Meeting(id) ON DELETE CASCADE,
    FOREIGN KEY (household_id) REFERENCES Household(household_code) ON DELETE CASCADE
);
