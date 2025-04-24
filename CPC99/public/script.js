const questionInput = document.getElementById('questionInput');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName');
const modelSelect = document.getElementById('modelSelect');
const submitBtn = document.getElementById('submitBtn');
const statusDiv = document.getElementById('status');
const outputArea = document.getElementById('outputArea');

// 파일 선택 시 파일 이름 표시
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = fileInput.files[0].name;
    } else {
        fileNameDisplay.textContent = '선택된 파일 없음';
    }
});

// 제출 버튼 클릭 이벤트
submitBtn.addEventListener('click', async () => {
    const question = questionInput.value.trim();
    const file = fileInput.files[0];
    const selectedModel = modelSelect.value;

    // 입력 값 검증
    if (!question) {
        showStatus('질문을 입력해주세요.', 'error');
        return;
    }
    if (!file) {
        showStatus('마크다운 또는 텍스트 파일을 선택해주세요.', 'error');
        return;
    }

    // 로딩 상태 표시 및 버튼 비활성화
    showStatus('요청 처리 중...', 'loading');
    submitBtn.disabled = true;
    outputArea.textContent = ''; // 이전 결과 지우기

    // FormData 생성 (파일과 텍스트 데이터를 함께 보내기 위함)
    const formData = new FormData();
    formData.append('question', question);
    formData.append('markdownFile', file); // 'markdownFile'은 서버의 upload.single()과 일치해야 함
    formData.append('model', selectedModel);

    try {
        // 백엔드 API(/ask)에 POST 요청 보내기
        const response = await fetch('/ask', {
            method: 'POST',
            body: formData, // FormData를 body로 전송
            // headers: {'Content-Type': 'multipart/form-data'} // fetch가 FormData 사용 시 자동으로 설정하므로 생략 가능
        });

        // 응답 상태 확인
        if (!response.ok) {
            // 서버에서 에러 응답(JSON 형태 가정)을 보냈을 경우
            const errorData = await response.json().catch(() => ({ error: `HTTP 오류: ${response.status} ${response.statusText}` }));
            throw new Error(errorData.error || `HTTP 오류: ${response.status}`);
        }

        // 성공 응답 처리
        const result = await response.json();
        outputArea.textContent = result.answer; // 결과 표시
        showStatus('답변 생성 완료!', 'success');

    } catch (error) {
        console.error('Fetch Error:', error);
        outputArea.textContent = ''; // 에러 시 결과 영역 비우기
        showStatus(`오류 발생: ${error.message}`, 'error'); // 사용자에게 오류 메시지 표시
    } finally {
        // 버튼 다시 활성화
        submitBtn.disabled = false;
    }
});

// 상태 메시지 표시 함수
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`; // CSS 클래스 적용
    // 일정 시간 후 메시지 숨기기 (선택 사항)
    // if (type === 'success' || type === 'error') {
    //     setTimeout(() => {
    //         statusDiv.textContent = '';
    //         statusDiv.className = 'status-message';
    //     }, 5000);
    // }
}