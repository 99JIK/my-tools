require('dotenv').config();
const express = require('express');
const multer = require('multer'); // 파일 업로드 처리
const { OpenAI } = require('openai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; // 포트 설정 (환경 변수 또는 3000)

// --- OpenAI 클라이언트 설정 ---
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error("FATAL ERROR: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
}
const openai = new OpenAI({ apiKey });

// --- Multer 설정 (메모리에 파일 저장) ---
const storage = multer.memoryStorage(); // 파일을 메모리 버퍼로 받음
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 파일 크기 제한 (예: 10MB)
    fileFilter: (req, file, cb) => { // 마크다운 또는 텍스트 파일만 허용 (선택 사항)
        if (file.mimetype === 'text/markdown' || file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            cb(new Error('Markdown(.md) 또는 Text(.txt) 파일만 업로드 가능합니다.'), false);
        }
    }
});

// --- 미들웨어 설정 ---
app.use(express.static(path.join(__dirname, 'public'))); // 'public' 폴더의 정적 파일 제공
app.use(express.json()); // JSON 요청 본문 파싱
app.use(express.urlencoded({ extended: true })); // URL-encoded 요청 본문 파싱

// --- API 엔드포인트 (/ask) ---
// upload.single('markdownFile') : 'markdownFile' 필드 이름으로 전송된 단일 파일을 처리
app.post('/ask', upload.single('markdownFile'), async (req, res) => {
    const question = req.body.question;
    const file = req.file; // 업로드된 파일 정보 (multer가 추가)
    const model = req.body.model || 'gpt-3.5-turbo'; // 클라이언트에서 모델 선택 가능하도록

    // 입력 값 검증
    if (!question) {
        return res.status(400).json({ error: '질문을 입력해주세요.' });
    }
    if (!file) {
        return res.status(400).json({ error: '마크다운 또는 텍스트 파일을 업로드해주세요.' });
    }

    try {
        console.log(`Received request: question="${question.substring(0, 50)}...", file=${file.originalname}, model=${model}`);

        // 1. 파일 내용 읽기 (메모리 버퍼에서)
        const markdownContext = file.buffer.toString('utf-8');
        console.log(`File content read (${file.originalname}, size: ${file.size} bytes)`);

        // 2. 프롬프트 구성
        const finalPrompt = `주어진 마크다운 내용을 바탕으로 다음 질문에 답해주세요.

--- 마크다운 내용 시작 ---
${markdownContext}
--- 마크다운 내용 끝 ---

질문: ${question}
`;
        console.log("Prompt constructed.");

        // 3. OpenAI API 호출
        console.log(`Calling OpenAI API (${model})...`);
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: "You are a helpful assistant designed to answer questions based on the provided text context." },
                { role: "user", content: finalPrompt },
            ],
        });

        const responseContent = completion.choices?.[0]?.message?.content?.trim();
        console.log("API call successful.");

        if (!responseContent) {
            throw new Error("API로부터 빈 응답을 받았습니다.");
        }

        // 4. 결과 전송
        res.json({ answer: responseContent });

    } catch (error) {
        console.error('Error processing request:', error);
        // 클라이언트에 에러 메시지 전송
        res.status(500).json({ error: `처리 중 오류 발생: ${error.message}` });
    }
});

// --- 서버 시작 ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

// Multer 오류 처리 미들웨어 (파일 필터링 등에서 발생한 오류 처리)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer 관련 오류 (예: 파일 크기 초과)
        console.error("Multer Error:", err.message);
        res.status(400).json({ error: `파일 업로드 오류: ${err.message}` });
    } else if (err) {
        // 기타 오류 (예: 파일 필터에서 발생한 에러)
        console.error("File Filter/Other Error:", err.message);
        res.status(400).json({ error: err.message });
    } else {
        next();
    }
});