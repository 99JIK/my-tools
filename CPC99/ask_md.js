#!/usr/bin/env node

// 개발 환경에서 .env 파일 로드를 위해 사용 (프로덕션에서는 환경 변수 직접 설정)
require('dotenv').config();

const fs = require('fs/promises'); // 파일 시스템 접근 (Promise 기반)
const path = require('path');     // 파일 경로 관련 유틸리티
const { OpenAI } = require('openai');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// --- 명령줄 인자 파싱 설정 ---
const argv = yargs(hideBin(process.argv))
    .usage('Usage: node $0 <question> <inputFile> <outputFile> [options]')
    // 필수 위치 인자 정의
    .command('$0 <question> <inputFile> <outputFile>', 'Ask OpenAI about a Markdown file', (yargs) => {
        yargs.positional('question', {
            describe: 'The question to ask about the Markdown content',
            type: 'string',
        })
        .positional('inputFile', {
            describe: 'Path to the input Markdown file (context)',
            type: 'string',
        })
        .positional('outputFile', {
            describe: 'Path to save the output Markdown file (answer)',
            type: 'string',
        });
    })
    // 옵션 인자 정의
    .option('model', {
        alias: 'm',
        type: 'string',
        description: 'OpenAI model to use',
        default: 'gpt-3.5-turbo', // 기본 모델 설정
    })
    // 필수 인자 개수 확인
    .demandCommand(3, 'Error: Please provide the question, input file path, and output file path.')
    .help() // 도움말 옵션 활성화
    .alias('help', 'h')
    .strict() // 정의되지 않은 옵션 사용 시 오류 발생
    .argv;

// --- 핵심 로직을 수행하는 비동기 함수 ---
async function processMarkdownAndAsk(question, inputFile, outputFile, model) {
    console.log('Starting process...');
    console.log(`  Question: "${question}"`);
    console.log(`  Input File: ${inputFile}`);
    console.log(`  Output File: ${outputFile}`);
    console.log(`  Model: ${model}`);

    // 1. OpenAI API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        // .env 파일 사용 시 로드 실패 가능성 안내
        console.error("Error: OPENAI_API_KEY environment variable is not set.");
        console.error("Hint: If using a .env file, ensure it's in the project root and 'dotenv' is loaded correctly.");
        process.exit(1); // 오류 발생 시 종료
    }

    // 2. OpenAI 클라이언트 초기화
    const openai = new OpenAI({ apiKey });

    let markdownContext;
    // 3. 입력 마크다운 파일 읽기
    try {
        console.log(`\nReading input file: ${inputFile}...`);
        markdownContext = await fs.readFile(inputFile, { encoding: 'utf-8' });
        console.log('Input file read successfully.');
    } catch (error) {
        if (error.code === 'ENOENT') { // 파일이 없을 경우
            console.error(`Error: Input file not found at '${inputFile}'.`);
        } else {
            console.error(`Error reading input file: ${error.message}`);
        }
        process.exit(1);
    }

    // 4. 프롬프트 구성
    const finalPrompt = `
--- 마크다운 내용 시작 ---
${markdownContext}
--- 마크다운 내용 끝 ---
주어진 마크다운에 해당하는 문제를 C99로 작성해줘
`;
    console.log('Prompt constructed.');
    // console.log(`Prompt preview:\n${finalPrompt.substring(0, 200)}...`); // 디버깅 시 프롬프트 미리보기

    let responseContent;
    // 5. OpenAI API 호출
    try {
        console.log(`\nCalling OpenAI API (${model})...`);
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: "You are a helpful assistant designed to answer questions based on the provided text context." },
                { role: "user", content: finalPrompt },
            ],
            // 필요시 추가 옵션: temperature, max_tokens 등
            // temperature: 0.7,
        });

        // 응답 내용 추출 (Optional Chaining 사용)
        responseContent = completion.choices?.[0]?.message?.content?.trim();

        if (!responseContent) {
            console.error('Error: Received no content in the API response.');
            // console.log('API Response:', completion); // 전체 응답 로깅 (디버깅용)
            process.exit(1);
        }
        console.log('API call successful.');

    } catch (error) {
        console.error(`\nError calling OpenAI API: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        process.exit(1);
    }

    // 6. 결과(응답)를 출력 파일에 쓰기
    try {
        console.log(`\nWriting response to output file: ${outputFile}...`);
        // 출력 디렉토리 확인 및 생성 (존재하지 않을 경우)
        const outputDir = path.dirname(outputFile);
        await fs.mkdir(outputDir, { recursive: true }); // recursive: true -> 중간 경로도 생성

        await fs.writeFile(outputFile, responseContent, { encoding: 'utf-8' });
        console.log(`Successfully saved the response to ${outputFile}`);
    } catch (error) {
        console.error(`Error writing output file: ${error.message}`);
        process.exit(1);
    }
}

// --- 메인 실행 로직 ---
// 즉시 실행 함수 표현식(IIFE)을 사용하여 비동기 함수 실행
(async () => {
    await processMarkdownAndAsk(argv.question, argv.inputFile, argv.outputFile, argv.model);
    console.log('\nProcess finished successfully!');
})();