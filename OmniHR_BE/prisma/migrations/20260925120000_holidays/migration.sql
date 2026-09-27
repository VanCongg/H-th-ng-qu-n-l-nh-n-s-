-- Public holidays and compensatory days off: not working days, whatever the
-- work week says.
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- Vietnamese public holidays (Labour Code 2019, art. 112) as announced for
-- 2025 and 2026. For 2027 only the solar-calendar days are known ahead; Tết
-- and the Hùng Kings' day are added from the admin page once announced.
INSERT INTO "holidays" ("date", "name", "updated_at") VALUES
    ('2025-01-01', 'Tết Dương lịch', CURRENT_TIMESTAMP),
    ('2025-01-25', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-01-26', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-01-27', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-01-28', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-01-29', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-01-30', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-01-31', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-02-01', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-02-02', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2025-04-07', 'Giỗ Tổ Hùng Vương', CURRENT_TIMESTAMP),
    ('2025-04-30', 'Ngày Giải phóng miền Nam', CURRENT_TIMESTAMP),
    ('2025-05-01', 'Quốc tế Lao động', CURRENT_TIMESTAMP),
    ('2025-05-02', 'Nghỉ hoán đổi dịp 30/4 - 1/5', CURRENT_TIMESTAMP),
    ('2025-09-01', 'Quốc khánh', CURRENT_TIMESTAMP),
    ('2025-09-02', 'Quốc khánh', CURRENT_TIMESTAMP),
    ('2026-01-01', 'Tết Dương lịch', CURRENT_TIMESTAMP),
    ('2026-02-14', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-15', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-16', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-17', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-18', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-19', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-20', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-21', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-02-22', 'Tết Nguyên đán', CURRENT_TIMESTAMP),
    ('2026-04-26', 'Giỗ Tổ Hùng Vương', CURRENT_TIMESTAMP),
    ('2026-04-27', 'Nghỉ bù Giỗ Tổ Hùng Vương', CURRENT_TIMESTAMP),
    ('2026-04-30', 'Ngày Giải phóng miền Nam', CURRENT_TIMESTAMP),
    ('2026-05-01', 'Quốc tế Lao động', CURRENT_TIMESTAMP),
    ('2026-09-01', 'Quốc khánh', CURRENT_TIMESTAMP),
    ('2026-09-02', 'Quốc khánh', CURRENT_TIMESTAMP),
    ('2027-01-01', 'Tết Dương lịch', CURRENT_TIMESTAMP),
    ('2027-04-30', 'Ngày Giải phóng miền Nam', CURRENT_TIMESTAMP),
    ('2027-05-01', 'Quốc tế Lao động', CURRENT_TIMESTAMP),
    ('2027-05-03', 'Nghỉ bù Quốc tế Lao động', CURRENT_TIMESTAMP),
    ('2027-09-02', 'Quốc khánh', CURRENT_TIMESTAMP),
    ('2027-09-03', 'Quốc khánh', CURRENT_TIMESTAMP)
ON CONFLICT ("date") DO NOTHING;
