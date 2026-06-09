import { List, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function PoliciesPage() {
  const { tx } = useTranslation();

  return (
    <Stack gap="md">
      <PageHeader
        title="Chính sách"
        description="Văn bản chính sách nội bộ dùng để admin và quản lý tra cứu."
      />

      <Paper withBorder radius="md" p="xl" className="policy-document">
        <Stack gap="lg">
          <Stack gap={6}>
            <ThemeIcon size={44} radius="md" variant="light" color="blue">
              <FileText size={24} />
            </ThemeIcon>
            <Title order={2}>Chính sách vận hành OmniHR</Title>
            <Text c="dimmed">
              Tài liệu này mô tả các nguyên tắc sử dụng hệ thống nhân sự trong
              giai đoạn hiện tại. Đây là nội dung hướng dẫn, không phải màn hình
              cấu hình quyền động.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Title order={3}>1. Chính sách tài khoản và phân quyền</Title>
            <Text>
              Mỗi nhân sự có một tài khoản hệ thống gắn với hồ sơ nhân viên.
              Quyền truy cập được phân theo vai trò như Admin, Manager và
              Employee. Admin quản trị toàn bộ dữ liệu; Manager chỉ xem và xử lý
              dữ liệu trong phạm vi nhân viên cấp dưới; Employee chủ yếu sử dụng
              các chức năng cá nhân.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Title order={3}>2. Chính sách hồ sơ nhân sự</Title>
            <Text>
              Hồ sơ nhân sự cần được cập nhật đúng thông tin phòng ban, chức vụ,
              email công ty, trạng thái làm việc và thông tin liên hệ. Các thay
              đổi quan trọng nên do Admin thực hiện để bảo đảm dữ liệu nhân sự
              nhất quán.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Title order={3}>3. Chính sách chấm công</Title>
            <Text>
              Nhân viên thực hiện check-in và check-out theo ngày làm việc.
              Trường hợp quên chấm công, sai giờ hoặc cần bổ sung dữ liệu, Admin
              có thể tạo bản ghi điều chỉnh kèm lý do để phục vụ kiểm tra sau
              này.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Title order={3}>4. Chính sách nghỉ phép</Title>
            <Text>
              Nhân viên tạo đơn nghỉ phép bằng cách chọn loại nghỉ, ngày bắt đầu,
              ngày kết thúc và lý do. Hệ thống tính số ngày nghỉ theo ngày làm
              việc và không cho tạo đơn trùng với đơn đang chờ duyệt hoặc đã
              được duyệt. Manager hoặc Admin xử lý duyệt/từ chối theo phạm vi
              trách nhiệm.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Title order={3}>5. Nguyên tắc xử lý dữ liệu</Title>
            <List spacing="xs" icon={<ClipboardCheck size={16} />}>
              <List.Item>Không chia sẻ tài khoản cho người khác sử dụng.</List.Item>
              <List.Item>Dữ liệu nhân sự phải được cập nhật theo nguồn chính xác.</List.Item>
              <List.Item>Các thao tác quan trọng được ghi nhận trong nhật ký hệ thống.</List.Item>
              <List.Item>Thông tin cá nhân chỉ được xem trong phạm vi được phân quyền.</List.Item>
            </List>
          </Stack>

          <Stack gap="xs">
            <Title order={3}>6. Ghi chú về cài đặt hệ thống</Title>
            <Text>
              Các cài đặt như ngày làm việc, cách tính phép và cấu hình phase
              được quản lý ở màn hình Cài đặt hệ thống. Khi thay đổi cài đặt,
              Admin cần kiểm tra tác động đến nghiệp vụ trước khi áp dụng cho
              toàn bộ công ty.
            </Text>
          </Stack>

          <Paper withBorder radius="md" p="md" className="policy-note">
            <Stack gap={6}>
              <ThemeIcon size={34} radius="md" variant="light" color="teal">
                <ShieldCheck size={19} />
              </ThemeIcon>
              <Text fw={700}>{tx("Note")}</Text>
              <Text size="sm" c="dimmed">
                Trang này thay thế module quản lý policy dạng bảng. Nếu sau này
                cần ABAC động, hệ thống có thể bổ sung rule engine riêng.
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Paper>
    </Stack>
  );
}
