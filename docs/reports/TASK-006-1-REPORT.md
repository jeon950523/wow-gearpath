# TASK-006-1 웹 교차 검수

## 기준 및 입력

- 웹 시작 main 3faf928b8e310e4ac7389abd9c52bc44fa889719. 애드온 main 48ec8d4e0a1d2b5c45662498d58b74d8f6bd40be, ADDON-004I PR #3 3baa44bc682370494a3cde318700a68ab75861b0, 재화 PR #2 cdf805a1e5150e6949fa2129e69afa19a2082214, 강화 3e433b845c642c97815e1dce716b8d25c5dcd9c0.
- 운영 TOC 모의 생성은 애드온에서 고정한 tests/addon-load.test.lua blob b47740cde5ed7c82541d599077cd901623081592로 실행했다. 실제 TOC 순서로 운영 모듈 전체를 읽고 WoW API와 UI는 원본 테스트의 모의를 사용했다. Windows Node v26.13.0, Fengari 0.1.4(Lua 5.3 모델). 파일 읽기·쓰기와 UTC 포맷만 테스트 환경에 연결했다. 6/6 통과. 첫 시도의 Fengari io.lines 및 UTC 미지원은 테스트 환경 보완으로 해결했다. 네이티브 Lua 5.1은 이 작업에서 미실행.
- [전체 합성 JSON](../../contracts/examples/addon-0.4.0-generated-full.json)은 원본 테스트의 선택 출력(8,210바이트, SHA-256 a3cd548b82eb9e5d3481b81fac73dccbca2c18da7ab5f10d7877f13f021a0437), [기본 합성 JSON](../../contracts/examples/addon-0.4.0-generated-base.json)은 완료 후 실제 export-base 명령 출력(SHA-256 5e7b93f78f4b8148d5888218fc8c02873464ef9d5fe02892537fa98073642078)이다. 원래 관측 시각은 각각 2026-11-25T23:40:00Z와 23:40:01Z다. 애드온 저장소는 읽기 전용으로 참조했다.
- 독립 재현은 고정 SHA의 addon/WowGearPath 및 tests/addon-load.test.lua를 작업 폴더에 추출한 후 lua5.4 tests/addon-load.test.lua . full.json을 실행한다. 기본 출력은 같은 하네스 완료 뒤 SlashCmdList.WOWGEARPATH('export-base azshara')를 호출해 마지막 모의 export를 읽는다. 이 웹 작업의 실행 증적은 위의 Fengari 환경에 해당한다.

## 발견 및 수정

운영 Resources.lua(blob 1280b9e7ccf76689d6833214e45de4ac1bd81e95)는 소지금을 정수 골드로 내보낸다. 기존 웹 요약과 표는 이를 코퍼로 해석해 1,234골드를 12실버 34코퍼로 표시했다. 신규 모의 운영 출력으로 재현한 뒤 소지금 표시와 수동 입력 단위 문구를 수정했다. 전역퀘 보상 12,345코퍼는 1골드 23실버 45코퍼로 표시한다. 계산 예산·스키마·API·저장 방식은 기존 그대로다.

- 기능 검수. 표준 Ajv 2020-12 v1 전체 검증 → parseAddon → mergeSnapshots → validate/diagnose → 통합 대시보드에서 새 전체/기본 예제를 검증했다. 전체 예제의 지도 22, 퀘스트 1, 장비 15/평균 315, 재화 12, 3418 관측 0, 보상 화폐 0, 독립 그룹 시각을 보존한다. v0.3.2/v0.2.1 하위 호환, 솔플/315, 기본 export 이력, 15분 경계, 선택·캐시 비합산과 기존 반례를 유지했다.
- 효율 검수. 화면 단위 포맷만 분리했다. 새 요청, 저장, 폴링, 재집계 및 TTL 변경은 없다. 운영 성능 개선 수치를 주장하지 않는다.

## 직접 실행

Windows, Node v26.13.0, npm 11.20.0, 기존 Chromium 헤드리스. npm ci 성공, npm test 94/94, npm run build 성공, npm run test:e2e 11/11. 기존 민감 필드 차단과 브라우저 가져오기 미전송을 확인했다. 클라이언트 번들의 Blizzard 인증 주소/시크릿 이름 및 모의 보호 문자열 검색 결과는 0건이다. 운영 검증과 Actions 실행 수는 웹 PR에 기록한다.

## 실제 사용자 데이터 및 후속

사용자 원본 수령이 불가능하여 웹의 실제 인게임 교차 검증은 대기한다. 원본은 저장소·로그·번들·서버 어디에도 넣지 않았다. 애드온 보고서의 29개 지도, 18개 퀘스트, 72개 그룹 관측 시각, 만료 17/18, 평균 285.375는 애드온 측 실측으로 웹 테스트 수에 포함하지 않는다. [애드온 실측 보고서](https://github.com/jeon950523/wow-gearpath-addon/blob/3baa44bc682370494a3cde318700a68ab75861b0/docs/reports/ADDON-004I-4-live-recheck.md)

실제 파일 제공 시 원본을 수정하지 않고 관측 시각 주입 검사 및 현재 브라우저 시각 검사를 각각 시행한다. 현재 활성까지 확인하려면 새 export가 필요하다. 게임 UI 보상·수량·툴팁, 실제 선택/캐시 복구, Lua 5.1, 사용자 승인과 애드온 PR/Release는 별도다. NPC 실측과 계약 전에는 TASK-006-2를 후보로 유지하고 본 TASK-007의 순서와 번호를 유지한다.

종료 전 원격 재조회에서 전역퀘 PR #3 및 양쪽 시작 main이 그대로였고, 강화 브랜치만 7de7cad5412dc4ead7551735915363553a4027e6으로 갱신됐다. 새 검수는 강화 진단 모의 테스트와 설치 준비이며 NPC/UI 실측은 계속 대기한다. [강화 사전 검수](https://github.com/jeon950523/wow-gearpath-addon/blob/7de7cad5412dc4ead7551735915363553a4027e6/docs/reports/ADDON-UPGRADE-001-1-preflight.md)
