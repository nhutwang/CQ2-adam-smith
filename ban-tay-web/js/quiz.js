/* Mini game cuối báo cáo: chọn đáp án, nhận giải thích, xem lại điểm. */
(function () {
 'use strict';

 var questions = [
   {
     topic: 'Nền kinh tế thị trường',
     prompt: 'Điều gì mô tả đúng cách nền kinh tế thị trường vận hành?',
     choices: [
       'Nhà nước quyết định toàn bộ sản phẩm, số lượng và giá bán.',
       'Sản xuất và trao đổi diễn ra qua thị trường, chịu tác động của các quy luật kinh tế.',
       'Mọi hàng hóa đều có giá cố định như nhau ở tất cả các thị trường.',
       'Người sản xuất chỉ làm theo đơn đặt hàng của cơ quan quản lý.'
     ],
     answer: 1,
     explanation: 'Kinh tế thị trường vận hành theo cơ chế thị trường. Các quan hệ sản xuất và trao đổi được thực hiện thông qua thị trường, đồng thời chịu tác động của những quy luật kinh tế.'
   },
   {
     topic: 'Quy luật giá trị',
     prompt: 'Hai cơ sở làm ra sản phẩm tương đương. Cơ sở A có hao phí lao động cá biệt thấp hơn mức xã hội cần thiết. Lợi thế nào phù hợp nhất?',
     choices: [
       'A có thể đạt lợi nhuận cao hơn nếu trao đổi theo giá trị xã hội.',
       'A được quyền đặt mọi mức giá mà người mua buộc phải chấp nhận.',
       'A không còn chịu tác động của cạnh tranh.',
       'A có thể tăng hao phí mà không ảnh hưởng khả năng tồn tại trên thị trường.'
     ],
     answer: 0,
     explanation: 'Khi hao phí cá biệt thấp hơn hao phí lao động xã hội cần thiết, người sản xuất có lợi thế và có thể thu lợi nhuận cao hơn. Đây là động lực cải tiến kỹ thuật, hạ chi phí và nâng năng suất.'
   },
   {
     topic: 'Quy luật cung – cầu',
     prompt: 'Một mặt hàng đang khan hiếm vì cầu vượt cung. Diễn biến nào phù hợp với nội dung bài?',
     choices: [
       'Giá có xu hướng tăng; người sản xuất có động lực mở rộng quy mô.',
       'Giá có xu hướng giảm; người sản xuất mở rộng quy mô.',
       'Giá luôn đứng yên vì lượng cung chưa thay đổi.',
       'Người tiêu dùng quyết định trực tiếp lượng hàng doanh nghiệp phải sản xuất.'
     ],
     answer: 0,
     explanation: 'Khi cầu lớn hơn cung, hàng hóa khan hiếm và giá thị trường có xu hướng tăng. Tín hiệu giá tạo động lực để người sản xuất mở rộng sản xuất.'
   },
   {
     topic: 'Người tiêu dùng',
     prompt: 'Vì sao lựa chọn mua sắm của người tiêu dùng có thể ảnh hưởng đến sản xuất?',
     choices: [
       'Vì người tiêu dùng trực tiếp ban hành luật về sản xuất.',
       'Vì nhu cầu và sức mua tác động đến quyết định của người sản xuất.',
       'Vì người tiêu dùng thay thế Nhà nước trong quản lý thị trường.',
       'Vì mỗi người tiêu dùng đều quyết định giá chung của nền kinh tế.'
     ],
     answer: 1,
     explanation: 'Nhu cầu đa dạng và sức mua của người tiêu dùng ảnh hưởng đến hoạt động sản xuất, góp phần định hướng nhà sản xuất cung cấp hàng hóa và dịch vụ.'
   },
   {
     topic: 'Khuyết tật thị trường & vai trò Nhà nước',
     prompt: 'Hoạt động giao hàng tăng mạnh nhưng kéo theo nhiều rác thải bao bì. Kết luận nào phù hợp nhất?',
     choices: [
       'Cạnh tranh sẽ luôn tự giải quyết ô nhiễm mà không cần biện pháp nào khác.',
       'Đây là tác động môi trường mà thị trường có thể không tự khắc phục; Nhà nước có vai trò quản lý phù hợp.',
       'Chỉ người mua phải chịu trách nhiệm, vì họ là người nhận hàng.',
       'Cần chấm dứt mọi hoạt động sản xuất và trao đổi.'
     ],
     answer: 1,
     explanation: 'Tài liệu nêu thị trường không thể tự khắc phục suy thoái môi trường. Nhà nước quản lý kinh tế, khắc phục khuyết tật thị trường và hỗ trợ phát triển bền vững.'
   }
 ];

 var letters = ['A', 'B', 'C', 'D'];
 var intro = document.getElementById('quiz-intro');
 var game = document.getElementById('quiz-game');
 var result = document.getElementById('quiz-result');
 var choices = document.getElementById('quiz-choices');
 var submit = document.getElementById('quiz-submit');
 var index = 0, score = 0, selected = null, locked = false, answers = [];

 function show(screen) {
   intro.hidden = screen !== intro;
   game.hidden = screen !== game;
   result.hidden = screen !== result;
 }

 function renderQuestion() {
   var q = questions[index];
   selected = null;
   locked = false;
   document.getElementById('quiz-current').textContent = String(index + 1).padStart(2, '0');
   document.getElementById('quiz-score').textContent = score + ' ĐIỂM';
   document.getElementById('quiz-topic').textContent = q.topic;
   document.getElementById('quiz-question').textContent = q.prompt;
   document.getElementById('quiz-feedback').hidden = true;
   document.getElementById('quiz-hint').textContent = 'Chọn đáp án bạn cho là đúng.';
   submit.disabled = true;
   submit.innerHTML = 'Chốt đáp án <span aria-hidden="true">→</span>';
   var legend = choices.querySelector('legend');
   choices.replaceChildren(legend);
   q.choices.forEach(function (text, choiceIndex) {
     var label = document.createElement('label');
     label.className = 'quiz__choice';
     var input = document.createElement('input');
     input.type = 'radio';
     input.name = 'quiz-answer';
     input.value = String(choiceIndex);
     input.addEventListener('change', function () {
       selected = choiceIndex;
       if (!locked) submit.disabled = false;
     });
     var body = document.createElement('span');
     body.className = 'quiz__choice-body';
     var letter = document.createElement('span');
     letter.className = 'quiz__letter';
     letter.textContent = letters[choiceIndex];
     var copy = document.createElement('span');
     copy.className = 'quiz__choice-copy';
     copy.textContent = text;
     body.append(letter, copy);
     label.append(input, body);
     choices.append(label);
   });
   document.getElementById('quiz-progress').style.width = (index / questions.length * 100) + '%';
   document.querySelector('#quiz .quiz__progress').setAttribute('aria-valuenow', index);
   document.getElementById('quiz-question').focus({ preventScroll: true });
 }

 function answer() {
   if (selected === null || locked) return;
   locked = true;
   var q = questions[index];
   var correct = selected === q.answer;
   answers[index] = { correct: correct };
   if (correct) score++;
   choices.querySelectorAll('input').forEach(function (input) { input.disabled = true; });
   document.getElementById('quiz-score').textContent = score + ' ĐIỂM';
   var feedback = document.getElementById('quiz-feedback');
   feedback.dataset.correct = String(correct);
   document.getElementById('quiz-feedback-title').textContent = correct
     ? 'Chính xác — bạn nắm đúng ý.'
     : 'Chưa chính xác — cùng chốt lại ý này.';
   document.getElementById('quiz-feedback-copy').textContent = q.explanation;
   feedback.hidden = false;
   document.getElementById('quiz-hint').textContent = 'Đáp án đúng: ' + letters[q.answer] + '.';
   submit.innerHTML = index === questions.length - 1
     ? 'Xem tổng kết <span aria-hidden="true">→</span>'
     : 'Câu tiếp theo <span aria-hidden="true">→</span>';
   document.getElementById('quiz-progress').style.width = ((index + 1) / questions.length * 100) + '%';
   document.querySelector('#quiz .quiz__progress').setAttribute('aria-valuenow', index + 1);
 }

 function finish() {
   document.getElementById('quiz-final-score').textContent = String(score);
   document.getElementById('quiz-result-heading').textContent = score === 5
     ? 'Vững mạch lập luận.'
     : score >= 3 ? 'Nắm được mạch chính.' : 'Còn vài ý để củng cố.';
   document.getElementById('quiz-result-copy').textContent = score === 5
     ? 'Bạn kết nối tốt cơ chế thị trường, các quy luật và vai trò điều tiết. Hãy giữ mạch lập luận ấy khi xem lại phần báo cáo.'
     : score >= 3
       ? 'Bạn đã nắm được phần lớn nội dung. Xem lại những câu đánh dấu đỏ để củng cố các ý còn nhầm.'
       : 'Hãy xem lại lời giải từng câu, rồi thử chơi lại để nối các khái niệm với tình huống cụ thể.';
   var review = document.getElementById('quiz-review');
   review.replaceChildren();
   questions.forEach(function (q, i) {
     var row = document.createElement('div');
     row.className = 'quiz__review-row';
     row.dataset.correct = String(answers[i].correct);
     var mark = document.createElement('span');
     mark.className = 'quiz__review-mark';
     mark.textContent = answers[i].correct ? '✓' : '×';
     var copy = document.createElement('span');
     copy.textContent = String(i + 1).padStart(2, '0') + ' · ' + q.topic
       + (answers[i].correct ? ' — đúng' : ' — đáp án đúng: ' + letters[q.answer]);
     row.append(mark, copy);
     review.append(row);
   });
   show(result);
   document.getElementById('quiz-result-heading').focus({ preventScroll: true });
 }

 function advance() {
   if (!locked) { answer(); return; }
   if (index === questions.length - 1) { finish(); return; }
   index++;
   renderQuestion();
 }

 function start() {
   index = 0;
   score = 0;
   answers = [];
   show(game);
   renderQuestion();
 }

 document.getElementById('quiz-start').addEventListener('click', start);
 document.getElementById('quiz-replay').addEventListener('click', start);
 submit.addEventListener('click', advance);
 document.addEventListener('keydown', function (event) {
   if (event.key === 'Enter' && !game.hidden && selected !== null && !locked
     && document.activeElement && document.activeElement.type === 'radio') {
     event.preventDefault();
     answer();
   }
 });
})();
