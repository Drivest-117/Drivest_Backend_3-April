Các màn hình Pháp lý Tham gia trong Ứng dụng
Mô hình tham gia hai giai đoạn hiện tại
Phiên bản
Phiên bản 1.1
Cập nhật lần cuối
5 tháng 4, 2026
Chuẩn bị cho
Drivest Limited

Mục đích tài liệu
Tài liệu nội bộ này xác định luồng pháp lý và quyền tham gia hiện tại đã được phê duyệt cho Drivest. Nó phản ánh việc triển khai hiện có trong ứng dụng và thay thế các từ ngữ cũ không mô tả đầy đủ mô hình đồng ý được lưu trữ.

1. Mục tiêu
Tài liệu này xác định luồng tham gia trong ứng dụng hiện tại để chấp nhận pháp lý và các quyền. Mô hình được phê duyệt sử dụng hai giai đoạn thay vì một hành trình pháp lý nhiều màn hình dài hơn. Mục đích là giảm bớt sự khó chịu cho người dùng trong khi vẫn thu thập được xác nhận pháp lý có giá trị và các lựa chọn được ghi lại riêng biệt có thể được thực thi và làm bằng chứng bởi backend.

2. Giai đoạn 1: Chấp nhận pháp lý kết hợp
Giai đoạn 1 là cổng vào bắt buộc để vào ứng dụng.

Tiêu đề hiện tại:
Trước khi bạn bắt đầu

Nội dung phần thân hiện tại:
Drivest là một nền tảng hỗ trợ lái xe. Nó chỉ cung cấp hướng dẫn và không thay thế phán đoán của bạn, hướng dẫn viên của bạn hoặc pháp luật.

Bạn phải luôn tuân theo biển báo giao thông, luật giao thông và điều kiện thực tế. Nếu bất cứ điều gì trong ứng dụng xung đột với đường đi, hãy đi theo đường đi.

Bằng cách tiếp tục, bạn xác nhận rằng bạn từ 16 tuổi trở lên, rằng bạn hiểu và chấp nhận thông báo an toàn, và rằng bạn đồng ý với Điều khoản và Điều kiện và Chính sách Quyền riêng tư.

Các điều khiển bắt buộc:
- Xem Điều khoản
- Xem Quyền riêng tư
- một hộp kiểm bắt buộc
- Nút Tiếp tục bị vô hiệu hóa cho đến khi hộp kiểm được chọn

Văn bản hộp kiểm hiện tại:
Tôi xác nhận rằng mình từ 16 tuổi trở lên, tôi hiểu thông báo an toàn, và tôi đồng ý với Điều khoản và Điều kiện và Chính sách Quyền riêng tư.

Giai đoạn này tạo ra hồ sơ chấp nhận pháp lý có thẩm quyền.
Backend nên lưu trữ:
- termsVersion (phiên bản điều khoản)
- privacyVersion (phiên bản quyền riêng tư)
- safetyVersion (phiên bản an toàn)
- ageConfirmed (xác nhận tuổi)
- safetyAccepted (chấp nhận an toàn)
- dấu thời gian chấp nhận
- sourceScreen (màn hình nguồn)
- phiên bản ứng dụng
- nền tảng
- mã định danh cài đặt (nếu có)

3. Giai đoạn 2: Quyền và sự đồng ý tùy chọn
Giai đoạn 2 là màn hình quyền vận hành.

Tiêu đề hiện tại:
Quyền hạn

Nội dung phần thân hiện tại:
Drivest cần một số quyền nhất định để hoạt động bình thường. Vị trí được sử dụng cho các lộ trình và dẫn đường khi được kích hoạt. Phân tích giúp cải thiện hiệu suất và độ tin cậy và là tùy chọn. Thông báo giúp bạn cập nhật về các lượt đặt chỗ và hoạt động.

Các điều khiển bắt buộc:
- một hành động vị trí kích hoạt luồng quyền vị trí gốc của hệ điều hành
- các hành động cho phép và không cho phép phân tích riêng biệt
- các hành động bật và không phải lúc này cho thông báo riêng biệt
- Nút Tiếp tục

Phần vị trí hiện tại:
Tiêu đề: Vị trí
Thông điệp: Vị trí được sử dụng cho các lộ trình và dẫn đường khi được kích hoạt.
Nút: Yêu cầu quyền truy cập vị trí

Các trạng thái vị trí hiện tại:
- Quyền truy cập vị trí đã được cho phép cho Drivest.
- Quyền truy cập vị trí hiện đang bị từ chối. Bạn có thể tiếp tục, nhưng các tính năng lộ trình sẽ bị hạn chế cho đến khi bạn bật nó.
- Vị trí hiện là tùy chọn, nhưng các tính năng lộ trình và đỗ xe cần nó khi bạn sử dụng chúng.

Phần phân tích hiện tại:
Tiêu đề: Phân tích Tùy chọn
Thông điệp: Phân tích giúp cải thiện hiệu suất và độ tin cậy và là tùy chọn.
Các hành động:
- Cho phép Phân tích
- Không cho phép

Phần thông báo hiện tại:
Tiêu đề: Thông báo Tùy chọn
Thông điệp: Thông báo giúp bạn cập nhật về các lượt đặt chỗ và hoạt động.
Các hành động:
- Bật Thông báo
- Không phải lúc này

4. Ánh xạ Backend
Tối thiểu, Giai đoạn 1 nên tạo hoặc cập nhật các bản ghi trong:
- legal_document_versions
- user_legal_acceptances

Tối thiểu, Giai đoạn 2 nên tạo hoặc cập nhật các lựa chọn hiện tại và hồ sơ lịch sử cho:
- analyticsChoice (lựa chọn phân tích)
- notificationsChoice (lựa chọn thông báo)
- locationChoice (lựa chọn vị trí)

Các thay đổi cài đặt sau này phải được ghi lại vào cùng một mô hình tuân thủ backend để Drivest có thể chứng minh cả lựa chọn tham gia ban đầu và các thay đổi hoặc rút lại sau đó nếu có.

5. Các quy tắc cứng
Không có hộp kiểm nào được chọn trước.
Ứng dụng không được cho phép người dùng bỏ qua giai đoạn chấp nhận pháp lý và tiếp tục vào sản phẩm mà không có sự đồng ý.
Điều khoản và Điều kiện và Chính sách Quyền riêng tư phải có thể truy cập được từ giai đoạn pháp lý.
Thông báo an toàn phải được duy trì là một phần của văn bản chấp nhận pháp lý trừ khi vị thế pháp lý thay đổi và các phiên bản được cập nhật tương ứng.
Giai đoạn quyền hạn không được gộp chung phân tích, thông báo và vị trí vào một sự đồng ý mơ hồ duy nhất.
Mỗi lựa chọn phải được trình bày riêng biệt để dễ hiểu và có thể ghi lại riêng biệt.
Bất kỳ thay đổi quan trọng nào đối với văn bản pháp lý, mô hình quyền hoặc hành vi được theo dõi đều phải kích hoạt việc cập nhật phiên bản và chấp nhận lại nếu cần thiết.
