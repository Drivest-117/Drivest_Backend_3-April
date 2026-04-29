Khung Quyền và Sự đồng ý
Các quyền trên di động của Drivest, sự đồng ý tùy chọn và mô hình ghi nhật ký
Phiên bản
Phiên bản 1.1
Cập nhật lần cuối
5 tháng 4, 2026
Chuẩn bị cho
Drivest Limited

Mục đích tài liệu
Tài liệu nội bộ này xác định cách các quyền và sự đồng ý nên được yêu cầu trong ứng dụng để hành trình di động ít gây khó chịu nhất, có thể bảo vệ được về mặt pháp lý và nhất quán với trang web hiện tại, hành vi ứng dụng và mô hình ghi nhật ký backend.

1. Mục đích của tài liệu này
Tài liệu này đề ra khung quyền và sự đồng ý hiện tại cho Drivest. Nó nhằm mục đích giữ cho trải nghiệm di động có thể sử dụng được trong khi vẫn phù hợp với vị thế pháp lý, quyền riêng tư và cửa hàng ứng dụng đang hoạt động.
Nguyên tắc cốt lõi vẫn không thay đổi. Drivest chỉ nên yêu cầu các quyền thực sự cần thiết, nên yêu cầu trong bối cảnh cụ thể, không nên bật sẵn các lựa chọn tùy chọn và phải có khả năng chứng minh người dùng đã chọn gì và khi nào.

2. Mô hình quyền tham gia hiện tại
Drivest hiện sử dụng mô hình tham gia hai giai đoạn.

Giai đoạn 1 xử lý việc chấp nhận pháp lý bắt buộc. Nó bao gồm:
- Chấp nhận Điều khoản và Điều kiện
- Chấp nhận Chính sách Quyền riêng tư
- Xác nhận độ tuổi
- Xác nhận thông báo an toàn

Giai đoạn 2 xử lý các quyền vận hành và sự đồng ý tùy chọn. Nó trình bày:
- Quyền truy cập vị trí
- Lựa chọn phân tích
- Lựa chọn thông báo

Vị trí quan trọng về mặt vận hành cho các tính năng liên quan đến lộ trình và đỗ xe, nhưng vẫn là một quyền của hệ điều hành. Phân tích là tùy chọn. Thông báo là tùy chọn.

3. Giai đoạn chấp nhận pháp lý bắt buộc
Giai đoạn tham gia đầu tiên phải làm rõ rằng Drivest là một nền tảng hỗ trợ lái xe chỉ cung cấp hướng dẫn.
Nó phải làm rõ rằng Drivest không thay thế phán đoán của người dùng, hướng dẫn viên lái xe hoặc pháp luật.
Giai đoạn này phải cung cấp quyền truy cập vào Điều khoản và Điều kiện và Chính sách Quyền riêng tư trước khi người dùng tiếp tục.
Người dùng phải chủ động đánh dấu vào một hộp kiểm trước khi tiếp tục.
Ứng dụng không được tiếp tục cho đến khi hộp kiểm đó được chọn.
Cùng một giai đoạn này thu thập xác nhận độ tuổi và xác nhận an toàn như một phần của sự kiện chấp nhận.
Backend phải lưu trữ phiên bản điều khoản đã chấp nhận, phiên bản quyền riêng tư, phiên bản an toàn, dấu thời gian chấp nhận, màn hình nguồn, phiên bản ứng dụng, nền tảng và mã định danh cài đặt nếu có.

4. Quyền vị trí
Vị trí nên được yêu cầu thông qua một hành động trong bối cảnh cụ thể và sau đó thông qua hộp thoại quyền của hệ điều hành.
Từ ngữ giải thích nên nhất quán với vị thế quyền riêng tư hiện tại:
- vị trí được sử dụng cho các lộ trình và dẫn đường khi được kích hoạt
- các tính năng lộ trình và đỗ xe cần vị trí khi người dùng cố gắng sử dụng chúng
- Drivest không nên ám chỉ rằng lịch sử vị trí nền liên tục được lưu trữ trên các máy chủ

Nếu người dùng từ chối quyền vị trí, ứng dụng có thể hạn chế các tính năng liên quan đến lộ trình và đỗ xe, nhưng không nên chặn các tính năng học tập không liên quan.
Ứng dụng nên lưu trữ lựa chọn vị trí hiệu quả của người dùng là một trong số:
- cho phép (allow)
- từ chối (deny)
- bỏ qua (skip)

5. Sự đồng ý phân tích
Phân tích phải là tùy chọn nơi sự đồng ý là cơ sở pháp lý dự kiến.
Hành vi phân tích nên vẫn tắt cho đến khi người dùng đưa ra lựa chọn khẳng định.
Giao diện người dùng nên mô tả phân tích là giúp cải thiện hiệu suất và độ tin cậy.
Giao diện không được gợi ý rằng phân tích là bắt buộc để sử dụng dịch vụ cốt lõi.
Backend nên lưu trữ:
- analyticsChoice (lựa chọn phân tích)
- timestamp (dấu thời gian)
- source surface (bề mặt nguồn)
- app version (phiên bản ứng dụng)
- platform (nền tảng)
- install identifier (mã định danh cài đặt) nếu có

6. Sự đồng ý thông báo
Thông báo phải là tùy chọn.
Lời nhắc nên mô tả mục đích vận hành của chúng, bao gồm các cập nhật, lượt đặt chỗ, nhắc nhở và hoạt động tài khoản quan trọng nếu có.
Thông báo không được bật sẵn theo mặc định.
Ứng dụng nên lưu trữ lựa chọn tùy chọn trong ứng dụng của người dùng tách biệt với kết quả quyền của hệ điều hành.
Backend nên lưu trữ:
- notificationsChoice (lựa chọn thông báo)
- timestamp (dấu thời gian)
- source surface (bề mặt nguồn)
- app version (phiên bản ứng dụng)
- platform (nền tảng)
- install identifier (mã định danh cài đặt) nếu có

7. Yêu cầu ghi nhật ký
Hệ thống phải ghi nhật ký sự kiện chấp nhận pháp lý tách biệt với các lựa chọn quyền và sự đồng ý.
Tối thiểu, backend nên lưu trữ:
- phiên bản điều khoản
- phiên bản quyền riêng tư
- phiên bản an toàn
- dấu thời gian chấp nhận
- trạng thái xác nhận tuổi
- lựa chọn phân tích
- dấu thời gian phân tích
- lựa chọn thông báo
- dấu thời gian thông báo
- lựa chọn vị trí
- dấu thời gian vị trí
- màn hình nguồn hoặc bề mặt nguồn
- phiên bản ứng dụng
- nền tảng
- mã định danh cài đặt nếu có

8. Yêu cầu triển khai hiện tại
Khung quyền phải phù hợp với hành vi thực tế của ứng dụng.
Nếu luồng pháp lý mô tả phân tích là tùy chọn, phân tích phải thực sự là tùy chọn trong triển khai.
Nếu ứng dụng lưu trữ lựa chọn vị trí như một phần của quá trình tham gia, mô hình dữ liệu đó phải được phản ánh trong tài liệu tuân thủ nội bộ.
Nếu ứng dụng sau này thêm một quyền mới, hành vi theo dõi mới hoặc xử lý vị trí nền liên tục, thì khung quyền, chính sách quyền riêng tư, văn bản trong ứng dụng và các tuyên bố trên cửa hàng đều phải được cập nhật cùng nhau trước khi phát hành.

9. Kiểm kê quyền cuối cùng
Quyền hoặc lựa chọn
Vị thế cuối cùng

Xác nhận pháp lý kết hợp bắt buộc
Chấp nhận Điều khoản, Chấp nhận Quyền riêng tư, xác nhận độ tuổi và xác nhận an toàn. Bắt buộc trước khi người dùng có thể vào sản phẩm.

Vị trí
Được yêu cầu trong bối cảnh để hỗ trợ các lộ trình, dẫn đường và các tính năng phụ thuộc vị trí. Được kiểm soát bởi hệ điều hành, nhưng ứng dụng cũng lưu trữ trạng thái lựa chọn được ghi lại.

Phân tích
Sự đồng ý tùy chọn. Phải vẫn tắt cho đến khi người dùng đưa ra lựa chọn khẳng định.

Thông báo
Sự đồng ý tùy chọn. Không được bật sẵn. Cài đặt thiết bị vẫn là cơ quan có thẩm quyền cuối cùng về quyền, trong khi ứng dụng lưu trữ lựa chọn sở thích trong ứng dụng của người dùng.
