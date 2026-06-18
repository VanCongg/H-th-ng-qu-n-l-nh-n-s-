UPDATE "leave_types"
SET "name" = CASE "code"
  WHEN 'ANNUAL_LEAVE' THEN 'Nghỉ phép năm'
  WHEN 'SICK_LEAVE' THEN 'Nghỉ ốm'
  WHEN 'UNPAID_LEAVE' THEN 'Nghỉ không lương'
  WHEN 'MATERNITY_LEAVE' THEN 'Nghỉ thai sản'
  WHEN 'MARRIAGE_LEAVE' THEN 'Nghỉ kết hôn'
  WHEN 'BEREAVEMENT_LEAVE' THEN 'Nghỉ tang chế'
  ELSE "name"
END
WHERE "code" IN (
  'ANNUAL_LEAVE',
  'SICK_LEAVE',
  'UNPAID_LEAVE',
  'MATERNITY_LEAVE',
  'MARRIAGE_LEAVE',
  'BEREAVEMENT_LEAVE'
);
